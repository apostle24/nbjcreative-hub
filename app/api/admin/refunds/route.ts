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
  return { admin, userId: data.user.id };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { data, error } = await auth.admin!.from("marketplace_refund_requests")
    .select("id,order_id,customer_id,original_transaction_id,refund_reference,amount,currency,reason,customer_note,status,admin_id,admin_note,paystack_status,paystack_refund_id,requested_at,reviewed_at,processed_at,orders(reference,customer_email)")
    .order("requested_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Could not load refund requests." }, { status: 500 });
  return NextResponse.json({ refunds: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Paystack is not configured on the server." }, { status: 503 });

  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const decision = body?.decision;
    const adminNote = typeof body?.adminNote === "string" ? body.adminNote.trim().slice(0, 2000) : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
        !["approve", "reject"].includes(decision)) {
      return NextResponse.json({ error: "Invalid refund decision." }, { status: 400 });
    }

    const { data: current, error: readError } = await auth.admin!.from("marketplace_refund_requests")
      .select("id,status,original_transaction_id,refund_reference,amount,currency,customer_note,reason")
      .eq("id", id).maybeSingle();
    if (readError) return NextResponse.json({ error: "Could not read refund request." }, { status: 500 });
    if (!current) return NextResponse.json({ error: "Refund request not found." }, { status: 404 });
    if (current.status !== "requested") return NextResponse.json({ error: "This refund request has already been reviewed or processed." }, { status: 409 });

    if (decision === "reject") {
      const { data: saved, error } = await auth.admin!.from("marketplace_refund_requests")
        .update({ status: "rejected", admin_id: auth.userId, admin_note: adminNote || null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id).eq("status", "requested").select("id,status,admin_note,reviewed_at").maybeSingle();
      if (error) return NextResponse.json({ error: "Could not reject this refund request." }, { status: 500 });
      if (!saved) return NextResponse.json({ error: "The refund request changed. Refresh and try again." }, { status: 409 });
      return NextResponse.json({ ok: true, refund: saved });
    }

    // Claim the request before contacting Paystack. If the network times out,
    // the stable refund reference can be looked up instead of issuing a second refund.
    const { data: claimed, error: claimError } = await auth.admin!.from("marketplace_refund_requests")
      .update({ status: "processing", admin_id: auth.userId, admin_note: adminNote || null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id).eq("status", "requested").select("id").maybeSingle();
    if (claimError || !claimed) return NextResponse.json({ error: "This refund request could not be approved. Refresh and try again." }, { status: 409 });

    let response: Response;
    let result: any;
    try {
      response = await fetch("https://api.paystack.co/refund", {
        method: "POST",
        headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: current.original_transaction_id,
          amount: Math.round(Number(current.amount) * 100),
          reference: current.refund_reference,
          customer_note: current.customer_note || current.reason,
          merchant_note: adminNote || "Administrator-approved refund"
        }),
        cache: "no-store"
      });
      result = await response.json();
    } catch {
      // Keep processing: Paystack may have received the request. Never blindly retry.
      return NextResponse.json({ error: "Paystack did not return a response. The request remains processing; check the Paystack refund reference before taking further action." }, { status: 202 });
    }

    if (!response.ok || !result?.status || !result?.data) {
      if (response.status === 409) {
        return NextResponse.json({ error: "Paystack reports this refund reference already exists. Reconcile it in Paystack before retrying; the request remains processing." }, { status: 202 });
      }
      await auth.admin!.rpc("finalize_marketplace_refund", { p_refund_request_id: id, p_paystack_status: "failed", p_paystack_refund_id: null });
      return NextResponse.json({ error: result?.message || "Paystack could not queue this refund." }, { status: 502 });
    }

    const paystackStatus = String(result.data.status || "pending").toLowerCase();
    const { error: saveError } = await auth.admin!.rpc("finalize_marketplace_refund", {
      p_refund_request_id: id,
      p_paystack_status: ["pending", "processing", "needs_attention", "failed", "processed"].includes(paystackStatus) ? paystackStatus : "pending",
      p_paystack_refund_id: result.data.id == null ? null : String(result.data.id)
    });
    if (saveError) return NextResponse.json({ error: "Paystack accepted the refund, but its status could not be saved. The webhook will reconcile it." }, { status: 202 });
    return NextResponse.json({ ok: true, refund: { id, status: paystackStatus, reference: current.refund_reference } });
  } catch {
    return NextResponse.json({ error: "Invalid refund decision." }, { status: 400 });
  }
}
