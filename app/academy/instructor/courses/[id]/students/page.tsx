"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type StudentRow = {
  enrollment_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  enrollment_status: string;
  enrolled_at: string;
  completed_lessons: number;
  total_lessons: number;
  progress_percent: number;
  assessment_attempts: number;
  best_score: number | null;
  latest_score: number | null;
  passed_assessments: number;
  total_published_assessments: number;
};

export default function CourseStudentsPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const [courseTitle, setCourseTitle] = useState("Course students");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const db = createClient();
      const { data: { user } } = await db.auth.getUser();
      if (!user) {
        window.location.assign("/account?next=" + encodeURIComponent("/academy/instructor/courses/" + courseId + "/students"));
        return;
      }
      const { data: course, error: courseError } = await db
        .from("academy_courses").select("id,title").eq("id", courseId).eq("instructor_id", user.id).maybeSingle();
      if (courseError || !course) {
        if (active) { setError("This course could not be found, or you do not have permission to view its students."); setLoading(false); }
        return;
      }
      const { data, error: rosterError } = await db.rpc("get_academy_course_student_analytics", { p_course_id: courseId });
      if (!active) return;
      if (rosterError) setError("We couldn't load student performance. Please try again later.");
      else {
        setCourseTitle(course.title);
        setStudents((data ?? []) as StudentRow[]);
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [courseId]);

  const filtered = useMemo(() => students.filter(student => {
    const matchesSearch = (student.student_name + " " + student.student_email).toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "all" || student.enrollment_status === status;
    return matchesSearch && matchesStatus;
  }), [students, search, status]);

  const activeCount = students.filter(s => s.enrollment_status === "active").length;
  const completedCount = students.filter(s => s.progress_percent === 100 && s.total_lessons > 0).length;
  const averageProgress = students.length ? Math.round(students.reduce((sum, s) => sum + s.progress_percent, 0) / students.length) : 0;
  const assessmentAttempts = students.reduce((sum, s) => sum + s.assessment_attempts, 0);
  const assessmentPasses = students.reduce((sum, s) => sum + s.passed_assessments, 0);
  const assessmentOpportunities = students.reduce((sum, s) => sum + s.total_published_assessments, 0);
  const passRate = assessmentOpportunities ? Math.round((assessmentPasses / assessmentOpportunities) * 100) : 0;

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading course students...</main>;

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10"><div className="mx-auto max-w-6xl">
    <Link href={"/academy/instructor/courses/" + courseId} className="text-sm font-bold text-teal-700">← Back to curriculum</Link>
    <p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Academy · Instructor analytics</p>
    <h1 className="mt-2 text-3xl font-extrabold text-slate-900">{courseTitle}</h1>
    <p className="mt-2 text-sm text-slate-600">Monitor enrolments, lesson completion and assessment performance for this course.</p>
    {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Total students</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{students.length}</p><p className="mt-1 text-xs text-slate-500">{activeCount} active enrolments</p></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Course completions</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{completedCount}</p><p className="mt-1 text-xs text-slate-500">Students at 100% lesson progress</p></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Average lesson progress</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{averageProgress}%</p><p className="mt-1 text-xs text-slate-500">Across all enrolled students</p></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Assessment pass rate</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{assessmentOpportunities ? passRate + "%" : "—"}</p><p className="mt-1 text-xs text-slate-500">{assessmentAttempts} submitted attempts</p></article>
    </section>

    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold text-slate-900">Enrolled students</h2><p className="mt-1 text-sm text-slate-500">Student details and individual learning performance.</p></div><span className="text-sm text-slate-500">{filtered.length} of {students.length}</span></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student name or email" className="rounded-xl border border-slate-200 px-4 py-3 text-sm"/>
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
      </div>
      {filtered.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">{students.length ? "No students match these filters." : "No students have enrolled in this course yet."}</div> :
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Student</th><th className="px-3 py-3">Enrolled</th><th className="px-3 py-3">Lesson progress</th><th className="px-3 py-3">Assessment</th><th className="px-3 py-3">Status</th></tr></thead>
          <tbody>{filtered.map(student => <tr key={student.enrollment_id} className="border-b border-slate-100 align-top">
            <td className="px-3 py-4"><p className="font-bold text-slate-900">{student.student_name}</p><p className="mt-1 text-xs text-slate-500">{student.student_email || student.student_id}</p></td>
            <td className="px-3 py-4 text-slate-600">{new Date(student.enrolled_at).toLocaleDateString()}</td>
            <td className="px-3 py-4"><p className="font-semibold text-slate-800">{student.progress_percent}%</p><p className="mt-1 text-xs text-slate-500">{student.completed_lessons} of {student.total_lessons} lessons</p><div className="mt-2 h-2 w-32 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{width: student.progress_percent + "%"}}/></div></td>
            <td className="px-3 py-4"><p className="font-semibold text-slate-800">{student.passed_assessments}/{student.total_published_assessments} passed</p><p className="mt-1 text-xs text-slate-500">{student.assessment_attempts} attempts · Best {student.best_score === null ? "—" : student.best_score + "%"} · Latest {student.latest_score === null ? "—" : student.latest_score + "%"}</p></td>
            <td className="px-3 py-4"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold capitalize text-slate-700">{student.enrollment_status}</span></td>
          </tr>)}</tbody>
        </table></div>}
    </section>
    <p className="mt-5 text-xs text-slate-500">Student information is available only to the instructor who owns this course.</p>
  </div></main>;
}
