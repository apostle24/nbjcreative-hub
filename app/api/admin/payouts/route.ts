import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await createClient();
  const { data, error } = await session.auth.getUser();
  if (error || !data.user) return { error: NextResponse.json({ error: "Administrator sign-in required." }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profileError) return { error: NextResponse.json({ error: "Could not verify administrator access." }, { status: 500 }) };
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "Administrator permission is required." }, { status: 403 }) };
  return { admin };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { data, error } = await auth.admin!.from("vendor_payout_requests")
    .select("id,vendor_id,amount,currency,status,vendor_note,admin_note,requested_at,reviewed_at,paid_at,vendor_profiles(store_name,store_slug,contact_email)")
    .order("requested_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Could not load payout requests: " + error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const status = body?.status;
    const adminNote = typeof body?.adminNote === "string" ? body.adminNote.trim().slice(0, 1000) : "";
    const confirmsExternalPayment = body?.confirmsExternalPayment === true;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid payout request ID." }, { status: 400 });
    }
    if (!["approved", "rejected", "paid"].includes(status)) {
      return NextResponse.json({ error: "Choose approve, reject or mark paid." }, { status: 400 });
    }
    if (status === "paid" && !confirmsExternalPayment) {
      return NextResponse.json({ error: "Confirm that the transfer has already been completed outside NBJCreative Hub." }, { status: 400 });
    }
    const { data: current, error: readError } = await auth.admin!.from("vendor_payout_requests")
      .select("id,status").eq("id", id).maybeSingle();
    if (readError) return NextResponse.json({ error: "Could not read payout request." }, { status: 500 });
    if (!current) return NextResponse.json({ error: "Payout request not found." }, { status: 404 });
    if (current.status === "rejected" || current.status === "paid") {
      return NextResponse.json({ error: "This payout request is already closed." }, { status: 409 });
    }
    if (status === "paid" && current.status !== "approved") {
      return NextResponse.json({ error: "Approve the request before marking it paid." }, { status: 409 });
    }
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { status, admin_note: adminNote || null, reviewed_at: now };
    if (status === "paid") update.paid_at = now;
    const { data: saved, error: updateError } = await auth.admin!.from("vendor_payout_requests")
      .update(update).eq("id", id).select("id,status,admin_note,reviewed_at,paid_at").maybeSingle();
    if (updateError) return NextResponse.json({ error: "Could not save payout decision: " + updateError.message }, { status: 500 });
    if (!saved || saved.status !== status) return NextResponse.json({ error: "The database did not confirm the payout decision." }, { status: 409 });
    return NextResponse.json({ ok: true, request: saved });
  } catch {
    return NextResponse.json({ error: "Invalid payout request." }, { status: 400 });
  }
}
