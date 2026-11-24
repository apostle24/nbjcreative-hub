import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in to purchase this course." }, { status: 401 });

    const body = await request.json();
    const courseId = typeof body?.courseId === "string" ? body.courseId.trim() : "";
    if (!courseId) return NextResponse.json({ error: "Course is required." }, { status: 400 });
    if (!user.email) return NextResponse.json({ error: "Your account needs an email address before checkout." }, { status: 400 });

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "Paystack is not configured on the server." }, { status: 503 });

    const admin = createAdminClient();
    const { data: course, error: courseError } = await admin.from("academy_courses")
      .select("id,title,slug,price,currency,status")
      .eq("id", courseId).eq("status", "published").maybeSingle();
    if (courseError || !course) return NextResponse.json({ error: "This course is not available for purchase." }, { status: 404 });

    const amount = Number(course.price);
    const currency = String(course.currency || "GHS").trim().toUpperCase();
    const amountSubunits = Math.round(amount * 100);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(amountSubunits) || !/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ error: "This course has an invalid price or currency. Please contact the instructor." }, { status: 400 });
    }

    const { data: existing } = await admin.from("academy_enrollments")
      .select("id,status").eq("course_id", course.id).eq("student_id", user.id).maybeSingle();
    if (existing && ["active", "completed"].includes(existing.status)) {
      return NextResponse.json({ error: "You already have access to this course.", alreadyEnrolled: true }, { status: 409 });
    }

    const reference = "NBJ-ACA-" + crypto.randomUUID().replace(/-/g, "").toUpperCase();
    const { error: insertError } = await admin.from("academy_payment_transactions").insert({
      reference, student_id: user.id, course_id: course.id, amount, currency, status: "pending"
    });
    if (insertError) return NextResponse.json({ error: "We couldn't create your course payment. Please try again." }, { status: 500 });

    // Use the configured public site URL for gateway callbacks. On hosted
    // platforms request.url can reflect an internal localhost origin.
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    const forwardedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : "";
    const origin = configuredSiteUrl || forwardedOrigin || "https://nbjcreative-hub.onrender.com";
    const paystack = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        amount: amountSubunits,
        currency,
        reference,
        callback_url: origin + "/payment/callback",
        metadata: {
          payment_type: "academy_course",
          academy_reference: reference,
          student_id: user.id,
          course_id: course.id
        }
      }),
      cache: "no-store"
    });
    const result = await paystack.json();
    if (!paystack.ok || !result?.status || !result?.data?.authorization_url) {
      await admin.from("academy_payment_transactions").update({ status: "failed" }).eq("reference", reference);
      return NextResponse.json({ error: result?.message || "Paystack could not start this payment." }, { status: 502 });
    }

    return NextResponse.json({
      authorizationUrl: result.data.authorization_url,
      reference: result.data.reference,
      courseTitle: course.title
    });
  } catch {
    return NextResponse.json({ error: "Unable to start course checkout. Please try again." }, { status: 500 });
  }
}
