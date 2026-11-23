import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ deliverableId: string }> }
) {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to access this delivery." }, { status: 401 });

    const { deliverableId } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deliverableId)) {
      return NextResponse.json({ error: "Invalid delivery request." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: file, error: fileError } = await admin.from("service_deliverables")
      .select("id,order_item_id,file_name,storage_path")
      .eq("id", deliverableId).maybeSingle();
    if (fileError) throw fileError;
    if (!file) return NextResponse.json({ error: "This delivery file was not found." }, { status: 404 });

    const { data: item, error: itemError } = await admin.from("order_items")
      .select("id,order_id,product_type,service_status").eq("id", file.order_item_id).maybeSingle();
    if (itemError) throw itemError;
    if (!item || item.product_type !== "online_service" || !["submitted", "completed"].includes(item.service_status)) return NextResponse.json({ error: "This delivery is unavailable." }, { status: 404 });

    const { data: order, error: orderError } = await admin.from("orders")
      .select("customer_id,payment_status").eq("id", item.order_id).maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.customer_id !== user.id || order.payment_status !== "paid") {
      return NextResponse.json({ error: "You are not authorised to access this delivery." }, { status: 403 });
    }

    const { data: signed, error: signedError } = await admin.storage.from("service-deliverables")
      .createSignedUrl(file.storage_path, 60, { download: file.file_name });
    if (signedError || !signed?.signedUrl) throw signedError || new Error("Could not create a secure download link.");
    return NextResponse.json({ url: signed.signedUrl, expiresIn: 60 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to prepare this secure delivery download." }, { status: 500 });
  }
}
