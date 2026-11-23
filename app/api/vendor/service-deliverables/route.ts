import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES_PER_ORDER_ITEM = 10;
const ALLOWED_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function safeName(name: string) {
  return name.normalize("NFKC").replace(/[\\/\\\\]/g, "-")
    .replace(/[^a-zA-Z0-9._ -]/g, "-").trim().slice(0, 180) || "delivery-file";
}

export async function GET() {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const admin = createAdminClient();
    const { data: vendor, error: vendorError } = await admin.from("vendor_profiles")
      .select("id,status").eq("owner_id", user.id).maybeSingle();
    if (vendorError) throw vendorError;
    if (!vendor || vendor.status !== "approved") return NextResponse.json({ error: "An approved seller account is required." }, { status: 403 });

    const { data, error } = await admin.from("service_deliverables")
      .select("id,order_item_id,file_name,content_type,size_bytes,created_at")
      .eq("vendor_id", vendor.id).order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ deliverables: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load service delivery files." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const form = await request.formData();
    const orderItemId = String(form.get("orderItemId") || "");
    const file = form.get("file");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderItemId)) {
      return NextResponse.json({ error: "Invalid service order." }, { status: 400 });
    }
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Each file must be no larger than 50 MB." }, { status: 400 });

    const name = safeName(file.name);
    const extension = name.toLowerCase().match(/\\.[a-z0-9]+$/)?.[0] || "";
    const expectedType = ALLOWED_TYPES[extension];
    if (!expectedType || (file.type && file.type !== expectedType && !(extension === ".zip" && file.type === "application/x-zip-compressed"))) {
      return NextResponse.json({ error: "Unsupported file type. Use PDF, Office documents, ZIP, TXT, CSV, JPG, PNG or WebP." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: vendor, error: vendorError } = await admin.from("vendor_profiles")
      .select("id,status").eq("owner_id", user.id).maybeSingle();
    if (vendorError) throw vendorError;
    if (!vendor || vendor.status !== "approved") return NextResponse.json({ error: "An approved seller account is required." }, { status: 403 });

    const { data: item, error: itemError } = await admin.from("order_items")
      .select("id,order_id,vendor_id,product_type,service_status")
      .eq("id", orderItemId).maybeSingle();
    if (itemError) throw itemError;
    if (!item || item.vendor_id !== vendor.id || item.product_type !== "online_service") {
      return NextResponse.json({ error: "This service order does not belong to your store." }, { status: 403 });
    }
    const { data: order, error: orderError } = await admin.from("orders")
      .select("payment_status").eq("id", item.order_id).maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.payment_status !== "paid") return NextResponse.json({ error: "Files can only be added to paid service orders." }, { status: 403 });
    if (item.service_status !== "in_progress") return NextResponse.json({ error: "Start or resume the service before uploading delivery files." }, { status: 409 });

    const { count, error: countError } = await admin.from("service_deliverables")
      .select("id", { count: "exact", head: true }).eq("order_item_id", orderItemId);
    if (countError) throw countError;
    if ((count || 0) >= MAX_FILES_PER_ORDER_ITEM) return NextResponse.json({ error: "This service order already has the maximum of 10 delivery files." }, { status: 409 });

    uploadedPath = orderItemId + "/" + crypto.randomUUID() + "-" + name;
    const { error: uploadError } = await admin.storage.from("service-deliverables")
      .upload(uploadedPath, new Uint8Array(await file.arrayBuffer()), {
        contentType: expectedType,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: record, error: insertError } = await admin.from("service_deliverables").insert({
      order_item_id: orderItemId,
      vendor_id: vendor.id,
      uploaded_by: user.id,
      file_name: name,
      storage_path: uploadedPath,
      content_type: expectedType,
      size_bytes: file.size,
    }).select("id,order_item_id,file_name,content_type,size_bytes,created_at").single();
    if (insertError) {
      await admin.storage.from("service-deliverables").remove([uploadedPath]);
      uploadedPath = null;
      throw insertError;
    }

    return NextResponse.json({ deliverable: record }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (uploadedPath) {
      try { await createAdminClient().storage.from("service-deliverables").remove([uploadedPath]); } catch {}
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload this delivery file." }, { status: 500 });
  }
}
