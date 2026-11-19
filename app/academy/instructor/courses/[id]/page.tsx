"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Course = { id: string; title: string; status: string; };
type Lesson = {
  id: string; section_id: string; title: string; description: string;
  content: string; video_url: string | null; duration_minutes: number;
  is_preview: boolean; sort_order: number;
};
type Section = { id: string; course_id: string; title: string; description: string; sort_order: number; lessons: Lesson[]; };

const emptyLesson = { title: "", description: "", content: "", video_url: "", duration_minutes: "0", is_preview: false };

export default function CurriculumBuilderPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionDescription, setSectionDescription] = useState("");
  const [lessonForms, setLessonForms] = useState<Record<string, typeof emptyLesson>>({});
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadCurriculum() {
    const supabase = createClient();
    const { data: courseData, error: courseError } = await supabase
      .from("academy_courses").select("id,title,status").eq("id", courseId).single();
    if (courseError || !courseData) { setError("We couldn't find this course or you don't have permission to manage it."); setLoading(false); return; }
    setCourse(courseData as Course);
    const { data: sectionData, error: sectionError } = await supabase
      .from("academy_sections").select("id,course_id,title,description,sort_order")
      .eq("course_id", courseId).order("sort_order", { ascending: true });
    if (sectionError) { setError("We couldn't load the course sections."); setLoading(false); return; }
    const base = (sectionData ?? []) as Omit<Section, "lessons">[];
    const { data: lessonData, error: lessonError } = await supabase
      .from("academy_lessons").select("id,section_id,title,description,content,video_url,duration_minutes,is_preview,sort_order")
      .in("section_id", base.map(s => s.id).length ? base.map(s => s.id) : ["00000000-0000-0000-0000-000000000000"])
      .order("sort_order", { ascending: true });
    if (lessonError) { setError("We couldn't load the course lessons."); setLoading(false); return; }
    const allLessons = (lessonData ?? []) as Lesson[];
    setSections(base.map(s => ({ ...s, lessons: allLessons.filter(l => l.section_id === s.id) })));
    setLoading(false);
  }

  useEffect(() => { loadCurriculum(); }, [courseId]);

  async function addSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const supabase = createClient();
    const { error: insertError } = await supabase.from("academy_sections").insert({
      course_id: courseId, title: sectionTitle.trim(), description: sectionDescription.trim(), sort_order: sections.length
    });
    if (insertError) setError("Couldn't add this section. Please try again.");
    else { setSectionTitle(""); setSectionDescription(""); setNotice("Section added."); await loadCurriculum(); }
    setBusy(false);
  }

  async function deleteSection(section: Section) {
    if (!window.confirm("Delete this section and all its lessons?")) return;
    setBusy(true); setError(""); setNotice("");
    const { error: deleteError } = await createClient().from("academy_sections").delete().eq("id", section.id);
    if (deleteError) setError("Couldn't delete this section.");
    else { setNotice("Section deleted."); await loadCurriculum(); }
    setBusy(false);
  }

  async function saveLesson(event: FormEvent<HTMLFormElement>, section: Section) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const form = lessonForms[section.id] ?? emptyLesson;
    const duration = Number(form.duration_minutes);
    if (!Number.isInteger(duration) || duration < 0) { setError("Enter a valid lesson duration."); setBusy(false); return; }
    const payload = {
      section_id: section.id, title: form.title.trim(), description: form.description.trim(),
      content: form.content.trim(), video_url: form.video_url.trim() || null,
      duration_minutes: duration, is_preview: form.is_preview,
      sort_order: section.lessons.length
    };
    const supabase = createClient();
    const { error: insertError } = await supabase.from("academy_lessons").insert(payload);
    if (insertError) setError("Couldn't save this lesson. Please check the details and try again.");
    else { setLessonForms(current => ({ ...current, [section.id]: emptyLesson })); setNotice("Lesson saved."); await loadCurriculum(); }
    setBusy(false);
  }

  async function updateLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingLesson) return;
    setBusy(true); setError(""); setNotice("");
    const duration = Number(editingLesson.duration_minutes);
    if (!Number.isInteger(duration) || duration < 0) { setError("Enter a valid lesson duration."); setBusy(false); return; }
    const { error: updateError } = await createClient().from("academy_lessons")
      .update({
        title: editingLesson.title.trim(), description: editingLesson.description.trim(),
        content: editingLesson.content.trim(), video_url: editingLesson.video_url?.trim() || null,
        duration_minutes: duration, is_preview: editingLesson.is_preview
      }).eq("id", editingLesson.id);
    if (updateError) setError("Couldn't update this lesson.");
    else { setEditingLesson(null); setNotice("Lesson updated."); await loadCurriculum(); }
    setBusy(false);
  }

  async function moveLesson(section: Section, lesson: Lesson, direction: -1 | 1) {
    const index = section.lessons.findIndex(item => item.id === lesson.id);
    const target = section.lessons[index + direction];
    if (!target) return;
    setBusy(true); setError("");
    const supabase = createClient();
    const first = await supabase.from("academy_lessons").update({ sort_order: -1 }).eq("id", lesson.id);
    const second = first.error ? first : await supabase.from("academy_lessons").update({ sort_order: lesson.sort_order }).eq("id", target.id);
    const third = second.error ? second : await supabase.from("academy_lessons").update({ sort_order: target.sort_order }).eq("id", lesson.id);
    if (third.error) setError("Couldn't change the lesson order. Refresh and try again.");
    await loadCurriculum(); setBusy(false);
  }

  async function deleteLesson(lesson: Lesson) {
    if (!window.confirm("Delete this lesson?")) return;
    setBusy(true); setError(""); setNotice("");
    const { error: deleteError } = await createClient().from("academy_lessons").delete().eq("id", lesson.id);
    if (deleteError) setError("Couldn't delete this lesson.");
    else { setNotice("Lesson deleted."); await loadCurriculum(); }
    setBusy(false);
  }

  async function moveSection(section: Section, direction: -1 | 1) {
    const index = sections.findIndex(s => s.id === section.id);
    const target = sections[index + direction];
    if (!target) return;
    setBusy(true); setError("");
    const supabase = createClient();
    const first = await supabase.from("academy_sections").update({ sort_order: -1 }).eq("id", section.id);
    const second = first.error ? first : await supabase.from("academy_sections").update({ sort_order: section.sort_order }).eq("id", target.id);
    const third = second.error ? second : await supabase.from("academy_sections").update({ sort_order: target.sort_order }).eq("id", section.id);
    if (third.error) setError("Couldn't change the section order. Refresh and try again.");
    await loadCurriculum(); setBusy(false);
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading curriculum...</main>;

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10"><div className="mx-auto max-w-5xl">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/academy/instructor" className="text-sm font-bold text-teal-700">← Instructor Centre</Link><p className="mt-3 text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Academy · Curriculum Builder</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">{course?.title ?? "Course curriculum"}</h1><p className="mt-2 text-sm text-slate-600">Organise your course into sections and lessons. Your work is saved as you add or update content.</p></div><span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{course?.status ?? "draft"}</span></header>
    {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-800">{notice}</p>}
    <div className="mt-6"><Link href={"/academy/instructor/courses/"+courseId+"/assessments"} className="inline-flex rounded-xl border border-teal-200 bg-white px-5 py-3 text-sm font-bold text-teal-700">Manage course assessments →</Link></div>
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-extrabold text-slate-900">Add a section</h2><form onSubmit={addSection} className="mt-4 grid gap-3 md:grid-cols-2"><input required maxLength={140} value={sectionTitle} onChange={e=>setSectionTitle(e.target.value)} placeholder="Section title (e.g. Getting started)" className="rounded-xl border border-slate-200 px-4 py-3 text-sm"/><input value={sectionDescription} onChange={e=>setSectionDescription(e.target.value)} placeholder="What this section covers (optional)" className="rounded-xl border border-slate-200 px-4 py-3 text-sm"/><button disabled={busy || !course} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50 md:col-span-2">Add section</button></form></section>
    <section className="mt-7 space-y-5"><div><h2 className="text-xl font-extrabold text-slate-900">Course curriculum</h2><p className="mt-1 text-sm text-slate-500">{sections.length} sections · {sections.reduce((n,s)=>n+s.lessons.length,0)} lessons</p></div>
      {sections.length===0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No sections yet. Add your first section above.</div>}
      {sections.map((section,index)=><article key={section.id} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Section {index+1}</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">{section.title}</h3>{section.description && <p className="mt-1 text-sm text-slate-500">{section.description}</p>}</div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || index===0} onClick={()=>moveSection(section,-1)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">Move up</button><button type="button" disabled={busy || index===sections.length-1} onClick={()=>moveSection(section,1)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">Move down</button><button type="button" disabled={busy} onClick={()=>deleteSection(section)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-40">Delete</button></div></div>
        <div className="mt-5 space-y-3">{section.lessons.map((lesson,lessonIndex)=><div key={lesson.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-slate-500">Lesson {lessonIndex+1} · {lesson.duration_minutes} min {lesson.is_preview ? "· Free preview" : ""}</p><h4 className="mt-1 font-bold text-slate-900">{lesson.title}</h4></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || lessonIndex===0} onClick={()=>moveLesson(section,lesson,-1)} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold disabled:opacity-40">↑</button><button type="button" disabled={busy || lessonIndex===section.lessons.length-1} onClick={()=>moveLesson(section,lesson,1)} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold disabled:opacity-40">↓</button><button type="button" onClick={()=>setEditingLesson(lesson)} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold">Edit</button><button type="button" disabled={busy} onClick={()=>deleteLesson(lesson)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700">Delete</button></div></div></div>)}</div>
        <form onSubmit={e=>saveLesson(e,section)} className="mt-5 grid gap-3"><h4 className="text-sm font-extrabold text-slate-800">Add a lesson</h4><input required maxLength={160} value={(lessonForms[section.id]??emptyLesson).title} onChange={e=>setLessonForms(v=>({...v,[section.id]:{...(v[section.id]??emptyLesson),title:e.target.value}}))} placeholder="Lesson title" className="rounded-xl border border-slate-200 px-4 py-3 text-sm"/><input value={(lessonForms[section.id]??emptyLesson).description} onChange={e=>setLessonForms(v=>({...v,[section.id]:{...(v[section.id]??emptyLesson),description:e.target.value}}))} placeholder="Short lesson description" className="rounded-xl border border-slate-200 px-4 py-3 text-sm"/><textarea rows={5} value={(lessonForms[section.id]??emptyLesson).content} onChange={e=>setLessonForms(v=>({...v,[section.id]:{...(v[section.id]??emptyLesson),content:e.target.value}}))} placeholder="Lesson notes, instructions or learning material" className="rounded-xl border border-slate-200 px-4 py-3 text-sm"/><div className="grid gap-3 md:grid-cols-2"><input type="url" value={(lessonForms[section.id]??emptyLesson).video_url} onChange={e=>setLessonForms(v=>({...v,[section.id]:{...(v[section.id]??emptyLesson),video_url:e.target.value}}))} placeholder="Optional video URL (https://...)" className="rounded-xl border border-slate-200 px-4 py-3 text-sm"/><input type="number" min="0" step="1" value={(lessonForms[section.id]??emptyLesson).duration_minutes} onChange={e=>setLessonForms(v=>({...v,[section.id]:{...(v[section.id]??emptyLesson),duration_minutes:e.target.value}}))} placeholder="Duration in minutes" className="rounded-xl border border-slate-200 px-4 py-3 text-sm"/></div><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={(lessonForms[section.id]??emptyLesson).is_preview} onChange={e=>setLessonForms(v=>({...v,[section.id]:{...(v[section.id]??emptyLesson),is_preview:e.target.checked}}))}/> Make this lesson a free preview (visible after course publication)</label><button disabled={busy} className="justify-self-start rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Save lesson</button></form>
      </article>)}
    </section>
    {editingLesson && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><form onSubmit={updateLesson} className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-2xl bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Edit lesson</h2><button type="button" onClick={()=>setEditingLesson(null)} className="text-sm font-bold text-slate-500">Close</button></div><input required value={editingLesson.title} onChange={e=>setEditingLesson({...editingLesson,title:e.target.value})} className="w-full rounded-xl border px-4 py-3 text-sm" placeholder="Lesson title"/><input value={editingLesson.description} onChange={e=>setEditingLesson({...editingLesson,description:e.target.value})} className="w-full rounded-xl border px-4 py-3 text-sm" placeholder="Description"/><textarea rows={7} value={editingLesson.content} onChange={e=>setEditingLesson({...editingLesson,content:e.target.value})} className="w-full rounded-xl border px-4 py-3 text-sm" placeholder="Lesson content"/><input type="url" value={editingLesson.video_url??""} onChange={e=>setEditingLesson({...editingLesson,video_url:e.target.value})} className="w-full rounded-xl border px-4 py-3 text-sm" placeholder="Video URL"/><input type="number" min="0" value={editingLesson.duration_minutes} onChange={e=>setEditingLesson({...editingLesson,duration_minutes:Number(e.target.value)})} className="w-full rounded-xl border px-4 py-3 text-sm" placeholder="Duration in minutes"/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingLesson.is_preview} onChange={e=>setEditingLesson({...editingLesson,is_preview:e.target.checked})}/> Free preview</label><button disabled={busy} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Save changes</button></form></div>}
  </div></main>;
}
