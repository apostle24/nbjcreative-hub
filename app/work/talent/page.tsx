"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, MapPin, ArrowLeft, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Candidate = {
  profile_id: string; professional_headline: string | null; professional_summary: string | null;
  location: string | null; country: string | null; skills: string[]; experience_years: number | null;
};

export default function TalentDirectoryPage() {
  const [items,setItems] = useState<Candidate[]>([]);
  const [query,setQuery] = useState("");
  const [country,setCountry] = useState("");
  const [skill,setSkill] = useState("");
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("search_public_work_candidates", {
        p_query: null, p_country: null, p_skill: null, p_limit: 100
      });
      if (!active) return;
      if (error) setError("The candidate directory is not available yet. Please try again later.");
      else setItems((data || []) as Candidate[]);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const countries = useMemo(() => Array.from(new Set(items.map(x=>x.country).filter(Boolean) as string[])).sort(),[items]);
  const visible = useMemo(() => items.filter(x => {
    const haystack = [x.professional_headline,x.professional_summary,x.location,x.country,...(x.skills||[])].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase()) &&
      (!country || (x.country||"").toLowerCase() === country.toLowerCase()) &&
      (!skill || (x.skills||[]).some(s=>s.toLowerCase().includes(skill.toLowerCase())));
  }),[items,query,country,skill]);

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5"><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><Link href="/work" className="text-sm font-semibold text-slate-600 hover:text-teal-700">Browse opportunities</Link></div></header>
    <section className="bg-white"><div className="mx-auto max-w-7xl px-5 py-14"><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Work · Talent</p><h1 className="mt-3 text-4xl font-extrabold text-slate-900">Discover professionals.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Explore candidates who have chosen to make their professional profiles discoverable. CV files and private contact information are never displayed here.</p><div className="mt-7 grid gap-3 md:grid-cols-[1fr_220px_220px]"><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search skills, roles or experience" className="w-full rounded-xl border border-slate-200 py-4 pl-12 pr-4 text-sm"/></div><select value={country} onChange={e=>setCountry(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="">All countries</option>{countries.map(c=><option key={c}>{c}</option>)}</select><input value={skill} onChange={e=>setSkill(e.target.value)} placeholder="Filter by skill" className="rounded-xl border border-slate-200 px-4 py-3 text-sm"/></div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-12"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-extrabold text-slate-900">Discoverable profiles</h2><span className="text-sm text-slate-500">{visible.length} found</span></div>
      {loading?<div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500">Loading candidates...</div>:error?<div className="rounded-2xl bg-white p-10 text-center text-sm text-rose-700">{error}</div>:visible.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><Users className="mx-auto text-slate-300" size={34}/><h3 className="mt-4 font-bold text-slate-800">No public profiles found</h3><p className="mt-2 text-sm text-slate-500">Candidates will appear here when they complete their profile and enable discoverability.</p></div>:<div className="grid gap-4 md:grid-cols-2">{visible.map(c=><article key={c.profile_id} className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-lg font-extrabold text-slate-900">{c.professional_headline||"Professional profile"}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{c.professional_summary||"This candidate has not added a summary yet."}</p><div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><MapPin size={14}/>{[c.location,c.country].filter(Boolean).join(", ")||"Location not specified"}</span>{c.experience_years!==null&&<span>{c.experience_years} years experience</span>}</div><div className="mt-4 flex flex-wrap gap-2">{(c.skills||[]).slice(0,6).map(s=><span key={s} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">{s}</span>)}</div><Link href={"/work/talent/"+c.profile_id} className="mt-5 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700">View professional profile</Link></article>)}</div>}
      <div className="mt-8"><Link href="/work" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><ArrowLeft size={16}/> Back to NBJ Work</Link></div>
    </section>
  </main>;
}
