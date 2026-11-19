import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedStatuses = ["pending", "approved", "rejected", "suspended"] as const;

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
    const vendorId = typeof body.vendorId === "string" ? body.vendorId : "";
    const status = body.status;
    const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote.trim() : "";

    if (!vendorId || !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "A valid vendor ID and status are required." }, { status: 400 });
    }

    const { data: updated, error: updateError } = await admin
      .from("vendor_profiles")
      .update({
        status,
        review_note: reviewNote || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", vendorId)
      .select("id,status,review_note,reviewed_at")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ vendor: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update vendor application.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
