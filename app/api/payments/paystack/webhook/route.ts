import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function validSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const supplied = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer);
}

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Payment service is not configured." }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";
  if (!signature || !validSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (event?.event !== "charge.success" || !event?.data?.reference) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    // Never trust the webhook body alone. Confirm the transaction directly with Paystack.
    const verifyResponse = await fetch(
      "https://api.paystack.co/transaction/verify/" + encodeURIComponent(String(event.data.reference)),
      { headers: { Authorization: "Bearer " + secret }, cache: "no-store" }
    );
    const verification = await verifyResponse.json();
    const payment = verification?.data;

    if (!verifyResponse.ok || !verification?.status || payment?.status !== "success") {
      return NextResponse.json({ error: "Paystack transaction is not verified." }, { status: 409 });
    }

    const metadata = payment.metadata || {};
    const orderReference = typeof metadata.order_reference === "string" ? metadata.order_reference : "";
    const transactionId = String(payment.id || "");
    const eventId = "charge.success:" + transactionId;

    if (!orderReference || !transactionId || !payment.amount || !payment.currency) {
      return NextResponse.json({ error: "Verified transaction is missing required order details." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("fulfill_paystack_payment", {
      p_order_reference: orderReference,
      p_transaction_id: transactionId,
      p_event_id: eventId,
      p_amount_subunits: Number(payment.amount),
      p_currency: String(payment.currency),
      p_safe_metadata: {
        channel: typeof payment.channel === "string" ? payment.channel : null,
        gateway_response: typeof payment.gateway_response === "string" ? payment.gateway_response : null
      }
    });

    if (error || !data?.[0]) {
      return NextResponse.json({ error: "Verified payment could not be applied to the order." }, { status: 500 });
    }

    return NextResponse.json({ received: true, processed: true });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed. Paystack can retry this notification." }, { status: 500 });
  }
}
