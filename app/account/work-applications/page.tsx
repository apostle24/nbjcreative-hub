"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, RefreshCw, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Application = {
  id: string;
  job_id: string;
  cover_letter: string;
  status: "submitted" | "viewed" | "shortlisted" | "interviewing" | "accepted" | "rejected" | "withdrawn";
  quality_score: number | null;
  interview_at: string | null;
  created_at: string;
  updated_at: string;
  job: {
    title: string;
    slug: string;
    opportunity_type: string;
    workplace_type: string;
    location: string | null;
    country: string | null;
    employer: { company_name: string; company_slug: string } | null;
  } | null;
};

const stages = ["submitted", "viewed", "shortlisted", "interviewing", "accepted"] as const;

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusStyle(status: string) {
  if (status === "accepted") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  if (status === "interviewing" || status === "shortlisted") return "bg-teal-50 text-teal-800";
  if (status === "withdrawn") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-700";
}

export default function WorkApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  async function loadApplications() {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        window.location.assign("/account?next=" + encodeURIComponent("/account/work-applications"));
        return;
      }
      const { data, error: queryError } = await supabase
        .from("work_job_applications")
        .select("id,job_id,cover_letter,status,quality_score,interview_at,created_at,updated_at,job:work_job_posts(title,slug,opportunity_type,workplace_type,location,country,employer:work_employer_profiles(company_name,company_slug))")
        .eq("applicant_id", user.id)
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setApplications((data || []) as unknown as Application[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadApplications(); }, []);

  const visible = useMemo(() => applications.filter(app => {
    const matchesStatus = filter === "all" || app.status === filter;
    const term = query.trim().toLowerCase();
    const matchesSearch = !term || (app.job?.title || "").toLowerCase().includes(term) ||
      (app.job?.employer?.company_name || "").toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  }), [applications, filter, query]);

  function tracker(status: Application["status"]) {
    if (status === "rejected" || status === "withdrawn") return null;
    const current = stages.indexOf(status as typeof stages[number]);
    return <div className="mt-5 grid grid-cols-5 gap-1" aria-label={"Application progress: " + status}>
      {stages.map((stage, index) => <div key={stage} className="min-w-0">
        <div className={"h-1.5 rounded-full " + (index <= current ? "bg-teal-600" : "bg-slate-200")}/>
        <p className={"mt-2 text-[10px] capitalize " + (index <= current ? "font-bold text-teal-800" : "text-slate-400")}>{stage}</p>
      </div>)}
    </div>;
  }

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
        <Link href="/account" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-700"><ArrowLeft size={15}/> Account</Link>
      </div>
    </header>
    <div className="mx-auto max-w-5xl px-5 py-10 md:py-14">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Work · Candidate workspace</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">My applications</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Track your opportunities, follow hiring progress and keep interview details in one place.</p></div>
        <button onClick={loadApplications} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:border-teal-600 disabled:opacity-50"><RefreshCw size={15}/> Refresh</button>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}

      {!loading && applications.length > 0 && <div className="mt-7 space-y-3">
        <div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by opportunity or organisation" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-teal-600"/></div>
        <div className="flex flex-wrap gap-2">{["all","submitted","viewed","shortlisted","interviewing","accepted","rejected","withdrawn"].map(value => <button key={value} onClick={() => setFilter(value)} className={"rounded-full px-4 py-2 text-xs font-bold capitalize " + (filter === value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-teal-600")}>{value === "all" ? "All applications" : value}</button>)}</div>
      </div>}

      {loading && <div className="mt-8 rounded-2xl bg-white p-10 text-center text-sm text-slate-500">Loading your applications...</div>}
      {!loading && !error && applications.length === 0 && <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <BriefcaseBusiness className="mx-auto text-teal-700" size={36}/>
        <h2 className="mt-4 text-xl font-extrabold text-slate-900">No applications yet</h2>
        <p className="mt-2 text-sm text-slate-600">When you apply to a job, freelance project, internship or volunteer opportunity on NBJ Work, it will appear here.</p>
        <Link href="/work" className="mt-6 inline-flex rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-teal-700">Explore opportunities</Link>
      </section>}
      {!loading && !error && applications.length > 0 && visible.length === 0 && <div className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-slate-500">No applications match your search.</div>}

      <div className="mt-6 space-y-4">
        {visible.map(app => <article key={app.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Link href={app.job?.slug ? "/work/" + app.job.slug : "/work"} className="text-lg font-extrabold text-slate-900 hover:text-teal-700">{app.job?.title || "Opportunity no longer available"}</Link>
              <p className="mt-1 text-sm font-semibold text-slate-600">{app.job?.employer?.company_name || "Organisation"}</p>
              <p className="mt-2 text-xs capitalize text-slate-500">{(app.job?.opportunity_type || "opportunity").replaceAll("_"," ")} · {(app.job?.workplace_type || "workplace").replaceAll("_"," ")} · {[app.job?.location,app.job?.country].filter(Boolean).join(", ") || "Location not specified"}</p>
            </div>
            <span className={"rounded-full px-3 py-1.5 text-xs font-bold " + statusStyle(app.status)}>{statusLabel(app.status)}</span>
          </div>
          {tracker(app.status)}
          {app.status === "rejected" && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">This application was not successful. You can continue exploring other opportunities on NBJ Work.</p>}
          {app.status === "accepted" && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Congratulations! The employer has marked your application as accepted. Check your email or contact the organisation for next steps.</p>}
          {app.status === "withdrawn" && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">You withdrew this application.</p>}
          {app.interview_at && <div className="mt-4 flex items-center gap-2 rounded-xl bg-teal-50 p-3 text-sm font-semibold text-teal-900"><CalendarDays size={17}/> Interview scheduled: {new Date(app.interview_at).toLocaleString()}</div>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span>Applied {new Date(app.created_at).toLocaleDateString()}</span>
            <span className="inline-flex items-center gap-1"><Clock3 size={13}/> Updated {new Date(app.updated_at).toLocaleDateString()}</span>
          </div>
        </article>)}
      </div>
      <p className="mt-8 text-center text-xs text-slate-400">Your cover letter and application details are visible only to you, the relevant employer and authorised administrators.</p>
    </div>
  </main>;
}
