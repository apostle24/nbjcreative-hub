import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in to view refund requests." }, { status: 401 });
    const admin = createAdminClient();
    const { data, error } = await admin.from("marketplace_refund_requests")
      .select("id,order_id,refund_reference,amount,currency,reason,customer_note,status,admin_note,requested_at,reviewed_at,processed_at")
      .eq("customer_id", user.id).order("requested_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Could not load refund requests." }, { status: 500 });
    return NextResponse.json({ refunds: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Unable to load refund requests." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in before requesting a refund." }, { status: 401 });

    const body = await request.json();
    const orderReference = typeof body?.orderReference === "string" ? body.orderReference.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    if (!orderReference || reason.length < 3 || reason.length > 80 || note.length > 2000) {
      return NextResponse.json({ error: "Provide an order reference, a reason (3–80 characters), and an optional note (up to 2,000 characters)." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: order, error: orderError } = await admin.from("orders")
      .select("id,reference,customer_id,amount,currency,payment_status,provider")
      .eq("reference", orderReference).eq("customer_id", user.id).maybeSingle();
    if (orderError || !order) return NextResponse.json({ error: "We could not find that order in your account." }, { status: 404 });
    if (order.payment_status !== "paid" || order.provider !== "paystack") {
      return NextResponse.json({ error: "Only successfully paid Paystack orders can be submitted for refund." }, { status: 409 });
    }

    const { data: paymentEvent, error: paymentError } = await admin.from("payment_events")
      .select("safe_metadata").eq("provider", "paystack").eq("reference", order.reference)
      .eq("verified", true).eq("processing_status", "processed")
      .order("received_at", { ascending: false }).limit(1).maybeSingle();
    const transactionId = paymentEvent?.safe_metadata?.transaction_id;
    if (paymentError || !transactionId) {
      return NextResponse.json({ error: "We could not verify the original Paystack transaction. Please contact support." }, { status: 409 });
    }

    const { data: items, error: itemsError } = await admin.from("order_items")
      .select("id,vendor_id").eq("order_id", order.id);
    if (itemsError || !items?.length) return NextResponse.json({ error: "We could not validate the order items." }, { status: 500 });

    // Do not refund while vendor payouts for this order's sellers are awaiting settlement.
    const vendorIds = [...new Set(items.map(item => item.vendor_id).filter(Boolean))];
    if (vendorIds.length) {
      const { data: activePayouts, error: payoutError } = await admin.from("vendor_payout_requests")
        .select("id").in("vendor_id", vendorIds).in("status", ["pending", "approved"]).limit(1);
      if (payoutError) return NextResponse.json({ error: "Vendor settlement status could not be checked. Please try again." }, { status: 503 });
      if (activePayouts?.length) {
        return NextResponse.json({ error: "This order cannot be refunded automatically while one of its sellers has a payout awaiting settlement. Please contact support for a manual review." }, { status: 409 });
      }
    }

    const refundReference = "NBJRF-" + crypto.randomUUID().replace(/-/g, "").toUpperCase();
    const { data: refund, error: insertError } = await admin.from("marketplace_refund_requests")
      .insert({
        order_id: order.id, customer_id: user.id, original_transaction_id: String(transactionId),
        refund_reference: refundReference, amount: order.amount, currency: order.currency,
        reason, customer_note: note || null
      })
      .select("id,order_id,refund_reference,amount,currency,reason,customer_note,status,requested_at")
      .single();

    if (insertError) {
      if (insertError.code === "23505") return NextResponse.json({ error: "A refund request already exists for this order." }, { status: 409 });
      return NextResponse.json({ error: "Could not submit your refund request." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, refund }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to submit this refund request." }, { status: 500 });
  }
}
