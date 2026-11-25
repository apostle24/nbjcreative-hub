import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const allowedStatuses = ["viewed", "shortlisted", "interviewing", "accepted", "rejected"] as const;

export async function POST(request: Request) {
  try {
    const session = await createClient();
    const { data: auth, error: authError } = await session.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ ok: false, error: "Please sign in to manage applications." }, { status: 401 });
    }

    const body = await request.json();
    const applicationId = typeof body?.applicationId === "string" ? body.applicationId.trim() : "";
    const status = typeof body?.status === "string" ? body.status : "";
    const note = typeof body?.employerNote === "string" ? body.employerNote.trim().slice(0, 2000) : "";
    const score = body?.qualityScore === null || body?.qualityScore === "" ? null : Number(body?.qualityScore);
    const hasInterviewAt = body?.interviewAt !== null && body?.interviewAt !== undefined && body?.interviewAt !== "";
    const rawInterviewAt = typeof body?.interviewAt === "string" ? body.interviewAt.trim() : "";
    if (hasInterviewAt && (!rawInterviewAt || !Number.isFinite(Date.parse(rawInterviewAt)))) {
      return NextResponse.json({ ok: false, error: "Enter a valid interview date and time." }, { status: 400 });
    }
    const interviewAt = rawInterviewAt ? new Date(rawInterviewAt).toISOString() : null;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId)) {
      return NextResponse.json({ ok: false, error: "Invalid application reference." }, { status: 400 });
    }
    if (!allowedStatuses.includes(status as typeof allowedStatuses[number])) {
      return NextResponse.json({ ok: false, error: "Choose a valid hiring decision." }, { status: 400 });
    }
    if (score !== null && (!Number.isInteger(score) || score < 1 || score > 5)) {
      return NextResponse.json({ ok: false, error: "Quality score must be between 1 and 5." }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data: application, error: lookupError } = await admin
      .from("work_job_applications")
      .select("id,job_id,work_job_posts!inner(employer_id,work_employer_profiles!inner(owner_id))")
      .eq("id", applicationId)
      .maybeSingle();

    if (lookupError) return NextResponse.json({ ok: false, error: "Could not verify application ownership." }, { status: 500 });
    if (!application) return NextResponse.json({ ok: false, error: "Application not found." }, { status: 404 });

    const job = Array.isArray(application.work_job_posts) ? application.work_job_posts[0] : application.work_job_posts;
    const employer = job && (Array.isArray(job.work_employer_profiles) ? job.work_employer_profiles[0] : job.work_employer_profiles);
    if (employer?.owner_id !== auth.user.id) {
      return NextResponse.json({ ok: false, error: "You are not authorised to review this application." }, { status: 403 });
    }

    const { data: saved, error: saveError } = await admin
      .from("work_job_applications")
      .update({
        status,
        employer_note: note || null,
        quality_score: score,
        interview_at: status === "interviewing" ? interviewAt : null
      })
      .eq("id", applicationId)
      .select("id,status,employer_note,quality_score,interview_at")
      .maybeSingle();

    if (saveError) return NextResponse.json({ ok: false, error: "Could not save the hiring update." }, { status: 500 });
    if (!saved) return NextResponse.json({ ok: false, error: "The application update was not confirmed." }, { status: 409 });
    return NextResponse.json({ ok: true, application: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected application review error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
