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
      const { data: row, error: readError } = await access.admin.from("academy_instructor_earnings").select("id,gross_amount,status").eq("id", id).maybeSingle();
      if (readError || !row) return NextResponse.json({ error: "Earning record not found." }, { status: 404 });
      if (row.status !== "pending_review") return NextResponse.json({ error: "This earning has already been reconciled." }, { status: 409 });
      const gross = Number(row.gross_amount);
      if (fee >= gross) return NextResponse.json({ error: "Platform fee must be less than the gross payment." }, { status: 400 });
      const { error } = await access.admin.from("academy_instructor_earnings").update({
        platform_fee_amount: fee,
        instructor_amount: Number((gross - fee).toFixed(2)),
        status: "available",
        reconciled_at: new Date().toISOString()
      }).eq("id", id).eq("status", "pending_review");
      if (error) return NextResponse.json({ error: "Could not reconcile this earning: " + error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "payout") {
      const status = body.status;
      if (!id || !["approved", "rejected", "paid"].includes(status)) return NextResponse.json({ error: "Invalid payout action." }, { status: 400 });
      const { data: payout, error: readError } = await access.admin.from("academy_instructor_payout_requests").select("id,status").eq("id", id).maybeSingle();
      if (readError || !payout) return NextResponse.json({ error: "Payout request not found." }, { status: 404 });
      const now = new Date().toISOString();
      if (status === "approved" && payout.status !== "pending") return NextResponse.json({ error: "Only pending requests can be approved." }, { status: 409 });
      if (status === "rejected" && payout.status !== "pending") return NextResponse.json({ error: "Only pending requests can be rejected." }, { status: 409 });
      if (status === "paid" && payout.status !== "approved") return NextResponse.json({ error: "Only approved requests can be marked paid." }, { status: 409 });
      const update: Record<string, unknown> = { status, admin_note: note || null };
      if (status === "approved" || status === "rejected") update.reviewed_at = now;
      if (status === "paid") update.paid_at = now;
      const { error } = await access.admin.from("academy_instructor_payout_requests").update(update).eq("id", id).eq("status", payout.status);
      if (error) return NextResponse.json({ error: "Could not update payout request: " + error.message }, { status: 500 });
      if (status === "paid") {
        const { error: ledgerError } = await access.admin.from("academy_instructor_earnings").update({ status: "paid" }).eq("payout_request_id", id).eq("status", "requested");
        if (ledgerError) return NextResponse.json({ error: "Payout marked paid, but the earnings ledger needs reconciliation: " + ledgerError.message }, { status: 500 });
      }
      if (status === "rejected") {
        const { error: ledgerError } = await access.admin.from("academy_instructor_earnings").update({ status: "available", payout_request_id: null }).eq("payout_request_id", id).eq("status", "requested");
        if (ledgerError) return NextResponse.json({ error: "Request rejected, but the earnings balance needs reconciliation: " + ledgerError.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unsupported finance action." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unexpected finance operation error." }, { status: 500 });
  }
}
