"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LearningCourse = {
  enrollmentId: string; courseId: string; title: string; slug: string;
  shortDescription: string; category: string; enrolledAt: string;
  totalLessons: number; completedLessons: number; status: string;
};

export default function MyLearningPage() {
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.assign("/account?next=/account/learning"); return; }
      const { data: enrollments, error: enrolError } = await supabase.from("academy_enrollments")
        .select("id,course_id,enrolled_at,status").eq("student_id", user.id).order("enrolled_at", { ascending: false });
      if (enrolError) { if(active){setError("We couldn't load your learning records.");setLoading(false);} return; }
      const rows = enrollments ?? [];
      if (!rows.length) { if(active){setCourses([]);setLoading(false);} return; }
      const ids = rows.map(row => row.course_id);
      const { data: courseRows, error: courseError } = await supabase.from("academy_courses")
        .select("id,title,slug,short_description,category").in("id", ids);
      if (courseError) { if(active){setError("We couldn't load your course details.");setLoading(false);} return; }
      const built: LearningCourse[] = [];
      for (const enrol of rows) {
        const course = (courseRows ?? []).find(item => item.id === enrol.course_id);
        if (!course) continue;
        const { data: sectionRows } = await supabase.from("academy_sections").select("id").eq("course_id", course.id);
        const sectionIds = (sectionRows ?? []).map(section => section.id);
        let totalLessons = 0;
        if (sectionIds.length) {
          const { count } = await supabase.from("academy_lessons").select("id", { count: "exact", head: true }).in("section_id", sectionIds);
          totalLessons = count ?? 0;
        }
        const { count: completedCount } = await supabase.from("academy_lesson_progress")
          .select("id", { count: "exact", head: true }).eq("enrollment_id", enrol.id);
        built.push({
          enrollmentId: enrol.id, courseId: course.id, title: course.title, slug: course.slug,
          shortDescription: course.short_description, category: course.category,
          enrolledAt: enrol.enrolled_at, totalLessons, completedLessons: completedCount ?? 0,
          status: enrol.status
        });
      }
      if (active) { setCourses(built); setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, []);

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/academy" className="font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><p className="mt-2 text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Academy · Student space</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">My Learning</h1><p className="mt-2 text-sm text-slate-600">Continue your courses and keep track of your progress.</p></div><Link href="/academy" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">Explore courses</Link></header>
    {loading ? <div className="mt-8 rounded-2xl bg-white p-12 text-center text-sm text-slate-500">Loading your courses...</div>
    : error ? <p role="alert" className="mt-8 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>
    : courses.length===0 ? <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><h2 className="font-bold text-slate-800">Your learning journey starts here</h2><p className="mt-2 text-sm text-slate-500">You haven't enrolled in any courses yet.</p><Link href="/academy" className="mt-5 inline-flex rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white">Browse Academy courses</Link></div>
    : <div className="mt-8 grid gap-5 md:grid-cols-2">{courses.map(course=>{const percent=course.totalLessons?Math.round(course.completedLessons/course.totalLessons*100):0;return <article key={course.enrollmentId} className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-bold uppercase tracking-wider text-teal-700">{course.category}</p><h2 className="mt-2 text-xl font-extrabold text-slate-900">{course.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{course.shortDescription}</p><div className="mt-5"><div className="flex justify-between text-xs font-semibold text-slate-600"><span>Course progress</span><span>{percent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{width:percent+"%"}}/></div><p className="mt-2 text-xs text-slate-500">{course.completedLessons} of {course.totalLessons} lessons completed</p></div><div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="text-xs text-slate-400">Enrolled {new Date(course.enrolledAt).toLocaleDateString()}</span><Link href={"/academy/course/"+course.slug} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white">Continue learning</Link></div></article>})}</div>}
  </div></main>;
}
