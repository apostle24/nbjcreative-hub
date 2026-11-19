"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Application = {
  id: string; job_id: string; applicant_id: string; cover_letter: string;
  status: string; employer_note: string | null; quality_score: number | null;
  interview_at: string | null; created_at: string; resume_storage_path: string | null; resume_file_name: string | null;
  job: { title: string; slug: string } | null;
};

const statuses = [
  ["viewed","Viewed"],["shortlisted","Shortlisted"],["interviewing","Interview"],["accepted","Accepted"],["rejected","Rejected"]
];

export default function EmployerApplicationsPage() {
  const [loading,setLoading] = useState(true);
  const [applications,setApplications] = useState<Application[]>([]);
  const [filter,setFilter] = useState("all");
  const [drafts,setDrafts] = useState<Record<string,{status:string;note:string;score:string;interviewAt:string}>>({});
  const [busy,setBusy] = useState("");
  const [cvBusy,setCvBusy] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  async function load() {
    const supabase=createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){window.location.assign("/account?next=/work/employer/applications");return;}
    const {data:employer,error:employerError}=await supabase.from("work_employer_profiles").select("id").eq("owner_id",user.id).maybeSingle();
    if(employerError){setError("We couldn't load your employer account.");setLoading(false);return;}
    if(!employer){setError("Create your employer profile before reviewing applications.");setLoading(false);return;}
    const {data:jobs,error:jobsError}=await supabase.from("work_job_posts").select("id,title,slug").eq("employer_id",employer.id);
    if(jobsError){setError("We couldn't load your opportunities.");setLoading(false);return;}
    const jobRows=jobs??[];
    if(jobRows.length===0){setApplications([]);setLoading(false);return;}
    const {data:rows,error:appError}=await supabase.from("work_job_applications")
      .select("id,job_id,applicant_id,cover_letter,status,employer_note,quality_score,interview_at,created_at,resume_storage_path,resume_file_name")
      .in("job_id",jobRows.map(j=>j.id)).order("created_at",{ascending:false});
    if(appError){setError("We couldn't load applications. Please check that the NBJ Work hiring update has been installed.");setLoading(false);return;}
    const jobMap=new Map(jobRows.map(j=>[j.id,{title:j.title,slug:j.slug}]));
    const mapped=(rows??[]).map((a:any)=>({...a,job:jobMap.get(a.job_id)??null})) as Application[];
    setApplications(mapped);
    setDrafts(Object.fromEntries(mapped.map(a=>[a.id,{
      status:a.status==="submitted"?"viewed":a.status,
      note:a.employer_note??"",score:a.quality_score?.toString()??"",
      interviewAt:a.interview_at?new Date(a.interview_at).toISOString().slice(0,16):""
    }])));
    setLoading(false);
  }

  useEffect(()=>{load();},[]);

  async function save(applicationId:string){
    const draft=drafts[applicationId];if(!draft)return;
    setBusy(applicationId);setError("");setNotice("");
    const response=await fetch("/api/work/employer/applications/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      applicationId,status:draft.status,employerNote:draft.note,qualityScore:draft.score||null,
      interviewAt:draft.status==="interviewing"?draft.interviewAt:null
    })});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.ok)setError(result.error||"We couldn't save this review.");
    else {setNotice("Application review saved.");await load();}
    setBusy("");
  }

  async function openCv(applicationId:string){
    const popup=window.open("about:blank","_blank");
    if(!popup){setError("Allow pop-ups for this site to open candidate CVs.");return;}
    setCvBusy(applicationId);setError("");
    try{
      const response=await fetch("/api/work/employer/applications/cv",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicationId})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok){popup.close();setError(result.error||"Could not open this CV.");}
      else popup.location.href=result.url;
    }catch{popup.close();setError("Could not open this CV. Please try again.");}
    setCvBusy("");
  }

  const visible=filter==="all"?applications:applications.filter(a=>a.status===filter);
  if(loading)return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading applications...</main>;

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10"><div className="mx-auto max-w-5xl">
    <Link href="/work" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
    <div className="mt-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Work · Employer workspace</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Applications & hiring</h1><p className="mt-2 text-sm text-slate-600">Review candidate responses, assess quality and manage hiring decisions.</p></div><Link href="/work/employer/jobs" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">Manage opportunities</Link></div>
    <div className="mt-7 flex flex-wrap gap-2">{["all","submitted","viewed","shortlisted","interviewing","accepted","rejected"].map(s=><button key={s} onClick={()=>setFilter(s)} className={"rounded-full px-4 py-2 text-xs font-bold capitalize "+(filter===s?"bg-slate-900 text-white":"border border-slate-200 bg-white text-slate-600")}>{s==="all"?"All":s}</button>)}</div>
    {error&&<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {notice&&<p role="status" className="mt-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-800">{notice}</p>}
    <section className="mt-5 space-y-4">{visible.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No applications in this view yet. Applications submitted to your NBJ Work listings will appear here.</div>:visible.map(a=><article key={a.id} className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold text-slate-900">{a.job?.title??"Opportunity"}</h2><p className="mt-1 text-xs text-slate-500">Applicant reference: {a.applicant_id.slice(0,8)} · Received {new Date(a.created_at).toLocaleString()}</p><span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-700">{a.status}</span></div><Link href={a.job?"/work/"+a.job.slug:"/work"} className="text-xs font-bold text-teal-700 hover:underline">View listing</Link></div>
      <div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Applicant's response</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{a.cover_letter}</p></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Hiring decision<select value={drafts[a.id]?.status??a.status} onChange={e=>setDrafts(p=>({...p,[a.id]:{...p[a.id],status:e.target.value}}))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3">{statuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Application quality (1–5)<select value={drafts[a.id]?.score??""} onChange={e=>setDrafts(p=>({...p,[a.id]:{...p[a.id],score:e.target.value}}))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"><option value="">Not rated</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} – {["","Needs improvement","Fair","Good","Very good","Excellent"][n]}</option>)}</select></label>
        {drafts[a.id]?.status==="interviewing"&&<label className="text-sm font-semibold text-slate-700 md:col-span-2">Interview date and time<input type="datetime-local" value={drafts[a.id]?.interviewAt??""} onChange={e=>setDrafts(p=>({...p,[a.id]:{...p[a.id],interviewAt:e.target.value}}))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3"/></label>}
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Private employer notes<textarea rows={3} maxLength={2000} value={drafts[a.id]?.note??""} onChange={e=>setDrafts(p=>({...p,[a.id]:{...p[a.id],note:e.target.value}}))} placeholder="Record strengths, concerns or interview feedback. Only your employer team can see this." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>
      </div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">CV attachment</p><p className="mt-1 text-sm font-semibold text-slate-700">{a.resume_file_name||"No CV attached"}</p></div>{a.resume_storage_path&&<button type="button" onClick={()=>openCv(a.id)} disabled={cvBusy===a.id} className="rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-60">{cvBusy===a.id?"Preparing CV...":"Open candidate CV"}</button>}</div>
      <button onClick={()=>save(a.id)} disabled={busy===a.id} className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">{busy===a.id?"Saving...":"Save hiring review"}</button>
    </article>)}</section>
    <div className="mt-8"><Link href="/work/employer" className="text-sm font-semibold text-teal-700 hover:underline">← Employer profile</Link></div>
  </div></main>;
}
