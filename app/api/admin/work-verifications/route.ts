import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED = ["pending", "verified", "rejected", "suspended"] as const;
type Status = typeof ALLOWED[number];

async function getAdmin() {
  const session = await createClient();
  const { data: auth, error: authError } = await session.auth.getUser();
  if (authError || !auth.user) return { error: NextResponse.json({ error: "Please sign in as an administrator." }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (error) return { error: NextResponse.json({ error: "Could not verify administrator access." }, { status: 500 }) };
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "Administrator permission is required." }, { status: 403 }) };
  return { admin, user: auth.user };
}

export async function GET() {
  try {
    const access = await getAdmin();
    if (access.error) return access.error;
    const { data, error } = await access.admin
      .from("work_employer_verifications")
      .select("id,employer_id,submitted_by,organisation_type,registration_country,registration_number,evidence_storage_path,evidence_file_name,status,applicant_note,review_note,reviewed_by,reviewed_at,submitted_at,employer:work_employer_profiles(company_name,company_slug,website_url)")
      .order("submitted_at", { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: "Could not load verification requests: " + error.message }, { status: 500 });

    const rows = await Promise.all((data ?? []).map(async (item: any) => {
      const { data: signed, error: signedError } = await access.admin.storage
        .from("work-employer-verification")
        .createSignedUrl(item.evidence_storage_path, 300);
      return {
        id: item.id,
        employer_id: item.employer_id,
        submitted_by: item.submitted_by,
        organisation_type: item.organisation_type,
        registration_country: item.registration_country,
        registration_number: item.registration_number,
        evidence_file_name: item.evidence_file_name,
        evidence_url: signedError ? null : signed?.signedUrl ?? null,
        status: item.status,
        applicant_note: item.applicant_note,
        review_note: item.review_note,
        reviewed_at: item.reviewed_at,
        submitted_at: item.submitted_at,
        employer: item.employer
      };
    }));
    return NextResponse.json({ requests: rows });
  } catch {
    return NextResponse.json({ error: "Unexpected error loading verification requests." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getAdmin();
    if (access.error) return access.error;
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const status = typeof body?.status === "string" ? body.status as Status : "";
    const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote.trim().slice(0, 2000) : "";
    if (!UUID.test(id) || !ALLOWED.includes(status)) {
      return NextResponse.json({ error: "A valid request and review decision are required." }, { status: 400 });
    }

    const { data: current, error: currentError } = await access.admin
      .from("work_employer_verifications").select("id,employer_id").eq("id", id).maybeSingle();
    if (currentError) return NextResponse.json({ error: "Could not find this verification request." }, { status: 500 });
    if (!current) return NextResponse.json({ error: "Verification request not found." }, { status: 404 });

    const now = new Date().toISOString();
    const { data: saved, error: saveError } = await access.admin
      .from("work_employer_verifications")
      .update({ status, review_note: reviewNote || null, reviewed_by: access.user.id, reviewed_at: now })
      .eq("id", id)
      .select("id,status,review_note,reviewed_at,employer_id")
      .single();
    if (saveError || !saved) return NextResponse.json({ error: "Could not save the review decision: " + (saveError?.message ?? "No record returned.") }, { status: 500 });

    const { error: employerError } = await access.admin.from("work_employer_profiles")
      .update({ is_verified: status === "verified" })
      .eq("id", current.employer_id);
    if (employerError) {
      return NextResponse.json({ error: "The review was saved, but the public verification badge could not be updated. Please retry the same decision." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, verification: saved });
  } catch {
    return NextResponse.json({ error: "Unexpected error saving the review decision." }, { status: 500 });
  }
}
