import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in to pay for this order." }, { status: 401 });
    const body = await request.json();
    const orderReference = typeof body?.orderReference === "string" ? body.orderReference.trim() : "";
    if (!orderReference) return NextResponse.json({ error: "Order reference is required." }, { status: 400 });
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "Paystack is not configured on the server." }, { status: 503 });

    const admin = createAdminClient();
    const { data: order, error } = await admin.from("orders")
      .select("id, reference, customer_id, customer_email, amount, currency, payment_status")
      .eq("reference", orderReference).eq("customer_id", user.id).maybeSingle();
    if (error || !order) return NextResponse.json({ error: "We could not find this order in your account." }, { status: 404 });
    if (order.payment_status === "paid") return NextResponse.json({ error: "This order has already been paid." }, { status: 409 });

    const amount = Math.round(Number(order.amount) * 100);
    const currency = String(order.currency).trim().toUpperCase();
    if (!Number.isSafeInteger(amount) || amount < 1) return NextResponse.json({ error: "This order has an invalid payment amount." }, { status: 400 });
    const reference = order.reference + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const origin = new URL(request.url).origin;
    const paystack = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: order.customer_email, amount, currency, reference,
        callback_url: origin + "/payment/callback",
        metadata: { order_reference: order.reference, order_id: order.id, customer_id: user.id }
      }),
      cache: "no-store"
    });
    const result = await paystack.json();
    if (!paystack.ok || !result?.status || !result?.data?.authorization_url) {
      return NextResponse.json({ error: result?.message || "Paystack could not initialize this payment." }, { status: 502 });
    }
    return NextResponse.json({ authorizationUrl: result.data.authorization_url, reference: result.data.reference });
  } catch {
    return NextResponse.json({ error: "Unable to start Paystack checkout. Please try again." }, { status: 500 });
  }
}
