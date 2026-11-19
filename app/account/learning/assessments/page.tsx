"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Attempt = {
  id: string; quiz_id: string; score: number | null; total_questions: number | null;
  passed: boolean | null; submitted_at: string | null; started_at: string;
};
type QuizInfo = { id: string; title: string; course_id: string };
type CourseInfo = { id: string; title: string; slug: string };

export default function AssessmentHistoryPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [quizzes, setQuizzes] = useState<Record<string, QuizInfo>>({});
  const [courses, setCourses] = useState<Record<string, CourseInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const db = createClient();
      const { data: { user } } = await db.auth.getUser();
      if (!user) { window.location.assign("/account?next=/account/learning/assessments"); return; }
      const { data, error: attemptError } = await db.from("academy_quiz_attempts")
        .select("id,quiz_id,score,total_questions,passed,submitted_at,started_at")
        .eq("student_id", user.id).order("started_at", { ascending: false });
      if (attemptError) { if (active) { setError("We couldn't load your assessment history."); setLoading(false); } return; }
      const rows = (data ?? []) as Attempt[];
      const quizIds = [...new Set(rows.map(row => row.quiz_id))];
      let quizMap: Record<string, QuizInfo> = {};
      let courseMap: Record<string, CourseInfo> = {};
      if (quizIds.length) {
        const { data: quizRows } = await db.from("academy_quizzes").select("id,title,course_id").in("id", quizIds);
        quizMap = Object.fromEntries(((quizRows ?? []) as QuizInfo[]).map(row => [row.id, row]));
        const courseIds = [...new Set(Object.values(quizMap).map(row => row.course_id))];
        if (courseIds.length) {
          const { data: courseRows } = await db.from("academy_courses").select("id,title,slug").in("id", courseIds);
          courseMap = Object.fromEntries(((courseRows ?? []) as CourseInfo[]).map(row => [row.id, row]));
        }
      }
      if (active) { setAttempts(rows); setQuizzes(quizMap); setCourses(courseMap); setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10"><div className="mx-auto max-w-5xl">
    <Link href="/account/learning" className="text-sm font-bold text-teal-700">← Back to My Learning</Link>
    <header className="mt-5"><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Academy · Student records</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Assessment history</h1><p className="mt-2 text-sm text-slate-600">Review your submitted assessments, scores and course results.</p></header>
    {loading ? <div className="mt-8 rounded-2xl bg-white p-10 text-center text-sm text-slate-500">Loading assessment history...</div>
    : error ? <p role="alert" className="mt-8 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>
    : attempts.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="font-bold text-slate-800">No assessment results yet</h2><p className="mt-2 text-sm text-slate-500">When you complete a course assessment, your result will appear here.</p><Link href="/academy" className="mt-5 inline-flex rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white">Explore courses</Link></div>
    : <div className="mt-8 space-y-3">{attempts.map(attempt => {
      const quiz = quizzes[attempt.quiz_id]; const course = quiz ? courses[quiz.course_id] : undefined;
      return <article key={attempt.id} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="font-extrabold text-slate-900">{quiz?.title ?? "Course assessment"}</h2><p className="mt-1 text-sm text-slate-500">{course?.title ?? "NBJ Academy course"}</p><p className="mt-2 text-xs text-slate-400">{attempt.submitted_at ? "Submitted " + new Date(attempt.submitted_at).toLocaleString() : "Started " + new Date(attempt.started_at).toLocaleString()}</p></div>
        <div className="text-right">{attempt.submitted_at ? <><p className="text-2xl font-extrabold text-slate-900">{attempt.score ?? 0}%</p><span className={"text-xs font-bold " + (attempt.passed ? "text-emerald-700" : "text-amber-700")}>{attempt.passed ? "Passed" : "Not passed"}</span><p className="mt-1 text-xs text-slate-400">{attempt.total_questions ?? 0} questions</p></> : <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">Not submitted</span>}</div></div>
        {course?.slug && <Link href={"/academy/course/" + course.slug} className="mt-4 inline-flex text-xs font-bold text-teal-700">Return to course →</Link>}
      </article>;
    })}</div>}
  </div></main>;
}
