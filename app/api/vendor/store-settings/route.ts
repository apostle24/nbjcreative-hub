import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const sessionClient = await createClient();
    const { data: authData, error: authError } = await sessionClient.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: "Please sign in to update your store." }, { status: 401 });
    }

    const body = await request.json();
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const contactEmail = typeof body?.contactEmail === "string" ? body.contactEmail.trim() : "";
    const websiteUrl = typeof body?.websiteUrl === "string" ? body.websiteUrl.trim() : "";

    if (description.length > 1000) {
      return NextResponse.json({ ok: false, error: "Store description must be 1,000 characters or fewer." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || contactEmail.length > 254) {
      return NextResponse.json({ ok: false, error: "Enter a valid store contact email." }, { status: 400 });
    }
    if (websiteUrl && websiteUrl.length > 500) {
      return NextResponse.json({ ok: false, error: "Website address is too long." }, { status: 400 });
    }
    if (websiteUrl) {
      try {
        const parsed = new URL(websiteUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
      } catch {
        return NextResponse.json({ ok: false, error: "Enter a valid website address beginning with https:// or http://." }, { status: 400 });
      }
    }

    const adminClient = createAdminClient();
    const { data: saved, error: updateError } = await adminClient
      .from("vendor_profiles")
      .update({
        description: description || null,
        contact_email: contactEmail,
        website_url: websiteUrl || null
      })
      .eq("owner_id", authData.user.id)
      .eq("status", "approved")
      .select("id,store_name,store_slug,description,contact_email,website_url,status")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ ok: false, error: "Your store settings could not be saved: " + updateError.message }, { status: 500 });
    }
    if (!saved) {
      return NextResponse.json({ ok: false, error: "An approved vendor account is required to update store settings." }, { status: 403 });
    }
    return NextResponse.json({ ok: true, vendor: saved });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected store settings error." }, { status: 500 });
  }
}
