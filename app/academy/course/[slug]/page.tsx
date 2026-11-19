"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Course = {
  id: string; title: string; slug: string; short_description: string;
  description: string; category: string; level: string; language: string;
  price: number | string; currency: string; thumbnail_url: string | null;
  instructor_id: string;
};
type Lesson = {
  id: string; section_id: string; title: string; description: string;
  content: string; video_url: string | null; duration_minutes: number;
  is_preview: boolean; sort_order: number;
};
type Section = { id: string; title: string; description: string; sort_order: number; lessons: Lesson[]; };
type Enrollment = { id: string; status: string; };
type Quiz = { id: string; title: string; instructions: string; pass_mark: number; };\ntype CourseReview = { review_id: string; student_name: string; rating: number; review: string; created_at: string; };

export default function AcademyCoursePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);\n  const [reviews, setReviews] = useState<CourseReview[]>([]);\n  const [myReviewId, setMyReviewId] = useState("");\n  const [myRating, setMyRating] = useState(5);\n  const [myReview, setMyReview] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const lessons = useMemo(() => sections.flatMap(section => section.lessons), [sections]);
  const selectedLesson = lessons.find(lesson => lesson.id === selectedLessonId) ?? lessons[0] ?? null;
  const isEnrolled = enrollment?.status === "active";
  const completedCount = completed.length;
  const progress = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;

  async function loadCourse() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? "");
    const { data: courseData, error: courseError } = await supabase
      .from("academy_courses")
      .select("id,title,slug,short_description,description,category,level,language,price,currency,thumbnail_url,instructor_id")
      .eq("slug", slug).eq("status", "published").single();
    if (courseError || !courseData) {
      setError("This course could not be found. It may be unpublished or no longer available.");
      setLoading(false); return;
    }
    const currentCourse = courseData as Course;
    setCourse(currentCourse);

    let currentEnrollment: Enrollment | null = null;
    if (user) {
      const { data: enrolData } = await supabase.from("academy_enrollments")
        .select("id,status").eq("course_id", currentCourse.id).eq("student_id", user.id).maybeSingle();
      currentEnrollment = enrolData as Enrollment | null;
      setEnrollment(currentEnrollment);
    }

    const { data: sectionData, error: sectionError } = await supabase
      .from("academy_sections").select("id,title,description,sort_order")
      .eq("course_id", currentCourse.id).order("sort_order", { ascending: true });
    if (sectionError) { setError("We couldn't load this course curriculum."); setLoading(false); return; }
    const base = sectionData ?? [];
    let lessonData: Lesson[] = [];
    if (base.length) {
      const { data, error: lessonError } = await supabase.from("academy_lessons")
        .select("id,section_id,title,description,content,video_url,duration_minutes,is_preview,sort_order")
        .in("section_id", base.map(section => section.id))
        .order("sort_order", { ascending: true });
      if (lessonError) { setError("We couldn't load the available lessons."); setLoading(false); return; }
      lessonData = (data ?? []) as Lesson[];
    }
    const assembled = base.map(section => ({
      ...section, lessons: lessonData.filter(lesson => lesson.section_id === section.id)
    })) as Section[];
    setSections(assembled);
    const firstLesson = assembled.flatMap(section => section.lessons)[0];
    setSelectedLessonId(current => current || firstLesson?.id || "");

    if (currentEnrollment?.status === "active") {
      const { data: progressData } = await supabase.from("academy_lesson_progress")
        .select("lesson_id").eq("enrollment_id", currentEnrollment.id);
      setCompleted((progressData ?? []).map(item => item.lesson_id));
      const { data: quizData } = await supabase.from("academy_quizzes")
        .select("id,title,instructions,pass_mark").eq("course_id", currentCourse.id).eq("is_published", true);
      setQuizzes((quizData ?? []) as Quiz[]);
    } else {
      setQuizzes([]);
    }
    setLoading(false);
  }

  useEffect(() => { loadCourse(); }, [slug]);

  async function enrolFree() {
    if (!userId) {
      window.location.assign("/account?next=" + encodeURIComponent("/academy/course/" + slug));
      return;
    }
    if (!course || Number(course.price) !== 0) return;
    setBusy(true); setError(""); setNotice("");
    const { error: enrolError } = await createClient().from("academy_enrollments")
      .insert({ course_id: course.id, student_id: userId, status: "active" });
    if (enrolError) {
      if (enrolError.code === "23505") setNotice("You are already enrolled in this course.");
      else setError("We couldn't complete your enrolment. Please try again.");
    } else setNotice("You're enrolled! All course lessons are now unlocked.");
    await loadCourse();
    setBusy(false);
  }

  async function toggleComplete(lesson: Lesson) {
    if (!enrollment || !isEnrolled) return;
    setBusy(true); setError(""); setNotice("");
    const supabase = createClient();
    if (completed.includes(lesson.id)) {
      const { error: deleteError } = await supabase.from("academy_lesson_progress")
        .delete().eq("enrollment_id", enrollment.id).eq("lesson_id", lesson.id);
      if (deleteError) setError("We couldn't update your progress.");
      else setCompleted(current => current.filter(id => id !== lesson.id));
    } else {
      const { error: insertError } = await supabase.from("academy_lesson_progress")
        .insert({ enrollment_id: enrollment.id, lesson_id: lesson.id });
      if (insertError && insertError.code !== "23505") setError("We couldn't save your lesson progress.");
      else setCompleted(current => current.includes(lesson.id) ? current : [...current, lesson.id]);
    }
    setBusy(false);
  }


  async function saveCourseReview() {
    if (!course || !enrollment || !["active", "completed"].includes(enrollment.status)) return;
    setBusy(true); setError(""); setNotice("");
    const db = createClient();
    const payload = { course_id: course.id, enrollment_id: enrollment.id, student_id: userId, rating: myRating, review: myReview.trim() };
    const result = myReviewId
      ? await db.from("academy_course_reviews").update({ rating: myRating, review: myReview.trim(), updated_at: new Date().toISOString() }).eq("id", myReviewId)
      : await db.from("academy_course_reviews").insert(payload).select("id").single();
    if (result.error) {
      setError("We couldn't save your course review. Please try again.");
    } else {
      if (!myReviewId && result.data) setMyReviewId(result.data.id);
      const { data } = await db.rpc("get_academy_course_reviews", { p_course_id: course.id });
      setReviews((data ?? []) as CourseReview[]);
      setNotice("Thank you. Your course rating and review have been saved.");
    }
    setBusy(false);
  }
\n  function formatPrice() {
    const amount = Number(course?.price ?? 0);
    if (amount === 0) return "Free";
    try { return new Intl.NumberFormat("en", { style: "currency", currency: course?.currency ?? "GHS" }).format(amount); }
    catch { return (course?.currency ?? "") + " " + amount.toFixed(2); }
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading course...</main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><Link href="/academy" className="font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><nav className="flex gap-4 text-sm font-semibold"><Link href="/academy" className="text-slate-600">Academy</Link><Link href="/account" className="text-slate-600">My account</Link></nav></div></header>
    <div className="mx-auto max-w-7xl px-5 py-8">
      <Link href="/academy" className="text-sm font-bold text-teal-700">← Back to courses</Link>
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-800">{notice}</p>}
      {course && <>
        <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          {course.thumbnail_url && <img src={course.thumbnail_url} alt="" className="h-56 w-full object-cover md:h-72"/>}
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-9"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Academy · {course.category}</p><h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">{course.title}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{course.short_description}</p><div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600"><span className="rounded-full bg-slate-100 px-3 py-2">{course.level.replace("_"," ")}</span><span className="rounded-full bg-slate-100 px-3 py-2">{course.language}</span><span className="rounded-full bg-slate-100 px-3 py-2">{lessons.length} available lessons</span></div></div><div className="min-w-52 rounded-2xl bg-slate-50 p-5"><p className="text-2xl font-extrabold text-slate-900">{formatPrice()}</p>{isEnrolled ? <p className="mt-2 text-sm font-bold text-emerald-700">You're enrolled</p> : <button type="button" disabled={busy || Number(course.price)!==0} onClick={enrolFree} className="mt-4 w-full rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Please wait..." : userId ? "Enrol for free" : "Sign in to enrol"}</button>}{Number(course.price)!==0 && !isEnrolled && <p className="mt-2 text-xs leading-5 text-slate-500">Paid enrolment will be available when course checkout is connected.</p>}{isEnrolled && <div className="mt-4"><div className="flex justify-between text-xs font-semibold text-slate-600"><span>Your progress</span><span>{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal-600" style={{width: progress+"%"}}/></div><p className="mt-2 text-xs text-slate-500">{completedCount} of {lessons.length} lessons completed</p></div>}</div></div>
        </section>
        {course.description && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-extrabold text-slate-900">About this course</h2><p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{course.description}</p></section>}
        {isEnrolled && quizzes.length>0 && <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Test your knowledge</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">Course assessments</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{quizzes.map(quiz=><article key={quiz.id} className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold text-slate-900">{quiz.title}</h3><p className="mt-1 text-xs text-slate-500">Pass mark: {quiz.pass_mark}%</p>{quiz.instructions&&<p className="mt-2 text-sm text-slate-600">{quiz.instructions}</p>}<Link href={"/academy/quiz/"+quiz.id} className="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white">Take assessment</Link></article>)}</div></section>}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Student feedback</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">Course reviews</h2></div><div className="text-right"><p className="text-2xl font-extrabold text-slate-900">{reviews.length ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1) : "—"} <span className="text-amber-500">★</span></p><p className="text-xs text-slate-500">{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</p></div></div>
          {isEnrolled && <div className="mt-5 rounded-xl bg-slate-50 p-4"><h3 className="font-bold text-slate-900">{myReviewId ? "Update your review" : "Rate this course"}</h3><p className="mt-1 text-xs text-slate-500">Only enrolled students can submit a rating.</p><div className="mt-3 flex gap-2" aria-label="Choose a rating">{[1,2,3,4,5].map(value=><button key={value} type="button" onClick={()=>setMyRating(value)} aria-label={value+" stars"} className={"text-2xl "+(value<=myRating?"text-amber-500":"text-slate-300")}>★</button>)}</div><textarea rows={3} maxLength={2000} value={myReview} onChange={e=>setMyReview(e.target.value)} placeholder="Share what you liked or what could be improved (optional)" className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"/><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-slate-500">{myReview.length}/2000 characters</span><button type="button" disabled={busy} onClick={saveCourseReview} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving..." : myReviewId ? "Update review" : "Submit review"}</button></div></div>}
          <div className="mt-5 space-y-4">{reviews.map(item=><article key={item.review_id} className="border-b border-slate-100 pb-4 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-slate-900">{item.student_name}</p><span className="text-amber-500">{"★".repeat(item.rating)}<span className="text-slate-300">{"★".repeat(5-item.rating)}</span></span></div>{item.review && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{item.review}</p>}<p className="mt-2 text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString()}</p></article>)}</div>
          {!reviews.length && <p className="mt-5 text-sm text-slate-500">No reviews yet. Enrolled students can be the first to share feedback.</p>}
        </section>
        <section className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Learning space</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">{selectedLesson?.title ?? "Course lessons"}</h2></div>{selectedLesson && isEnrolled && <button type="button" disabled={busy} onClick={()=>toggleComplete(selectedLesson)} className={"rounded-xl px-4 py-2.5 text-xs font-bold "+(completed.includes(selectedLesson.id)?"bg-emerald-50 text-emerald-700":"bg-slate-900 text-white")}>{completed.includes(selectedLesson.id)?"Completed ✓":"Mark as complete"}</button>}</div>
            {selectedLesson ? <div className="mt-5">
              {selectedLesson.video_url && (isEnrolled || selectedLesson.is_preview) && <div className="mb-5 aspect-video overflow-hidden rounded-xl bg-slate-950"><iframe src={selectedLesson.video_url} title={selectedLesson.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div>}
              <p className="text-xs font-semibold text-slate-500">{selectedLesson.duration_minutes} minutes {selectedLesson.is_preview ? "· Preview lesson" : ""}</p>
              {selectedLesson.description && <p className="mt-3 text-sm font-semibold text-slate-700">{selectedLesson.description}</p>}
              {selectedLesson.content ? <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedLesson.content}</div> : <p className="mt-5 text-sm text-slate-500">The instructor has not added written notes for this lesson.</p>}
              {!isEnrolled && !selectedLesson.is_preview && <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Enrol in this course to unlock this lesson and track your progress.</div>}
            </div> : <p className="mt-5 text-sm text-slate-500">The instructor is preparing the course lessons. Please check back soon.</p>}
          </div>
          <aside className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-extrabold text-slate-900">Course curriculum</h2><p className="mt-1 text-xs text-slate-500">{sections.length} sections · {lessons.length} lessons currently available to you</p><div className="mt-5 space-y-5">{sections.map((section,index)=><div key={section.id}><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Section {index+1}</p><h3 className="mt-1 text-sm font-extrabold text-slate-800">{section.title}</h3><div className="mt-2 space-y-1">{section.lessons.map((lesson,lessonIndex)=><button key={lesson.id} type="button" onClick={()=>setSelectedLessonId(lesson.id)} className={"flex w-full items-start gap-3 rounded-lg p-3 text-left "+(selectedLesson?.id===lesson.id?"bg-teal-50":"hover:bg-slate-50")}><span className="mt-0.5 text-xs font-bold text-slate-400">{completed.includes(lesson.id)?"✓":lessonIndex+1}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{lesson.title}</span><span className="mt-1 block text-xs text-slate-500">{lesson.duration_minutes} min {lesson.is_preview?"· Preview":""}</span></span></button>)}</div></div>)}</div>{!isEnrolled && Number(course.price)===0 && <button type="button" disabled={busy} onClick={enrolFree} className="mt-5 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Enrol and unlock all lessons</button>}</aside>
        </section>
      </>}
    </div>
  </main>;
}
