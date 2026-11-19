"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Employer = { id: string; company_name: string };
type Job = {
  id: string; title: string; slug: string; opportunity_type: string;
  workplace_type: string; location: string | null; country: string | null;
  status: string; created_at: string; application_deadline: string | null;
};

const types = [
  ["full_time","Full-time"],["part_time","Part-time"],["contract","Contract"],
  ["freelance","Freelance"],["internship","Internship"],["volunteer","Volunteer"]
];

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function EmployerJobsPage() {
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [employer,setEmployer] = useState<Employer|null>(null);
  const [jobs,setJobs] = useState<Job[]>([]);
  const [title,setTitle] = useState("");
  const [description,setDescription] = useState("");
  const [type,setType] = useState("full_time");
  const [workplace,setWorkplace] = useState("remote");
  const [location,setLocation] = useState("");
  const [country,setCountry] = useState("");
  const [salaryMin,setSalaryMin] = useState("");
  const [salaryMax,setSalaryMax] = useState("");
  const [currency,setCurrency] = useState("USD");
  const [deadline,setDeadline] = useState("");
  const [applicationUrl,setApplicationUrl] = useState("");
  const [applicationEmail,setApplicationEmail] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  async function loadJobs(profileId: string) {
    const supabase = createClient();
    const {data,error:loadError} = await supabase.from("work_job_posts")
      .select("id,title,slug,opportunity_type,workplace_type,location,country,status,created_at,application_deadline")
      .eq("employer_id",profileId).order("created_at",{ascending:false});
    if(loadError) setError("We couldn't load your listings. Please refresh.");
    else setJobs((data??[]) as Job[]);
  }

  useEffect(()=>{
    let active=true;
    async function load(){
      const supabase=createClient();
      const {data:{user}}=await supabase.auth.getUser();
      if(!active)return;
      if(!user){window.location.assign("/account?next=/work/employer/jobs");return;}
      const {data,error:profileError}=await supabase.from("work_employer_profiles")
        .select("id,company_name").eq("owner_id",user.id).maybeSingle();
      if(!active)return;
      if(profileError)setError("We couldn't load your employer profile.");
      if(data){setEmployer(data as Employer);await loadJobs(data.id);}
      setLoading(false);
    }
    load();
    return ()=>{active=false;};
  },[]);

  async function createListing(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");setNotice("");
    if(!employer){setError("Create your employer profile before adding opportunities.");setBusy(false);return;}
    const slug=slugify(title);
    if(slug.length<5){setError("Please enter a longer opportunity title.");setBusy(false);return;}
    if(applicationUrl.trim()&&!/^https?:\/\//i.test(applicationUrl.trim())){
      setError("Application link must begin with https:// or http://.");setBusy(false);return;
    }
    if(salaryMin&&salaryMax&&Number(salaryMax)<Number(salaryMin)){
      setError("Maximum compensation cannot be lower than minimum compensation.");setBusy(false);return;
    }
    const supabase=createClient();
    const payload={
      employer_id:employer.id,title:title.trim(),slug:slug+"-"+Date.now().toString(36),
      description:description.trim(),opportunity_type:type,workplace_type:workplace,
      location:location.trim()||null,country:country.trim()||null,
      salary_min:salaryMin?Number(salaryMin):null,salary_max:salaryMax?Number(salaryMax):null,
      currency,application_deadline:deadline||null,
      application_url:applicationUrl.trim()||null,application_email:applicationEmail.trim()||null,
      status:"draft"
    };
    const {error:insertError}=await supabase.from("work_job_posts").insert(payload);
    if(insertError)setError(insertError.code==="23505"?"A similar listing address already exists. Please change the title.":"We couldn't save this listing. Check the details and try again.");
    else{
      setNotice("Your opportunity has been saved as a draft. You can publish it when ready.");
      setTitle("");setDescription("");setLocation("");setCountry("");setSalaryMin("");setSalaryMax("");
      setDeadline("");setApplicationUrl("");setApplicationEmail("");
      await loadJobs(employer.id);
    }
    setBusy(false);
  }

  async function changeStatus(job:Job,status:"published"|"closed"){
    setError("");setNotice("");
    const supabase=createClient();
    const update:Record<string,unknown>={status};
    if(status==="published")update.published_at=new Date().toISOString();
    const {error:updateError}=await supabase.from("work_job_posts").update(update).eq("id",job.id);
    if(updateError)setError("We couldn't update this listing. Please try again.");
    else{setNotice(status==="published"?"Opportunity published. It can now appear in the public NBJ Work directory.":"Opportunity closed.");if(employer)await loadJobs(employer.id);}
  }

  if(loading)return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading your listings...</main>;

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10"><div className="mx-auto max-w-5xl">
    <Link href="/work" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
    <div className="mt-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Work · Employer workspace</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Manage opportunities</h1><p className="mt-2 text-sm text-slate-600">{employer?employer.company_name:"Employer profile required"}</p></div><div className="flex flex-wrap gap-2"><Link href="/work/employer/applications" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Review applications</Link><Link href="/work/employer" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">Company profile</Link></div></div>
    {!employer?<section className="mt-7 rounded-2xl border border-slate-200 bg-white p-7"><h2 className="font-bold text-slate-900">Set up your employer profile first</h2><p className="mt-2 text-sm text-slate-600">You need a company or organisation profile before creating listings.</p><Link href="/work/employer" className="mt-5 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">Create employer profile</Link></section>:<>
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-7 md:p-9"><h2 className="text-xl font-extrabold text-slate-900">Create an opportunity</h2><p className="mt-2 text-sm text-slate-600">New listings are saved as drafts. Review the details, then publish when ready.</p>
      <form onSubmit={createListing} className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700 md:col-span-2">Opportunity title *<input required minLength={5} maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Remote Graphic Designer" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/></label>
        <label className="block text-sm font-semibold text-slate-700">Opportunity type *<select value={type} onChange={e=>setType(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3">{types.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label className="block text-sm font-semibold text-slate-700">Work setting *<select value={workplace} onChange={e=>setWorkplace(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>
        <label className="block text-sm font-semibold text-slate-700 md:col-span-2">Full description *<textarea required minLength={30} maxLength={12000} rows={7} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the responsibilities, requirements, skills and how to apply." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/></label>
        <label className="block text-sm font-semibold text-slate-700">City / location<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Accra or Anywhere" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/></label>
        <label className="block text-sm font-semibold text-slate-700">Country<input value={country} onChange={e=>setCountry(e.target.value)} placeholder="e.g. Ghana" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/></label>
        <label className="block text-sm font-semibold text-slate-700">Minimum compensation<input type="number" min="0" step="0.01" value={salaryMin} onChange={e=>setSalaryMin(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/></label>
        <label className="block text-sm font-semibold text-slate-700">Maximum compensation<input type="number" min="0" step="0.01" value={salaryMax} onChange={e=>setSalaryMax(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/></label>
        <label className="block text-sm font-semibold text-slate-700">Currency<select value={currency} onChange={e=>setCurrency(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3">{["USD","GHS","EUR","GBP","CAD","AUD","NGN","KES","ZAR"].map(c=><option key={c}>{c}</option>)}</select></label>
        <label className="block text-sm font-semibold text-slate-700">Application deadline<input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} min={new Date().toISOString().slice(0,10)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>
        <div className="md:col-span-2 rounded-xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-800">How should applicants apply?</p><p className="mt-1 text-xs text-slate-500">Leave both blank to accept applications securely inside NBJ Work.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="block text-sm font-semibold text-slate-700">External application link (optional)<input type="url" value={applicationUrl} onChange={e=>setApplicationUrl(e.target.value)} placeholder="https://..." className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"/></label><label className="block text-sm font-semibold text-slate-700">Application email (optional)<input type="email" value={applicationEmail} onChange={e=>setApplicationEmail(e.target.value)} placeholder="jobs@example.com" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"/></label></div></div>
        {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 md:col-span-2">{error}</p>}{notice&&<p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800 md:col-span-2">{notice}</p>}
        <button disabled={busy} className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60 md:col-span-2">{busy?"Saving...":"Save opportunity as draft"}</button>
      </form>
    </section>
    <section className="mt-8"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold text-slate-900">Your listings</h2><span className="text-sm text-slate-500">{jobs.length} total</span></div>
      {jobs.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Your opportunities will appear here after you save them.</div>:<div className="space-y-3">{jobs.map(job=><article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-base font-extrabold text-slate-900">{job.title}</h3><p className="mt-1 text-sm text-slate-500">{job.opportunity_type.replace("_"," ")} · {job.workplace_type} · {[job.location,job.country].filter(Boolean).join(", ")||"Location flexible"}</p></div><span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide ${job.status==="published"?"bg-emerald-100 text-emerald-800":job.status==="draft"?"bg-amber-100 text-amber-800":"bg-slate-100 text-slate-700"}`}>{job.status==="draft"?"Draft — not public":job.status}</span></div><div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">{job.status==="draft"&&<><p className="mr-auto text-sm font-medium text-amber-800">This listing is saved privately. Publish it to show it to candidates.</p><button type="button" onClick={()=>changeStatus(job,"published")} className="min-h-12 w-full rounded-xl bg-teal-700 px-6 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-200 sm:w-auto">Publish opportunity</button></>}{job.status==="published"&&<><Link href={"/work/"+job.slug} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">View public page</Link><button type="button" onClick={()=>changeStatus(job,"closed")} className="min-h-11 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">Close listing</button></>}</div></div></article>)}</div>}
    </section></>}
    <div className="mt-8"><Link href="/work" className="text-sm font-semibold text-teal-700 hover:underline">← Browse public opportunities</Link></div>
  </div></main>;
}
