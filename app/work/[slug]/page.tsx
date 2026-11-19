"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Job = {
 id:string; title:string; slug:string; description:string; opportunity_type:string;
 workplace_type:string; location:string|null; country:string|null;
 salary_min:number|string|null; salary_max:number|string|null; currency:string;
 application_deadline:string|null; application_url:string|null; application_email:string|null;
 employer:{company_name:string;company_slug:string;description:string|null;website_url:string|null}|null;
};

export default function WorkOpportunityPage() {
 const params = useParams<{slug:string}>();
 const [job,setJob] = useState<Job|null>(null);
 const [loading,setLoading] = useState(true);
 const [error,setError] = useState("");
 const [coverLetter,setCoverLetter] = useState("");
 const [busy,setBusy] = useState(false);
 const [message,setMessage] = useState("");
 const [formError,setFormError] = useState("");

 useEffect(()=>{
  let active=true;
  async function load(){
   const supabase=createClient();
   const {data,error}=await supabase.from("work_job_posts")
    .select("id,title,slug,description,opportunity_type,workplace_type,location,country,salary_min,salary_max,currency,application_deadline,application_url,application_email,employer:work_employer_profiles(company_name,company_slug,description,website_url)")
    .eq("slug",params.slug).eq("status","published").maybeSingle();
   if(!active)return;
   if(error || !data)setError("This opportunity is unavailable or may have closed.");
   else setJob(data as unknown as Job);
   setLoading(false);
  }
  if(params.slug)load();
  return ()=>{active=false};
 },[params.slug]);

 async function apply(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage("");setFormError("");
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){window.location.assign("/account?next="+encodeURIComponent("/work/"+params.slug));return;}
  if(!job){setBusy(false);return;}
  const {error}=await supabase.from("work_job_applications").insert({
   job_id:job.id,applicant_id:user.id,cover_letter:coverLetter.trim()
  });
  if(error)setFormError(error.code==="23505"?"You have already applied for this opportunity.":error.message);
  else {setMessage("Your application has been submitted successfully.");setCoverLetter("");}
  setBusy(false);
 }

 function compensation(){
  if(!job)return "";
  if(job.salary_min==null&&job.salary_max==null)return "Compensation not specified";
  const f=(n:number|string)=>new Intl.NumberFormat("en",{style:"currency",currency:job.currency}).format(Number(n));
  if(job.salary_min!=null&&job.salary_max!=null)return f(job.salary_min)+" – "+f(job.salary_max);
  return job.salary_min!=null?"From "+f(job.salary_min):"Up to "+f(job.salary_max!);
 }

 return <main className="min-h-screen bg-[#F5F7F8]"><header className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-4xl px-5 py-5"><Link href="/work" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link></div></header>
 <div className="mx-auto max-w-4xl px-5 py-10">
 <Link href="/work" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:underline"><ArrowLeft size={16}/> All opportunities</Link>
 {loading?<div className="mt-7 rounded-2xl bg-white p-12 text-center text-sm text-slate-500">Loading opportunity...</div>:error?<div className="mt-7 rounded-2xl bg-white p-10 text-center text-sm text-rose-700">{error}</div>:job&&<>
 <article className="mt-7 rounded-3xl border border-slate-200 bg-white p-7 md:p-10">
 <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Work opportunity</p>
 <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">{job.title}</h1>
 <p className="mt-3 text-base font-semibold text-slate-600">{job.employer?.company_name??"Independent client"}</p>
 <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-slate-600"><span className="rounded-full bg-teal-50 px-3 py-2 text-teal-800">{job.opportunity_type.replace("_"," ")}</span><span className="rounded-full bg-slate-100 px-3 py-2">{job.workplace_type}</span><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2"><MapPin size={13}/>{[job.location,job.country].filter(Boolean).join(", ")||"Location flexible"}</span></div>
 <p className="mt-5 text-sm font-bold text-slate-900">{compensation()}</p>
 {job.application_deadline&&<p className="mt-2 text-xs text-slate-500">Application deadline: {new Date(job.application_deadline+"T00:00:00").toLocaleDateString()}</p>}
 <div className="my-8 border-t border-slate-100"/>
 <h2 className="text-lg font-extrabold text-slate-900">About this opportunity</h2><div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{job.description}</div>
 {job.employer?.description&&<><h2 className="mt-8 text-lg font-extrabold text-slate-900">About the organisation</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{job.employer.description}</p></>}
 {job.employer?.website_url&&<a href={job.employer.website_url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-bold text-teal-700 hover:underline">Organisation website</a>}
 </article>
 {job.application_url||job.application_email?<section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7"><h2 className="font-extrabold text-slate-900">How to apply</h2><p className="mt-2 text-sm text-slate-600">The employer has provided an external application channel.</p>{job.application_url&&<a href={job.application_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-teal-700">Go to application page</a>}{job.application_email&&<p className="mt-4 text-sm text-slate-600">Email: <a className="font-semibold text-teal-700" href={"mailto:"+job.application_email}>{job.application_email}</a></p>}</section>:
 <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7"><div className="flex items-center gap-2"><BriefcaseBusiness className="text-teal-700"/><h2 className="text-xl font-extrabold text-slate-900">Apply for this opportunity</h2></div><p className="mt-2 text-sm text-slate-600">Sign in to submit your application. Your application is shared only with the employer and authorised administrators.</p>
 <form onSubmit={apply} className="mt-5 space-y-4"><label className="block text-sm font-semibold text-slate-700">Cover letter<textarea required minLength={20} maxLength={5000} value={coverLetter} onChange={e=>setCoverLetter(e.target.value)} rows={7} placeholder="Introduce yourself and explain why you're a good fit..." className="mt-2 w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus:border-teal-700"/></label>
 {formError&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{formError}</p>}{message&&<p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}
 <button disabled={busy||!!message} className="rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">{busy?"Submitting...":"Submit application"}</button></form></section>}
 </>}
 </div></main>;
}
