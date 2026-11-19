import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in to verify your payment." }, { status: 401 });

    const body = await request.json();
    const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
    if (!reference) return NextResponse.json({ error: "Payment reference is missing." }, { status: 400 });

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "Paystack is not configured on the server." }, { status: 503 });

    const response = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), {
      headers: { Authorization: "Bearer " + secret }, cache: "no-store"
    });
    const result = await response.json();
    if (!response.ok || !result?.status || !result?.data) {
      return NextResponse.json({ error: result?.message || "We could not verify this transaction." }, { status: 502 });
    }

    const payment = result.data;
    const metadata = payment.metadata || {};
    const orderReference = typeof metadata.order_reference === "string" ? metadata.order_reference : "";
    if (payment.status !== "success" || !orderReference) {
      return NextResponse.json({ error: "Payment is not successful yet. Your order remains unpaid." }, { status: 409 });
    }

    const admin = createAdminClient();
    const { data: order, error: orderError } = await admin.from("orders")
      .select("id, reference, customer_id, customer_email")
      .eq("reference", orderReference).eq("customer_id", user.id).maybeSingle();

    if (orderError || !order || metadata.customer_id !== user.id || metadata.order_id !== order.id) {
      return NextResponse.json({ error: "The payment does not match an order in your account." }, { status: 404 });
    }

    const { data, error } = await admin.rpc("fulfill_paystack_payment", {
      p_order_reference: order.reference,
      p_transaction_id: String(payment.id),
      p_event_id: "callback:" + String(payment.id),
      p_amount_subunits: Number(payment.amount),
      p_currency: String(payment.currency),
      p_safe_metadata: {
        channel: typeof payment.channel === "string" ? payment.channel : null,
        gateway_response: typeof payment.gateway_response === "string" ? payment.gateway_response : null
      }
    });

    if (error || !data?.[0]) {
      return NextResponse.json({ error: "Payment was verified, but the order could not be updated. Please contact support." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      orderReference: order.reference,
      alreadyPaid: data[0].already_paid
    });
  } catch {
    return NextResponse.json({ error: "Unable to verify this payment. Please try again." }, { status: 500 });
  }
}
