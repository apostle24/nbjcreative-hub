import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in to view your orders." }, { status: 401 });

    const admin = createAdminClient();
    const { data: orders, error: ordersError } = await admin.from("orders")
      .select("id, reference, amount, currency, payment_status, fulfillment_status, paid_at, created_at")
      .eq("customer_id", user.id).order("created_at", { ascending: false });

    if (ordersError) throw ordersError;
    const orderIds = (orders || []).map(o => o.id);
    if (!orderIds.length) return NextResponse.json({ orders: [] });

    const { data: items, error: itemsError } = await admin.from("order_items")
      .select("id, order_id, product_id, product_title, quantity, unit_price, currency, product_type, item_fulfillment_status, shipping_carrier, tracking_number, tracking_url, seller_fulfillment_note, shipped_at, delivered_at")
      .in("order_id", orderIds);
    if (itemsError) throw itemsError;

    // Only attach download metadata for items belonging to currently paid orders.
    const paidOrderIds = new Set((orders || []).filter(o => o.payment_status === "paid").map(o => o.id));
    const paidItemIds = (items || []).filter(i => paidOrderIds.has(i.order_id) && i.product_type === "digital").map(i => i.id);
    const { data: entitlements, error: entitlementsError } = paidItemIds.length
      ? await admin.from("download_entitlements")
          .select("id, order_item_id, product_file_id, expires_at, max_downloads, download_count, revoked_at")
          .eq("customer_id", user.id).in("order_item_id", paidItemIds)
      : { data: [], error: null };
    if (entitlementsError) throw entitlementsError;

    const fileIds = (entitlements || []).map(e => e.product_file_id);
    const { data: files, error: filesError } = fileIds.length
      ? await admin.from("product_files").select("id, file_name, content_type, size_bytes").in("id", fileIds)
      : { data: [], error: null };
    if (filesError) throw filesError;

    const fileMap = new Map((files || []).map(f => [f.id, f]));
    const entitlementMap = new Map<string, any[]>();
    for (const entitlement of entitlements || []) {
      const list = entitlementMap.get(entitlement.order_item_id) || [];
      list.push({ ...entitlement, file: fileMap.get(entitlement.product_file_id) || null });
      entitlementMap.set(entitlement.order_item_id, list);
    }

    const itemsByOrder = new Map<string, any[]>();
    for (const item of items || []) {
      const list = itemsByOrder.get(item.order_id) || [];
      list.push({ ...item, downloads: entitlementMap.get(item.id) || [] });
      itemsByOrder.set(item.order_id, list);
    }

    return NextResponse.json({
      orders: (orders || []).map(order => ({ ...order, items: itemsByOrder.get(order.id) || [] }))
    });
  } catch {
    return NextResponse.json({ error: "Unable to load your order history." }, { status: 500 });
  }
}
