import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ entitlementId: string }> }
) {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to access your downloads." }, { status: 401 });

    const { entitlementId } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entitlementId)) {
      return NextResponse.json({ error: "Invalid download request." }, { status: 400 });
    }

    // This RPC verifies ownership, paid order status, digital product type,
    // expiry and remaining downloads, then atomically consumes one attempt.
    const { data, error } = await session.rpc("consume_download_entitlement", {
      p_entitlement_id: entitlementId
    });
    if (error || !data?.[0]) {
      return NextResponse.json({ error: error?.message || "This download is not available." }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: signed, error: signedError } = await admin.storage
      .from("product-downloads")
      .createSignedUrl(data[0].storage_path, 60, { download: data[0].file_name });

    if (signedError || !signed?.signedUrl) {
      // Restore the consumed attempt if storage could not issue a URL.
      // This service-role-only RPC can only decrement an existing count.
      await admin.rpc("restore_download_entitlement", { p_entitlement_id: entitlementId });
      return NextResponse.json({ error: "We could not prepare your secure download. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ url: signed.signedUrl, expiresIn: 60 });
  } catch {
    return NextResponse.json({ error: "Unable to prepare this download." }, { status: 500 });
  }
}
