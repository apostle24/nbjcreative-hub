import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function safeHexEqual(expected: Buffer, suppliedHex: string) {
  if (!/^[0-9a-f]{128}$/i.test(suppliedHex)) return false;
  const supplied = Buffer.from(suppliedHex, "hex");
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}
function validLegacySignature(rawBody: Buffer, signature: string, secret: string) {
  return safeHexEqual(createHmac("sha512", secret).update(rawBody).digest(), signature);
}
function validSigningSecretSignature(rawBody: Buffer, header: string, secret: string) {
  const parts = header.split(",");
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") {
      if (timestamp !== null || !/^\d+$/.test(value)) return false;
      timestamp = Number(value);
    } else if (key === "v1") {
      const colon = value.indexOf(":");
      if (colon >= 0) signatures.push(value.slice(colon + 1));
    }
  }
  if (timestamp === null || signatures.length === 0 || !Number.isSafeInteger(timestamp) ||
      Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;
  const expected = createHmac("sha512", secret).update(String(timestamp) + ".").update(rawBody).digest();
  return signatures.some(signature => safeHexEqual(expected, signature));
}

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Payment service is not configured." }, { status: 503 });
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signingSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  const modernSignature = request.headers.get("paystack-signature") || "";
  const legacySignature = request.headers.get("x-paystack-signature") || "";
  const signatureValid = modernSignature
    ? Boolean(signingSecret && validSigningSecretSignature(rawBody, modernSignature, signingSecret))
    : Boolean(legacySignature && validLegacySignature(rawBody, legacySignature, secret));
  if (!signatureValid) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });

  let event: any;
  try { event = JSON.parse(rawBody.toString("utf8")); }
  catch { return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 }); }

  const refundEvents: Record<string, string> = {
    "refund.pending": "pending",
    "refund.processing": "processing",
    "refund.needs-attention": "needs_attention",
    "refund.failed": "failed",
    "refund.processed": "processed"
  };
  if (event?.event && refundEvents[event.event]) {
    const data = event.data || {};
    const refundReference = typeof data.refund_reference === "string" ? data.refund_reference : "";
    if (!refundReference) return NextResponse.json({ received: true, ignored: true });
    const admin = createAdminClient();
    const { data: refund, error: lookupError } = await admin.from("marketplace_refund_requests")
      .select("id").eq("refund_reference", refundReference).maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Could not find refund request." }, { status: 500 });
    if (!refund) return NextResponse.json({ received: true, ignored: true });
    const { error } = await admin.rpc("finalize_marketplace_refund", {
      p_refund_request_id: refund.id,
      p_paystack_status: refundEvents[event.event],
      p_paystack_refund_id: data.id == null ? null : String(data.id)
    });
    if (error) return NextResponse.json({ error: "Could not update refund status." }, { status: 500 });
    return NextResponse.json({ received: true, processed: true, type: "refund" });
  }

  if (event?.event !== "charge.success" || !event?.data?.reference) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    const verifyResponse = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(String(event.data.reference)), {
      headers: { Authorization: "Bearer " + secret }, cache: "no-store"
    });
    const verification = await verifyResponse.json();
    const payment = verification?.data;
    if (!verifyResponse.ok || !verification?.status || payment?.status !== "success") {
      return NextResponse.json({ error: "Paystack transaction is not verified." }, { status: 409 });
    }
    const metadata = payment.metadata || {};
    if (metadata.payment_type === "academy_course") {
      const academyReference = typeof metadata.academy_reference === "string" ? metadata.academy_reference : "";
      const transactionId = String(payment.id || "");
      if (!academyReference || !transactionId || !payment.amount || !payment.currency) {
        return NextResponse.json({ error: "Verified Academy payment is missing required details." }, { status: 400 });
      }
      const admin = createAdminClient();
      const { data, error } = await admin.rpc("fulfill_academy_course_payment", {
        p_reference: academyReference, p_transaction_id: transactionId,
        p_amount_subunits: Number(payment.amount), p_currency: String(payment.currency)
      });
      if (error || !data?.[0]) return NextResponse.json({ error: "Verified Academy payment could not be applied." }, { status: 500 });
      return NextResponse.json({ received: true, processed: true, type: "academy_course" });
    }
    const orderReference = typeof metadata.order_reference === "string" ? metadata.order_reference : "";
    const transactionId = String(payment.id || "");
    if (!orderReference || !transactionId || !payment.amount || !payment.currency) {
      return NextResponse.json({ error: "Verified transaction is missing required order details." }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("fulfill_paystack_payment", {
      p_order_reference: orderReference, p_transaction_id: transactionId,
      p_event_id: "charge.success:" + transactionId, p_amount_subunits: Number(payment.amount),
      p_currency: String(payment.currency),
      p_safe_metadata: {
        channel: typeof payment.channel === "string" ? payment.channel : null,
        gateway_response: typeof payment.gateway_response === "string" ? payment.gateway_response : null
      }
    });
    if (error || !data?.[0]) return NextResponse.json({ error: "Verified payment could not be applied to the order." }, { status: 500 });
    return NextResponse.json({ received: true, processed: true });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed. Paystack can retry this notification." }, { status: 500 });
  }
}
