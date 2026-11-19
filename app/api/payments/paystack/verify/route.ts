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
    if (!response.ok || !result?.status || !result?.data) return NextResponse.json({ error: result?.message || "We could not verify this transaction." }, { status: 502 });
    const payment = result.data;
    const orderReference = payment?.metadata?.order_reference;
    if (payment.status !== "success" || typeof orderReference !== "string") {
      return NextResponse.json({ error: "Payment is not successful yet. Your order remains unpaid." }, { status: 409 });
    }

    const admin = createAdminClient();
    const { data: order, error } = await admin.from("orders")
      .select("id, reference, customer_id, amount, currency, payment_status")
      .eq("reference", orderReference).eq("customer_id", user.id).maybeSingle();
    if (error || !order) return NextResponse.json({ error: "The payment does not match an order in your account." }, { status: 404 });

    const expectedAmount = Math.round(Number(order.amount) * 100);
    const expectedCurrency = String(order.currency).trim().toUpperCase();
    if (Number(payment.amount) !== expectedAmount || String(payment.currency).toUpperCase() !== expectedCurrency) {
      return NextResponse.json({ error: "The verified payment amount or currency does not match this order. Contact support before trying again." }, { status: 409 });
    }
    if (order.payment_status !== "paid") {
      const { error: updateError } = await admin.from("orders")
        .update({ payment_status: "paid", paid_at: new Date().toISOString() })
        .eq("id", order.id).eq("payment_status", "pending");
      if (updateError) return NextResponse.json({ error: "Payment was verified, but the order update needs attention." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, orderReference: order.reference, amount: order.amount, currency: expectedCurrency });
  } catch {
    return NextResponse.json({ error: "Unable to verify this payment. Please try again." }, { status: 500 });
  }
}
