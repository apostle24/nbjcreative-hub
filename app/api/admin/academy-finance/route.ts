import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function getAdmin() {
  const session = await createClient();
  const { data: auth, error: authError } = await session.auth.getUser();
  if (authError || !auth.user) return { response: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (error) return { response: NextResponse.json({ error: "Could not verify administrator access." }, { status: 500 }) };
  if (profile?.role !== "admin") return { response: NextResponse.json({ error: "Administrator permission is required." }, { status: 403 }) };
  return { admin };
}

export async function GET() {
  const access = await getAdmin();
  if ("response" in access) return access.response;
  const [earnings, payouts] = await Promise.all([
    access.admin.from("academy_instructor_earnings").select("id,instructor_id,course_id,currency,gross_amount,platform_fee_amount,instructor_amount,status,created_at,reconciled_at").order("created_at", { ascending: false }).limit(500),
    access.admin.from("academy_instructor_payout_requests").select("id,instructor_id,currency,amount,payout_method,account_name,account_details,status,instructor_note,admin_note,requested_at,reviewed_at,paid_at").order("requested_at", { ascending: false }).limit(300)
  ]);
  if (earnings.error || payouts.error) return NextResponse.json({ error: "Could not load Academy finance records." }, { status: 500 });
  const instructorIds = [...new Set([...(earnings.data ?? []).map(x => x.instructor_id), ...(payouts.data ?? []).map(x => x.instructor_id)])];
  const courseIds = [...new Set((earnings.data ?? []).map(x => x.course_id))];
  const [profiles, courses] = await Promise.all([
    instructorIds.length ? access.admin.from("profiles").select("id,email,full_name").in("id", instructorIds) : Promise.resolve({ data: [], error: null }),
    courseIds.length ? access.admin.from("academy_courses").select("id,title").in("id", courseIds) : Promise.resolve({ data: [], error: null })
  ]);
  const profileMap = new Map((profiles.data ?? []).map(x => [x.id, { email: x.email, name: x.full_name }]));
  const courseMap = new Map((courses.data ?? []).map(x => [x.id, x.title]));
  return NextResponse.json({
    earnings: (earnings.data ?? []).map(x => ({ ...x, instructor: profileMap.get(x.instructor_id) ?? null, course_title: courseMap.get(x.course_id) ?? "Course" })),
    payouts: (payouts.data ?? []).map(x => ({ ...x, instructor: profileMap.get(x.instructor_id) ?? null }))
  });
}

export async function PATCH(request: Request) {
  const access = await getAdmin();
  if ("response" in access) return access.response;
  try {
    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const id = typeof body?.id === "string" ? body.id : "";
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";

    if (action === "reconcile") {
      const fee = Number(body.platformFee);
      if (!id || !Number.isFinite(fee) || fee < 0) return NextResponse.json({ error: "Enter a valid platform fee." }, { status: 400 });
      const { error } = await access.admin.rpc("admin_reconcile_academy_earning", {
        p_admin_id: (await createClient()).auth.getUser().then(({data}) => data.user?.id),
        p_earning_id: id,
        p_platform_fee: fee
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 409 });
      return NextResponse.json({ ok: true });
    }

    if (action === "payout") {
      const status = body.status;
      if (!id || !["approved", "rejected", "paid"].includes(status)) return NextResponse.json({ error: "Invalid payout action." }, { status: 400 });
      const session = await createClient();
      const { data: auth } = await session.auth.getUser();
      if (!auth.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
      const { error } = await access.admin.rpc("admin_update_academy_payout", {
        p_admin_id: auth.user.id,
        p_payout_id: id,
        p_status: status,
        p_note: note || null
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unsupported finance action." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unexpected finance operation error." }, { status: 500 });
  }
}
