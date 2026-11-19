import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const session = await createClient();
    const { data: auth, error: authError } = await session.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ ok: false, error: "Please sign in to submit verification." }, { status: 401 });
    }

    const body = await request.json();
    const employerId = typeof body?.employerId === "string" ? body.employerId.trim() : "";
    const organisationType = typeof body?.organisationType === "string" ? body.organisationType : "";
    const country = typeof body?.registrationCountry === "string" ? body.registrationCountry.trim() : "";
    const registrationNumber = typeof body?.registrationNumber === "string" ? body.registrationNumber.trim().slice(0, 120) : "";
    const applicantNote = typeof body?.applicantNote === "string" ? body.applicantNote.trim().slice(0, 2000) : "";
    const evidencePath = typeof body?.evidenceStoragePath === "string" ? body.evidenceStoragePath.trim() : "";
    const evidenceFileName = typeof body?.evidenceFileName === "string" ? body.evidenceFileName.trim().slice(0, 255) : "";

    if (!UUID.test(employerId) || !["company","nonprofit","government","educational","sole_trader","other"].includes(organisationType)
      || country.length < 2 || country.length > 100 || !evidenceFileName
      || !evidencePath.startsWith(employerId + "/") || evidencePath.includes("..")) {
      return NextResponse.json({ ok: false, error: "Please complete the required verification details and attach valid evidence." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: employer, error: employerError } = await admin
      .from("work_employer_profiles").select("id,owner_id").eq("id", employerId).maybeSingle();
    if (employerError) return NextResponse.json({ ok: false, error: "Could not verify employer ownership." }, { status: 500 });
    if (!employer || employer.owner_id !== auth.user.id) {
      return NextResponse.json({ ok: false, error: "You can only verify your own employer profile." }, { status: 403 });
    }

    const { data: existing, error: existingError } = await admin
      .from("work_employer_verifications").select("id,status")
      .eq("employer_id", employerId).maybeSingle();
    if (existingError) return NextResponse.json({ ok: false, error: "Could not check your existing verification request." }, { status: 500 });
    if (existing?.status === "verified" || existing?.status === "pending" || existing?.status === "suspended") {
      return NextResponse.json({ ok: false, error: "Your verification request is already " + existing.status + ". Contact support if you need help." }, { status: 409 });
    }

    const fileName = evidencePath.slice(employerId.length + 1);
    const { data: storedFiles, error: storageError } = await admin.storage
      .from("work-employer-verification").list(employerId, { search: fileName, limit: 20 });
    if (storageError || !storedFiles?.some(file => file.name === fileName)) {
      return NextResponse.json({ ok: false, error: "The verification document could not be found. Please upload it again." }, { status: 400 });
    }

    const payload = {
      employer_id: employerId,
      submitted_by: auth.user.id,
      organisation_type: organisationType,
      registration_country: country,
      registration_number: registrationNumber || null,
      evidence_storage_path: evidencePath,
      evidence_file_name: evidenceFileName,
      applicant_note: applicantNote || null,
      status: "pending",
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
      submitted_at: new Date().toISOString()
    };

    const result = existing
      ? await admin.from("work_employer_verifications").update(payload).eq("employer_id", employerId).select("id,status,submitted_at").single()
      : await admin.from("work_employer_verifications").insert(payload).select("id,status,submitted_at").single();

    if (result.error || !result.data) {
      return NextResponse.json({ ok: false, error: "Your verification request could not be saved. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, verification: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected verification submission error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
