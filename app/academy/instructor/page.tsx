"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Course = {
  id: string;
  title: string;
  slug: string;
  category: string;
  level: string;
  price: number | string;
  currency: string;
  status: "draft" | "published" | "archived";
  created_at: string;
};

const initialForm = {
  title: "",
  short_description: "",
  description: "",
  category: "Technology",
  level: "beginner",
  language: "English",
  price: "0",
  currency: "GHS"
};

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function AcademyInstructorPage() {
  const [userId, setUserId] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadCourses(ownerId: string) {
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from("academy_courses")
      .select("id,title,slug,category,level,price,currency,status,created_at")
      .eq("instructor_id", ownerId)
      .order("created_at", { ascending: false });
    if (queryError) setError("We couldn't load your courses. Please refresh.");
    else setCourses((data ?? []) as Course[]);
  }

  useEffect(() => {
    let active = true;
    async function initialise() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        window.location.assign("/account?next=/academy/instructor");
        return;
      }
      setUserId(user.id);
      await loadCourses(user.id);
      if (active) setLoading(false);
    }
    initialise();
    return () => { active = false; };
  }, []);

  function update<K extends keyof typeof initialForm>(key: K, value: typeof initialForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    const title = form.title.trim();
    const slugBase = slugify(title);
    const price = Number(form.price);
    if (slugBase.length < 4) {
      setError("Please enter a course title with at least four meaningful characters.");
      setBusy(false);
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid course price of zero or more.");
      setBusy(false);
      return;
    }

    const supabase = createClient();
    const payload = {
      instructor_id: userId,
      title,
      slug: slugBase + "-" + crypto.randomUUID().slice(0, 8),
      short_description: form.short_description.trim(),
      description: form.description.trim(),
      category: form.category.trim() || "General",
      level: form.level,
      language: form.language.trim() || "English",
      price,
      currency: form.currency,
      status: "draft"
    };

    const { error: insertError } = await supabase.from("academy_courses").insert(payload);
    if (insertError) {
      setError("We couldn't create this course. Please check the details and try again.");
    } else {
      setNotice("Course created as a draft. Add its sections and lessons before publishing.");
      setForm(initialForm);
      await loadCourses(userId);
    }
    setBusy(false);
  }

  async function publishCourse(course: Course) {
    setBusy(true);
    setError("");
    setNotice("");
    const supabase = createClient();
    const { error: updateError } = await supabase.from("academy_courses")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", course.id).eq("instructor_id", userId);
    if (updateError) setError("We couldn't publish this course. Please try again.");
    else {
      setNotice("Course published. It can now appear in the public Academy catalogue.");
      await loadCourses(userId);
    }
    setBusy(false);
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading Instructor Centre...</main>;

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/academy" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
          <p className="mt-1 text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Academy · Instructor Centre</p>
        </div>
        <div className="flex gap-3">
          <Link href="/academy/instructor/revenue" className="rounded-xl border border-teal-200 bg-white px-4 py-3 text-sm font-bold text-teal-700">Revenue</Link><Link href="/academy" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">View Academy</Link>
          <Link href="/account" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">My account</Link>
        </div>
      </header>

      <section className="mt-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Create and manage courses</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Build practical learning experiences. New courses start as private drafts so you can prepare the curriculum before publishing.</p>
      </section>

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
        <h2 className="text-xl font-extrabold text-slate-900">Create a course</h2>
        <form onSubmit={createCourse} className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700 md:col-span-2">Course title *<input required minLength={4} maxLength={160} value={form.title} onChange={e=>update("title",e.target.value)} placeholder="e.g. Build Websites with AI" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/></label>
          <label className="block text-sm font-semibold text-slate-700 md:col-span-2">Short description<input maxLength={240} value={form.short_description} onChange={e=>update("short_description",e.target.value)} placeholder="A concise summary for the course catalogue" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/></label>
          <label className="block text-sm font-semibold text-slate-700 md:col-span-2">Full description<textarea rows={5} value={form.description} onChange={e=>update("description",e.target.value)} placeholder="What will students learn? Who is this course for? What will they be able to do?" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/></label>
          <label className="block text-sm font-semibold text-slate-700">Category<input value={form.category} onChange={e=>update("category",e.target.value)} placeholder="Technology, Business, Design..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>
          <label className="block text-sm font-semibold text-slate-700">Course level<select value={form.level} onChange={e=>update("level",e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="all_levels">All levels</option></select></label>
          <label className="block text-sm font-semibold text-slate-700">Language<input value={form.language} onChange={e=>update("language",e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <label className="block text-sm font-semibold text-slate-700">Price<input required type="number" min="0" step="0.01" value={form.price} onChange={e=>update("price",e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>
            <label className="block text-sm font-semibold text-slate-700">Currency<select value={form.currency} onChange={e=>update("currency",e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"><option>GHS</option><option>USD</option><option>EUR</option><option>GBP</option><option>NGN</option><option>KES</option><option>ZAR</option></select></label>
          </div>
          <p className="text-xs leading-5 text-slate-500 md:col-span-2">Paid-course checkout and automatic enrolment will be connected in a later Academy phase. For now, create and prepare courses as drafts. Free-course enrolment is supported by the database foundation.</p>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 md:col-span-2">{error}</p>}
          {notice && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800 md:col-span-2">{notice}</p>}
          <button disabled={busy || !userId} className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60 md:col-span-2">{busy ? "Saving..." : "Create course draft"}</button>
        </form>
      </section>

      <section className="mt-9">
        <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold text-slate-900">Your courses</h2><p className="mt-1 text-sm text-slate-500">Manage the courses created by your account.</p></div><span className="text-sm text-slate-500">{courses.length} total</span></div>
        {courses.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">You have not created any courses yet.</div> : <div className="space-y-3">{courses.map(course=><article key={course.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="min-w-0"><h3 className="font-bold text-slate-900">{course.title}</h3><p className="mt-1 text-xs text-slate-500">{course.category} · {course.level.replace("_"," ")} · {course.currency} {Number(course.price).toFixed(2)}</p><p className="mt-1 text-xs text-slate-400">Created {new Date(course.created_at).toLocaleDateString()}</p></div>
          <div className="flex flex-wrap items-center gap-3"><span className={"rounded-full px-3 py-1.5 text-xs font-bold "+(course.status==="published"?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800")}>{course.status}</span><Link href={"/academy/instructor/courses/"+course.id} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-teal-700 hover:text-teal-700">Manage curriculum</Link>{course.status==="draft" && <button type="button" disabled={busy} onClick={()=>publishCourse(course)} className="rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Publish</button>}</div>
        </article>)}</div>}
      </section>
    </div>
  </main>;
}
