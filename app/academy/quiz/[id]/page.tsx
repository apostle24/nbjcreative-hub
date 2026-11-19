"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Quiz={id:string;course_id:string;title:string;instructions:string;pass_mark:number};
type Question={id:string;prompt:string;options:string[];sort_order:number};
type Result={score:number;total_questions:number;passed:boolean};

export default function StudentQuizPage(){
 const {id}=useParams<{id:string}>();
 const [quiz,setQuiz]=useState<Quiz|null>(null);
 const [questions,setQuestions]=useState<Question[]>([]);
 const [answers,setAnswers]=useState<Record<string,number>>({});
 const [attemptId,setAttemptId]=useState("");
 const [result,setResult]=useState<Result|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{let live=true;(async()=>{
   const db=createClient();const {data:{user}}=await db.auth.getUser();
   if(!user){window.location.assign("/account?next="+encodeURIComponent("/academy/quiz/"+id));return;}
   const {data:q,error:qerr}=await db.from("academy_quizzes").select("id,course_id,title,instructions,pass_mark").eq("id",id).eq("is_published",true).single();
   if(qerr||!q){if(live){setError("This assessment is unavailable.");setLoading(false);}return;}
   const {data:enrol}=await db.from("academy_enrollments").select("id").eq("course_id",q.course_id).eq("student_id",user.id).eq("status","active").maybeSingle();
   if(!enrol){if(live){setError("Enrol in this course before taking its assessment.");setLoading(false);}return;}
   const {data:qs,error:qsErr}=await db.from("academy_quiz_questions").select("id,prompt,options,sort_order").eq("quiz_id",id).order("sort_order");
   if(qsErr||!qs?.length){if(live){setError("This assessment has no available questions.");setLoading(false);}return;}
   const {data:attempt,error:attemptErr}=await db.from("academy_quiz_attempts").insert({quiz_id:id,student_id:user.id}).select("id").single();
   if(attemptErr){if(live){setError("Could not start your assessment. Please try again.");setLoading(false);}return;}
   if(live){setQuiz(q as Quiz);setQuestions(qs as Question[]);setAttemptId(attempt.id);setLoading(false);}
 })();return()=>{live=false;}},[id]);
 async function submit(){
   if(!attemptId||!quiz)return;
   if(Object.keys(answers).length!==questions.length){setError("Please answer every question before submitting.");return;}
   setBusy(true);setError("");
   const db=createClient();
   const rows=questions.map(q=>({attempt_id:attemptId,question_id:q.id,selected_option:answers[q.id]}));
   const {error:answerErr}=await db.from("academy_quiz_responses").insert(rows);
   if(answerErr){setError("We couldn't save your answers. Please try submitting again.");setBusy(false);return;}
   const {data:scoreData,error:scoreErr}=await db.rpc("submit_academy_quiz_attempt",{p_attempt_id:attemptId});
   if(scoreErr){setError("Your answers were saved, but scoring failed. Please contact support.");setBusy(false);return;}
   const scored=Array.isArray(scoreData)?scoreData[0]:scoreData;
   setResult({score:scored.score,total_questions:scored.total_questions,passed:scored.passed});setBusy(false);
 }
 if(loading)return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Preparing assessment...</main>;
 return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10"><div className="mx-auto max-w-3xl"><Link href="/academy" className="text-sm font-bold text-teal-700">← NBJ Academy</Link>
 {error&&<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
 {quiz&&<><header className="mt-5 rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Academy · Assessment</p><h1 className="mt-2 text-2xl font-extrabold text-slate-900">{quiz.title}</h1><p className="mt-2 text-sm text-slate-600">{quiz.instructions}</p><p className="mt-3 text-xs font-semibold text-slate-500">{questions.length} questions · Pass mark {quiz.pass_mark}%</p></header>
 {!result?<><div className="mt-5 space-y-4">{questions.map((q,i)=><section key={q.id} className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Question {i+1} of {questions.length}</p><h2 className="mt-2 font-bold text-slate-900">{q.prompt}</h2><div className="mt-4 space-y-2">{q.options.map((option,index)=><label key={index} className={"flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm "+(answers[q.id]===index?"border-teal-500 bg-teal-50":"border-slate-200")}><input type="radio" name={q.id} checked={answers[q.id]===index} onChange={()=>setAnswers(v=>({...v,[q.id]:index}))}/><span>{option}</span></label>)}</div></section>)}</div><button type="button" disabled={busy} onClick={submit} className="mt-5 w-full rounded-xl bg-teal-700 px-5 py-4 text-sm font-bold text-white disabled:opacity-50">{busy?"Submitting...":"Submit assessment"}</button></>
 :<section className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Assessment result</p><h2 className="mt-3 text-4xl font-extrabold text-slate-900">{result.score}%</h2><p className={"mt-2 font-bold "+(result.passed?"text-emerald-700":"text-amber-700")}>{result.passed?"You passed!":"Not passed yet"}</p><p className="mt-2 text-sm text-slate-500">{result.total_questions} questions · Required {quiz.pass_mark}%</p><Link href={"/academy/course/"+""} className="mt-5 inline-block rounded-xl border px-5 py-3 text-sm font-bold text-slate-700">Return to Academy</Link></section>}</>}
 </div></main>;
}
