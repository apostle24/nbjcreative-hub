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
    if (order.payment_status !== "pending") {
      return NextResponse.json({ error: "This order is no longer available for payment. Please create a new order or contact support." }, { status: 409 });
    }

    // Physical products must still have an active stock reservation before
    // a new Paystack payment session can be created.
    const { data: orderItems, error: itemsError } = await admin.from("order_items")
      .select("product_id,product_type").eq("order_id", order.id);
    if (itemsError || !orderItems) {
      return NextResponse.json({ error: "We couldn't validate the items in this order." }, { status: 500 });
    }
    const physicalItems = orderItems.filter(item => item.product_type === "physical");
    if (physicalItems.length > 0) {
      const { data: reservations, error: reservationError } = await admin
        .from("marketplace_stock_reservations")
        .select("product_id,status,expires_at")
        .eq("order_id", order.id);
      if (reservationError || !reservations) {
        return NextResponse.json({ error: "Stock reservation verification is temporarily unavailable. Please try again later." }, { status: 503 });
      }
      const activeReservations = reservations.filter(reservation =>
        reservation.status === "reserved" && new Date(reservation.expires_at).getTime() > Date.now()
      );
      const reservedProducts = new Set(activeReservations.map(reservation => reservation.product_id));
      if (activeReservations.length !== physicalItems.length ||
          physicalItems.some(item => !item.product_id || !reservedProducts.has(item.product_id))) {
        return NextResponse.json({ error: "The stock reservation for this order has expired. Please return to your cart and create a new order." }, { status: 409 });
      }
      // Give the customer a fresh 30-minute payment window when Paystack opens.
      const { error: extendError } = await admin.from("marketplace_stock_reservations")
        .update({ expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
        .eq("order_id", order.id).eq("status", "reserved");
      if (extendError) {
        return NextResponse.json({ error: "We couldn't extend the stock reservation. Please try again." }, { status: 500 });
      }
    }

    const amount = Math.round(Number(order.amount) * 100);
    const currency = String(order.currency).trim().toUpperCase();
    if (!Number.isSafeInteger(amount) || amount < 1) return NextResponse.json({ error: "This order has an invalid payment amount." }, { status: 400 });
    const reference = order.reference + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    // Use the configured public site URL for gateway callbacks. On hosted
    // platforms request.url can reflect an internal localhost origin.
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    const forwardedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : "";
    const origin = configuredSiteUrl || forwardedOrigin || "https://nbjcreative-hub.onrender.com";
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
