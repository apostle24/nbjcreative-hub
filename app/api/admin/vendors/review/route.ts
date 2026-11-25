import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVendorReviewStatus } from "@/lib/vendor-review";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }

    const body = await request.json();
    const vendorId = typeof body?.vendorId === "string" ? body.vendorId.trim() : "";
    const expectedStatus = body?.expectedStatus;
    const status = body?.status;
    const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote.trim().slice(0, 2000) : "";

    if (!UUID.test(vendorId) || !isVendorReviewStatus(expectedStatus) || !isVendorReviewStatus(status)) {
      return NextResponse.json({ error: "A valid vendor ID, current status and decision are required." }, { status: 400 });
    }

    // Compare-and-set: reject stale admin screens instead of overwriting a
    // decision another administrator has already made.
    const { data: updated, error: updateError } = await admin
      .from("vendor_profiles")
      .update({
        status,
        review_note: reviewNote || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", vendorId)
      .eq("status", expectedStatus)
      .select("id,status,review_note,reviewed_at")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) {
      return NextResponse.json(
        { error: "This vendor application has changed since you opened it. Refresh the list and review the latest status." },
        { status: 409 }
      );
    }

    return NextResponse.json({ vendor: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update vendor application.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
