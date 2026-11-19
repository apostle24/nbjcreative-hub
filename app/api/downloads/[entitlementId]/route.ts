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

    // The database function checks ownership and consumes one download atomically.
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
      return NextResponse.json({ error: "We could not prepare your secure download. Please contact support." }, { status: 500 });
    }

    return NextResponse.json({ url: signed.signedUrl, expiresIn: 60 });
  } catch {
    return NextResponse.json({ error: "Unable to prepare this download." }, { status: 500 });
  }
}
