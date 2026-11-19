"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Search, MapPin, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: string; title: string; slug: string; description: string;
  opportunity_type: string; workplace_type: string; location: string | null;
  country: string | null; salary_min: number | string | null;
  salary_max: number | string | null; currency: string; published_at: string | null;
  application_deadline: string | null;
  employer: { company_name: string; company_slug: string } | null;
};

const typeLabel: Record<string,string> = {
  full_time:"Full-time", part_time:"Part-time", contract:"Contract",
  freelance:"Freelance", internship:"Internship", volunteer:"Volunteer"
};

export default function WorkPage() {
  const [jobs,setJobs] = useState<Job[]>([]);
  const [query,setQuery] = useState("");
  const [type,setType] = useState("all");
  const [place,setPlace] = useState("all");
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase.from("work_job_posts")
        .select("id,title,slug,description,opportunity_type,workplace_type,location,country,salary_min,salary_max,currency,published_at,application_deadline,employer:work_employer_profiles(company_name,company_slug)")
        .eq("status","published").order("published_at",{ascending:false}).limit(100);
      if (!active) return;
      if (error) setError("We couldn't load opportunities right now. Please try again later.");
      else setJobs((data ?? []) as unknown as Job[]);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  },[]);

  const visible = useMemo(() => jobs.filter(job => {
    const text = [job.title,job.description,job.location,job.country,job.employer?.company_name].join(" ").toLowerCase();
    return text.includes(query.toLowerCase()) &&
      (type === "all" || job.opportunity_type === type) &&
      (place === "all" || job.workplace_type === place);
  }),[jobs,query,type,place]);

  function salary(job: Job) {
    if (job.salary_min == null && job.salary_max == null) return "Compensation not specified";
    const fmt = (n: number | string) => new Intl.NumberFormat("en",{style:"currency",currency:job.currency}).format(Number(n));
    if (job.salary_min != null && job.salary_max != null) return fmt(job.salary_min) + " – " + fmt(job.salary_max);
    return job.salary_min != null ? "From " + fmt(job.salary_min) : "Up to " + fmt(job.salary_max!);
  }

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
      <Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
      <div className="flex gap-4 text-sm font-semibold"><Link href="/account" className="text-slate-600 hover:text-teal-700">My account</Link><Link href="/help" className="text-slate-600 hover:text-teal-700">Help</Link></div>
    </div></header>
    <section className="bg-white"><div className="mx-auto max-w-7xl px-5 py-14 md:py-20">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-teal-700">NBJ Work</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">Find work that moves you forward.</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Explore job openings, freelance projects, contracts, internships and volunteer opportunities.</p>
      <div className="mt-8 grid gap-3 md:grid-cols-[1fr_190px_190px]">
        <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search roles, skills, companies or locations" className="w-full rounded-xl border border-slate-200 py-4 pl-12 pr-4 text-sm outline-none focus:border-teal-700"/></div>
        <select value={type} onChange={e=>setType(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="all">All opportunity types</option>{Object.entries(typeLabel).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
        <select value={place} onChange={e=>setPlace(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="all">All work settings</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select>
      </div>
    </div></section>
    <section className="mx-auto max-w-7xl px-5 py-12 md:py-16">
      <div className="mb-7 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Opportunities</p><h2 className="mt-2 text-2xl font-extrabold text-slate-900">Latest listings</h2></div><span className="text-sm text-slate-500">{visible.length} found</span></div>
      {loading ? <div className="rounded-2xl bg-white p-12 text-center text-sm text-slate-500">Loading opportunities...</div> :
       error ? <div className="rounded-2xl bg-white p-10 text-center text-sm text-rose-700">{error}</div> :
       visible.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><BriefcaseBusiness className="mx-auto text-slate-300" size={34}/><h3 className="mt-4 font-bold text-slate-800">{jobs.length === 0 ? "New opportunities are on the way" : "No matching opportunities"}</h3><p className="mt-2 text-sm text-slate-500">{jobs.length === 0 ? "Published jobs and freelance projects will appear here." : "Try a different keyword or filter."}</p></div> :
       <div className="grid gap-4 md:grid-cols-2">{visible.map(job=><article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">{typeLabel[job.opportunity_type] ?? job.opportunity_type}</span><span className="text-xs font-semibold text-slate-500">{job.workplace_type === "onsite" ? "On-site" : job.workplace_type === "hybrid" ? "Hybrid" : "Remote"}</span></div>
        <h3 className="mt-4 text-xl font-extrabold text-slate-900">{job.title}</h3><p className="mt-1 text-sm font-semibold text-slate-600">{job.employer?.company_name ?? "Independent client"}</p>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">{job.description}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><MapPin size={14}/>{[job.location,job.country].filter(Boolean).join(", ") || "Location flexible"}</span>{job.application_deadline && <span className="inline-flex items-center gap-1"><Clock3 size={14}/>Apply by {new Date(job.application_deadline+"T00:00:00").toLocaleDateString()}</span>}</div>
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm font-bold text-slate-900">{salary(job)}</span><Link href={"/work/"+job.slug} className="rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-700">View opportunity</Link></div>
       </article>)}</div>}
      <div className="mt-10 border-t border-slate-200 pt-6"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:underline"><ArrowLeft size={16}/> Back to NBJCreative Hub</Link></div>
    </section>
  </main>;
}
