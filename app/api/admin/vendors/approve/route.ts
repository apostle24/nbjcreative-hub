import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Confirm the request belongs to a signed-in user.
    const sessionClient = await createClient();
    const { data: authData, error: authError } = await sessionClient.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: "Please sign in again as an administrator." }, { status: 401 });
    }

    // 2. Verify administrator role using the server-only service key.
    const adminClient = createAdminClient();
    const { data: adminProfile, error: adminError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (adminError) {
      return NextResponse.json({ ok: false, error: "Could not verify administrator permissions: " + adminError.message }, { status: 500 });
    }
    if (adminProfile?.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Administrator permission is required." }, { status: 403 });
    }

    // 3. Validate the application ID.
    const body = await request.json();
    const vendorId = typeof body?.vendorId === "string" ? body.vendorId.trim() : "";
    const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote.trim().slice(0, 2000) : "";

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
      return NextResponse.json({ ok: false, error: "The vendor application ID is invalid." }, { status: 400 });
    }

    // 4. Update only this application and require Supabase to return the saved row.
    const { data: saved, error: saveError } = await adminClient
      .from("vendor_profiles")
      .update({
        status: "approved",
        review_note: reviewNote || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", vendorId)
      .select("id,owner_id,store_name,store_slug,status,review_note,reviewed_at")
      .maybeSingle();

    if (saveError) {
      return NextResponse.json({ ok: false, error: "Database could not approve this application: " + saveError.message }, { status: 500 });
    }
    if (!saved) {
      return NextResponse.json({ ok: false, error: "No vendor application matched this ID. Refresh the page and try again." }, { status: 404 });
    }
    if (saved.status !== "approved") {
      return NextResponse.json({ ok: false, error: "The database did not confirm approval." }, { status: 409 });
    }

    return NextResponse.json({ ok: true, vendor: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected approval error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
