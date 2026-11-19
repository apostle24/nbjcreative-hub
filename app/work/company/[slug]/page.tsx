"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, Globe, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Employer = {
  id: string;
  company_name: string;
  company_slug: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;\n  is_verified: boolean;
};

type Job = {
  id: string;
  title: string;
  slug: string;
  description: string;
  opportunity_type: string;
  workplace_type: string;
  location: string | null;
  country: string | null;
  salary_min: number | string | null;
  salary_max: number | string | null;
  currency: string;
  application_deadline: string | null;
};

const labels: Record<string,string> = {
  full_time:"Full-time", part_time:"Part-time", contract:"Contract",
  freelance:"Freelance", internship:"Internship", volunteer:"Volunteer"
};

export default function PublicEmployerCompanyPage() {
  const params = useParams<{slug:string}>();
  const slug = params.slug;
  const [company,setCompany] = useState<Employer|null>(null);
  const [jobs,setJobs] = useState<Job[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const {data:profile,error:profileError} = await supabase
        .from("work_employer_profiles")
        .select("id,company_name,company_slug,description,website_url,logo_url,is_verified")
        .eq("company_slug",slug).maybeSingle();
      if (!active) return;
      if (profileError || !profile) {
        setError("This company profile could not be found.");
        setLoading(false);
        return;
      }
      setCompany(profile as Employer);
      const {data:listingRows,error:jobsError} = await supabase
        .from("work_job_posts")
        .select("id,title,slug,description,opportunity_type,workplace_type,location,country,salary_min,salary_max,currency,application_deadline")
        .eq("employer_id",profile.id).eq("status","published")
        .order("published_at",{ascending:false});
      if (!active) return;
      if (jobsError) setError("Company details loaded, but its current opportunities could not be retrieved.");
      else setJobs((listingRows??[]) as Job[]);
      setLoading(false);
    }
    if (slug) load();
    return () => { active = false; };
  },[slug]);

  function compensation(job:Job) {
    if (job.salary_min == null && job.salary_max == null) return "Compensation not specified";
    const money = (n:number|string) => new Intl.NumberFormat("en",{style:"currency",currency:job.currency}).format(Number(n));
    if (job.salary_min != null && job.salary_max != null) return money(job.salary_min)+" – "+money(job.salary_max);
    return job.salary_min != null ? "From "+money(job.salary_min) : "Up to "+money(job.salary_max!);
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading company profile...</main>;

  if (!company) return <main className="min-h-screen bg-[#F5F7F8] px-5 py-20"><div className="mx-auto max-w-3xl rounded-2xl bg-white p-10 text-center"><h1 className="text-2xl font-extrabold text-slate-900">Company not found</h1><p className="mt-3 text-sm text-slate-600">{error || "This public company page may have moved."}</p><Link href="/work" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-teal-700"><ArrowLeft size={16}/> Browse opportunities</Link></div></main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5"><Link href="/work" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><Link href="/work/talent" className="text-sm font-semibold text-slate-600 hover:text-teal-700">Talent Directory</Link></div></header>
    <section className="bg-white"><div className="mx-auto max-w-5xl px-5 py-14 md:py-20">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Work · Employer profile</p>
      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        {company.logo_url ? <img src={company.logo_url} alt="" className="h-20 w-20 rounded-2xl border border-slate-200 object-cover"/> : <div className="grid h-20 w-20 place-items-center rounded-2xl bg-teal-50 text-2xl font-extrabold text-teal-800">{company.company_name.slice(0,1).toUpperCase()}</div>}
        <div><h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-5xl">{company.company_name}</h1><div className="mt-2 flex flex-wrap items-center gap-2"><p className="text-sm text-slate-500">Company and organisation profile</p>{company.is_verified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">✓ Verified Employer</span>}</div></div>
      </div>
      {company.description ? <p className="mt-8 max-w-3xl whitespace-pre-wrap text-base leading-8 text-slate-600">{company.description}</p> : <p className="mt-8 text-sm text-slate-500">This organisation has not added an introduction yet.</p>}
      {company.website_url && <a href={company.website_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-teal-700 hover:bg-teal-50"><Globe size={16}/> Visit organisation website</a>}
    </div></section>
    <section className="mx-auto max-w-5xl px-5 py-12 md:py-16">
      <div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Careers</p><h2 className="mt-2 text-2xl font-extrabold text-slate-900">Open opportunities</h2></div><span className="text-sm text-slate-500">{jobs.length} open</span></div>
      {error && <p role="status" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{error}</p>}
      {jobs.length===0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><BriefcaseBusiness className="mx-auto text-slate-300" size={34}/><h3 className="mt-4 font-bold text-slate-800">No open opportunities right now</h3><p className="mt-2 text-sm text-slate-500">Check back later for new opportunities from this organisation.</p></div> : <div className="grid gap-4 md:grid-cols-2">{jobs.map(job=><article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">{labels[job.opportunity_type]??job.opportunity_type}</span><span className="text-xs font-semibold text-slate-500 capitalize">{job.workplace_type==="onsite"?"On-site":job.workplace_type}</span></div><h3 className="mt-4 text-xl font-extrabold text-slate-900">{job.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">{job.description}</p><p className="mt-4 flex items-center gap-1 text-xs text-slate-500"><MapPin size={14}/>{[job.location,job.country].filter(Boolean).join(", ")||"Location flexible"}</p><div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="text-sm font-bold text-slate-900">{compensation(job)}</span><Link href={"/work/"+job.slug} className="rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-700">View opportunity</Link></div></article>)}</div>}
      <div className="mt-10"><Link href="/work" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:underline"><ArrowLeft size={16}/> Browse all opportunities</Link></div>
    </section>
  </main>;
}
