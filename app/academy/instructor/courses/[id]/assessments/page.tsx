"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Quiz = { id:string; title:string; instructions:string; pass_mark:number; is_published:boolean; };
type Question = { id:string; prompt:string; options:string[]; correct_option:number; sort_order:number; };
const blankOptions = ["","","",""];

export default function CourseAssessmentsPage() {
  const { id: courseId } = useParams<{id:string}>();
  const [courseTitle,setCourseTitle]=useState("");
  const [quizzes,setQuizzes]=useState<Quiz[]>([]);
  const [questions,setQuestions]=useState<Record<string,Question[]>>({});
  const [title,setTitle]=useState("");
  const [instructions,setInstructions]=useState("");
  const [passMark,setPassMark]=useState("70");
  const [activeQuiz,setActiveQuiz]=useState("");
  const [prompt,setPrompt]=useState("");
  const [options,setOptions]=useState(blankOptions);
  const [correct,setCorrect]=useState("0");
  const [editing,setEditing]=useState<Question|null>(null);
  const [editOptions,setEditOptions]=useState<string[]>(blankOptions);
  const [editCorrect,setEditCorrect]=useState("0");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function load(){
    const db=createClient();
    const {data:course}=await db.from("academy_courses").select("title").eq("id",courseId).single();
    if(course)setCourseTitle(course.title);
    const {data:quizRows,error:quizError}=await db.from("academy_quizzes").select("id,title,instructions,pass_mark,is_published").eq("course_id",courseId).order("created_at");
    if(quizError){setError("Unable to load assessments.");setLoading(false);return;}
    const list=(quizRows??[]) as Quiz[];
    setQuizzes(list);
    const map:Record<string,Question[]>={};
    for(const quiz of list){
      const {data:rows}=await db.from("academy_quiz_questions").select("id,prompt,options,sort_order").eq("quiz_id",quiz.id).order("sort_order");
      const qrows=rows??[];
      const withKeys:Question[]=[];
      for(const q of qrows){
        const {data:key}=await db.from("academy_quiz_answer_keys").select("correct_option").eq("question_id",q.id).maybeSingle();
        withKeys.push({...q,options:Array.isArray(q.options)?q.options:[],correct_option:key?.correct_option??0});
      }
      map[quiz.id]=withKeys;
    }
    setQuestions(map);setLoading(false);
  }
  useEffect(()=>{load();},[courseId]);

  async function createQuiz(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError("");setNotice("");
    const mark=Number(passMark);
    if(!Number.isInteger(mark)||mark<0||mark>100){setError("Pass mark must be between 0 and 100.");setBusy(false);return;}
    const {data,error:err}=await createClient().from("academy_quizzes").insert({course_id:courseId,title:title.trim(),instructions:instructions.trim(),pass_mark:mark}).select("id").single();
    if(err)setError("Could not create the assessment.");
    else{setTitle("");setInstructions("");setPassMark("70");setActiveQuiz(data.id);setNotice("Assessment created as a draft.");await load();}
    setBusy(false);
  }
  async function addQuestion(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!activeQuiz)return;
    const cleaned=options.map(v=>v.trim()).filter(Boolean);
    if(cleaned.length<2){setError("Add at least two answer options.");return;}
    const answer=Number(correct);
    if(answer<0||answer>=cleaned.length){setError("Choose a valid correct answer.");return;}
    setBusy(true);setError("");setNotice("");
    const db=createClient();
    const {data,error:err}=await db.from("academy_quiz_questions").insert({quiz_id:activeQuiz,prompt:prompt.trim(),options:cleaned,sort_order:(questions[activeQuiz]??[]).length}).select("id").single();
    if(err)setError("Could not add this question.");
    else{
      const {error:keyErr}=await db.from("academy_quiz_answer_keys").insert({question_id:data.id,correct_option:answer});
      if(keyErr)setError("Question saved, but its answer key could not be saved. Please retry by editing the question.");
      else{setPrompt("");setOptions(blankOptions);setCorrect("0");setNotice("Question added.");await load();}
    }
    setBusy(false);
  }
  async function saveQuestion(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!editing)return;
    const cleaned=editOptions.map(v=>v.trim()).filter(Boolean);
    if(cleaned.length<2||Number(editCorrect)>=cleaned.length){setError("Add at least two options and select a valid answer.");return;}
    setBusy(true);setError("");setNotice("");
    const db=createClient();
    const {error:updateErr}=await db.from("academy_quiz_questions").update({prompt:editing.prompt.trim(),options:cleaned}).eq("id",editing.id);
    const {error:keyErr}=updateErr?{error:updateErr}:await db.from("academy_quiz_answer_keys").upsert({question_id:editing.id,correct_option:Number(editCorrect)});
    if(keyErr)setError("Could not update the question.");
    else{setEditing(null);setNotice("Question updated.");await load();}
    setBusy(false);
  }
  async function deleteQuestion(q:Question){
    if(!window.confirm("Delete this question?"))return;
    setBusy(true);
    const {error:err}=await createClient().from("academy_quiz_questions").delete().eq("id",q.id);
    if(err)setError("Could not delete question.");else{setNotice("Question deleted.");await load();}
    setBusy(false);
  }
  async function togglePublish(quiz:Quiz){
    const count=(questions[quiz.id]??[]).length;
    if(!quiz.is_published&&count===0){setError("Add at least one question before publishing.");return;}
    setBusy(true);setError("");setNotice("");
    const {error:err}=await createClient().from("academy_quizzes").update({is_published:!quiz.is_published,updated_at:new Date().toISOString()}).eq("id",quiz.id);
    if(err)setError("Could not update assessment publication.");
    else{setNotice(quiz.is_published?"Assessment unpublished.":"Assessment published for enrolled students.");await load();}
    setBusy(false);
  }
  if(loading)return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Loading assessments...</main>;
  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10"><div className="mx-auto max-w-5xl">
    <Link href={"/academy/instructor/courses/"+courseId} className="text-sm font-bold text-teal-700">← Back to curriculum</Link>
    <p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Academy · Assessments</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">{courseTitle||"Course assessments"}</h1><p className="mt-2 text-sm text-slate-600">Create quizzes, set a pass mark and publish them for enrolled students.</p>
    {error&&<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}{notice&&<p role="status" className="mt-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-800">{notice}</p>}
    <form onSubmit={createQuiz} className="mt-7 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-extrabold">Create assessment</h2><div className="mt-4 grid gap-3"><input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Assessment title" className="rounded-xl border px-4 py-3 text-sm"/><textarea rows={3} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="Instructions for students" className="rounded-xl border px-4 py-3 text-sm"/><label className="text-sm font-semibold text-slate-600">Pass mark (%)<input type="number" min="0" max="100" value={passMark} onChange={e=>setPassMark(e.target.value)} className="mt-1 block w-32 rounded-xl border px-4 py-3"/></label><button disabled={busy} className="justify-self-start rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white">Create draft assessment</button></div></form>
    <div className="mt-7 space-y-5"><h2 className="text-xl font-extrabold text-slate-900">Your assessments</h2>{quizzes.length===0&&<p className="rounded-xl bg-white p-6 text-sm text-slate-500">No assessments created yet.</p>}
      {quizzes.map(quiz=><article key={quiz.id} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-extrabold">{quiz.title}</h3><p className="mt-1 text-xs text-slate-500">{(questions[quiz.id]??[]).length} questions · Pass mark {quiz.pass_mark}%</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold">{quiz.is_published?"Published":"Draft"}</span><button type="button" disabled={busy} onClick={()=>togglePublish(quiz)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white">{quiz.is_published?"Unpublish":"Publish"}</button></div></div>
        {(questions[quiz.id]??[]).map((q,i)=><div key={q.id} className="mt-4 rounded-xl bg-slate-50 p-4"><div className="flex justify-between gap-3"><div><p className="text-xs text-slate-500">Question {i+1}</p><p className="mt-1 font-semibold">{q.prompt}</p><ul className="mt-2 list-inside list-disc text-sm text-slate-600">{q.options.map((o,j)=><li key={j}>{o}{j===q.correct_option?" · Correct answer":""}</li>)}</ul></div><div className="flex gap-2"><button type="button" onClick={()=>{setEditing(q);setEditOptions([...q.options,"",""].slice(0,4));setEditCorrect(String(q.correct_option));}} className="text-xs font-bold text-teal-700">Edit</button><button type="button" disabled={busy} onClick={()=>deleteQuestion(q)} className="text-xs font-bold text-rose-700">Delete</button></div></div></div>)}
        <button type="button" onClick={()=>setActiveQuiz(activeQuiz===quiz.id?"":quiz.id)} className="mt-4 rounded-xl border border-teal-200 px-4 py-2.5 text-sm font-bold text-teal-700">{activeQuiz===quiz.id?"Close question form":"Add question"}</button>
        {activeQuiz===quiz.id&&<form onSubmit={addQuestion} className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4"><input required value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Write the question" className="w-full rounded-xl border px-4 py-3 text-sm"/>{options.map((option,index)=><input key={index} value={option} onChange={e=>setOptions(v=>v.map((x,i)=>i===index?e.target.value:x))} placeholder={"Option "+String.fromCharCode(65+index)} className="w-full rounded-xl border px-4 py-3 text-sm"/>)}<label className="block text-sm font-semibold">Correct answer<select value={correct} onChange={e=>setCorrect(e.target.value)} className="ml-3 rounded-lg border px-3 py-2">{options.map((o,i)=>o.trim()&&<option key={i} value={i}>{String.fromCharCode(65+i)} — {o}</option>)}</select></label><button disabled={busy} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white">Save question</button></form>}
      </article>)}
    </div>
    {editing&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><form onSubmit={saveQuestion} className="w-full max-w-xl space-y-3 rounded-2xl bg-white p-6"><h2 className="text-lg font-extrabold">Edit question</h2><textarea required value={editing.prompt} onChange={e=>setEditing({...editing,prompt:e.target.value})} className="w-full rounded-xl border p-3 text-sm"/>{editOptions.map((o,i)=><input key={i} value={o} onChange={e=>setEditOptions(v=>v.map((x,j)=>j===i?e.target.value:x))} placeholder={"Option "+String.fromCharCode(65+i)} className="w-full rounded-xl border px-4 py-3 text-sm"/>)}<label className="block text-sm">Correct answer<select value={editCorrect} onChange={e=>setEditCorrect(e.target.value)} className="ml-3 rounded-lg border p-2">{editOptions.map((o,i)=>o.trim()&&<option key={i} value={i}>{String.fromCharCode(65+i)} — {o}</option>)}</select></label><div className="flex gap-2"><button disabled={busy} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white">Save changes</button><button type="button" onClick={()=>setEditing(null)} className="rounded-xl border px-5 py-3 text-sm font-bold">Cancel</button></div></form></div>}
  </div></main>;
}
