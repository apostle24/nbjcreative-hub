"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, GraduationCap, Clock3, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  category: string;
  level: string;
  language: string;
  thumbnail_url: string | null;
  price: number | string;
  currency: string;
  published_at: string | null;
};

export default function AcademyPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadCourses() {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("academy_courses")
        .select("id,title,slug,short_description,category,level,language,thumbnail_url,price,currency,published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (!active) return;
      if (queryError) setError("Courses are being prepared. Please check back soon.");
      else setCourses((data ?? []) as Course[]);
      setLoading(false);
    }
    loadCourses();
    return () => { active = false; };
  }, []);

  function price(course: Course) {
    const amount = Number(course.price);
    return amount === 0 ? "Free" : new Intl.NumberFormat("en", {
      style: "currency", currency: course.currency
    }).format(amount);
  }

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold">
          <Link href="/work" className="text-slate-600 hover:text-teal-700">NBJ Work</Link>
          <Link href="/account" className="text-slate-600 hover:text-teal-700">My account</Link>
        </nav>
      </div>
    </header>
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-5 py-14 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[.22em] text-teal-700">NBJ Academy</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">Learn skills. Build confidence. Move forward.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Practical courses, guided lessons and learning pathways to help you grow personally and professionally.</p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2"><BookOpen size={16}/>Structured courses</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2"><GraduationCap size={16}/>Learn at your pace</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2"><Clock3 size={16}/>Track your progress</span>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-5 py-12 md:py-16">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Course catalogue</p>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Explore courses</h2>
      </div>
      {loading ? <div className="rounded-2xl bg-white p-12 text-center text-sm text-slate-500">Loading courses...</div>
      : error ? <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-600">{error}</div>
      : courses.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <GraduationCap className="mx-auto text-slate-300" size={38}/>
          <h3 className="mt-4 font-bold text-slate-800">Courses are coming soon</h3>
          <p className="mt-2 text-sm text-slate-500">Our learning catalogue is being prepared. Published courses will appear here.</p>
        </div>
      : <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {courses.map(course => <article key={course.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {course.thumbnail_url ? <img src={course.thumbnail_url} alt="" className="h-44 w-full object-cover"/> : <div className="flex h-44 items-center justify-center bg-slate-100"><BookOpen size={38} className="text-slate-300"/></div>}
            <div className="p-6">
              <div className="flex items-center justify-between gap-3 text-xs font-bold"><span className="text-teal-700">{course.category}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{course.level.replace("_", " ")}</span></div>
              <h3 className="mt-4 text-xl font-extrabold text-slate-900">{course.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{course.short_description}</p>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="font-bold text-slate-900">{price(course)}</span>
                <Link href={"/academy/course/" + course.slug} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white">View course <ArrowRight size={14}/></Link>
              </div>
            </div>
          </article>)}
        </div>}
    </section>
  </main>;
}
