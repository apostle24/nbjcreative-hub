import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await createClient();
    const { data: auth, error: authError } = await session.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ ok: false, error: "Please sign in to access application documents." }, { status: 401 });
    }

    const body = await request.json();
    const applicationId = typeof body?.applicationId === "string" ? body.applicationId.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId)) {
      return NextResponse.json({ ok: false, error: "Invalid application reference." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: application, error } = await admin
      .from("work_job_applications")
      .select("id,applicant_id,resume_storage_path,resume_file_name,work_job_posts!inner(work_employer_profiles!inner(owner_id))")
      .eq("id", applicationId)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: "Could not verify application access." }, { status: 500 });
    if (!application) return NextResponse.json({ ok: false, error: "Application not found." }, { status: 404 });

    const job = Array.isArray(application.work_job_posts) ? application.work_job_posts[0] : application.work_job_posts;
    const employer = job && (Array.isArray(job.work_employer_profiles) ? job.work_employer_profiles[0] : job.work_employer_profiles);
    if (employer?.owner_id !== auth.user.id) {
      return NextResponse.json({ ok: false, error: "You are not authorised to access this CV." }, { status: 403 });
    }
    if (!application.resume_storage_path) {
      return NextResponse.json({ ok: false, error: "The applicant did not attach a CV to this application." }, { status: 404 });
    }

    const { data: signed, error: signError } = await admin.storage
      .from("work-candidate-files")
      .createSignedUrl(application.resume_storage_path, 60, { download: application.resume_file_name || true });

    if (signError || !signed?.signedUrl) {
      return NextResponse.json({ ok: false, error: "The CV could not be opened. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, url: signed.signedUrl, fileName: application.resume_file_name });
  } catch {
    return NextResponse.json({ ok: false, error: "Unexpected CV access error." }, { status: 500 });
  }
}
