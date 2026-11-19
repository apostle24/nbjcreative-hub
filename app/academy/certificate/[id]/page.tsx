"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Certificate = { id: string; certificate_number: string; issued_at: string; course_id: string };
type Course = { title: string; instructor_id: string };

export default function AcademyCertificatePage() {
  const { id } = useParams<{ id: string }>();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [studentName, setStudentName] = useState("NBJ Academy Learner");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const db = createClient();
      const { data: { user } } = await db.auth.getUser();
      if (!user) { window.location.assign("/account?next=" + encodeURIComponent("/academy/certificate/" + id)); return; }
      const { data, error: certError } = await db.from("academy_certificates")
        .select("id,certificate_number,issued_at,course_id").eq("id", id).single();
      if (certError || !data) { if (active) { setError("This certificate could not be found or you do not have permission to view it."); setLoading(false); } return; }
      const { data: courseData } = await db.from("academy_courses").select("title,instructor_id").eq("id", data.course_id).single();
      const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "NBJ Academy Learner";
      if (active) { setCertificate(data as Certificate); setCourse(courseData as Course | null); setStudentName(name); setLoading(false); }
    })();
    return () => { active = false; };
  }, [id]);

  if (loading) return <main className="min-h-screen grid place-items-center bg-slate-50 text-sm text-slate-500">Loading certificate...</main>;
  if (error || !certificate || !course) return <main className="min-h-screen bg-slate-50 px-5 py-12"><div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center"><p className="text-sm text-rose-700">{error || "Certificate unavailable."}</p><Link href="/account/learning" className="mt-5 inline-block font-bold text-teal-700">Return to My Learning</Link></div></main>;

  return <main className="min-h-screen bg-slate-100 px-5 py-10 print:bg-white print:p-0">
    <div className="mx-auto mb-5 flex max-w-5xl items-center justify-between print:hidden"><Link href="/account/learning" className="text-sm font-bold text-teal-700">← My Learning</Link><button onClick={() => window.print()} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">Print / Save as PDF</button></div>
    <article className="mx-auto max-w-5xl border-[10px] border-double border-teal-800 bg-white p-8 text-center shadow-xl sm:p-16 print:border-[10px] print:shadow-none">
      <p className="text-sm font-extrabold uppercase tracking-[.35em] text-teal-800">NBJCreative Hub · NBJ Academy</p>
      <div className="mx-auto my-8 h-px max-w-xl bg-amber-500"/>
      <h1 className="font-serif text-4xl font-bold text-slate-900 sm:text-5xl">Certificate of Completion</h1>
      <p className="mt-8 text-sm text-slate-500">This certificate is proudly presented to</p>
      <p className="mt-3 font-serif text-3xl font-bold text-teal-900 sm:text-4xl">{studentName}</p>
      <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-slate-600">In recognition of successfully completing all required lessons and passing the published assessments for the course</p>
      <h2 className="mt-4 text-2xl font-extrabold text-slate-900 sm:text-3xl">{course.title}</h2>
      <p className="mt-8 text-sm text-slate-500">Awarded on {new Date(certificate.issued_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
      <div className="mx-auto my-8 h-px max-w-xl bg-amber-500"/>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Certificate ID</p>
      <p className="mt-2 font-mono text-sm font-bold tracking-widest text-slate-800">{certificate.certificate_number}</p>
      <p className="mt-8 text-xs text-slate-400">Issued by NBJ Academy · NBJCreative Hub</p>
    </article>
  </main>;
}
