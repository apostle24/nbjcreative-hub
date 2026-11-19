import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const sessionClient = await createClient();
    const { data: authData, error: authError } = await sessionClient.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: "Please sign in again as an administrator." }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
    if (profileError) {
      return NextResponse.json({ ok: false, error: "Could not verify administrator permissions." }, { status: 500 });
    }
    if (profile?.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Administrator permission is required." }, { status: 403 });
    }

    const body = await request.json();
    const productId = typeof body?.productId === "string" ? body.productId.trim() : "";
    const status = body?.status;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
      return NextResponse.json({ ok: false, error: "The product ID is invalid." }, { status: 400 });
    }
    if (!["published", "archived", "draft"].includes(status)) {
      return NextResponse.json({ ok: false, error: "Choose a valid moderation decision." }, { status: 400 });
    }

    const { data: saved, error: updateError } = await adminClient
      .from("products")
      .update({ status })
      .eq("id", productId)
      .not("vendor_id", "is", null)
      .select("id,title,slug,status,vendor_id")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ ok: false, error: "The product decision could not be saved: " + updateError.message }, { status: 500 });
    }
    if (!saved) {
      return NextResponse.json({ ok: false, error: "No vendor product matched this ID. Refresh the queue and try again." }, { status: 404 });
    }
    if (saved.status !== status) {
      return NextResponse.json({ ok: false, error: "The database did not confirm the requested decision." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, product: saved });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected moderation error." }, { status: 500 });
  }
}
