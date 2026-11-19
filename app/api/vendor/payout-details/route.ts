import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function getVendor() {
  const session = await createClient();
  const { data, error } = await session.auth.getUser();
  if (error || !data.user) return { response: NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: vendor, error: vendorError } = await admin.from("vendor_profiles")
    .select("id,status").eq("owner_id", data.user.id).maybeSingle();
  if (vendorError) return { response: NextResponse.json({ error: "Could not load your seller account." }, { status: 500 }) };
  if (!vendor || vendor.status !== "approved") return { response: NextResponse.json({ error: "An approved vendor account is required." }, { status: 403 }) };
  return { admin, vendor };
}

function masked(value: string) {
  const clean = value.replace(/\s+/g, "");
  return clean.length <= 4 ? "••••" : "••••••" + clean.slice(-4);
}

export async function GET() {
  const auth = await getVendor();
  if (auth.response) return auth.response;
  const { data, error } = await auth.admin!.from("vendor_payout_methods")
    .select("id,method_type,country_code,currency,provider_name,account_name,destination_reference,branch_name,updated_at")
    .eq("vendor_id", auth.vendor!.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load payout details." }, { status: 500 });
  if (!data) return NextResponse.json({ method: null });
  return NextResponse.json({ method: {
    id: data.id, method_type: data.method_type, country_code: data.country_code,
    currency: data.currency, provider_name: data.provider_name, account_name: data.account_name,
    destination_masked: masked(data.destination_reference), branch_name: data.branch_name,
    updated_at: data.updated_at
  }});
}

export async function PUT(request: Request) {
  const auth = await getVendor();
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const methodType = body?.method_type;
    const countryCode = typeof body?.country_code === "string" ? body.country_code.trim().toUpperCase() : "";
    const currency = typeof body?.currency === "string" ? body.currency.trim().toUpperCase() : "";
    const providerName = typeof body?.provider_name === "string" ? body.provider_name.trim().slice(0,100) : "";
    const accountName = typeof body?.account_name === "string" ? body.account_name.trim().slice(0,120) : "";
    const destination = typeof body?.destination_reference === "string" ? body.destination_reference.trim().slice(0,80) : "";
    const branchName = typeof body?.branch_name === "string" ? body.branch_name.trim().slice(0,120) : "";
    if (!["bank","mobile_money"].includes(methodType) || !/^[A-Z]{2}$/.test(countryCode) ||
        !/^[A-Z]{3}$/.test(currency) || !providerName || !accountName) {
      return NextResponse.json({ error: "Complete the payout method, country, currency, provider and account name." }, { status: 400 });
    }
    const { data: existing, error: readError } = await auth.admin!.from("vendor_payout_methods")
      .select("destination_reference").eq("vendor_id", auth.vendor!.id).maybeSingle();
    if (readError) return NextResponse.json({ error: "Could not verify existing payout details." }, { status: 500 });
    const finalDestination = destination || existing?.destination_reference || "";
    if (finalDestination.length < 4 || !/^[+()0-9A-Za-z .-]{4,80}$/.test(finalDestination)) {
      return NextResponse.json({ error: "Enter a valid account number or mobile-money number." }, { status: 400 });
    }
    const { data, error } = await auth.admin!.from("vendor_payout_methods").upsert({
      vendor_id: auth.vendor!.id, method_type: methodType, country_code: countryCode,
      currency, provider_name: providerName, account_name: accountName,
      destination_reference: finalDestination, branch_name: branchName || null,
      updated_at: new Date().toISOString()
    }, { onConflict: "vendor_id" }).select("id,method_type,country_code,currency,provider_name,account_name,branch_name,updated_at").single();
    if (error) return NextResponse.json({ error: "Could not save payout details: " + error.message }, { status: 500 });
    return NextResponse.json({ ok: true, method: { ...data, destination_masked: masked(finalDestination) } });
  } catch {
    return NextResponse.json({ error: "Invalid payout details." }, { status: 400 });
  }
}
