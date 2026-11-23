"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Building2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Business = {
  business_name: string;
  business_slug: string;
  description: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  website_url: string | null;
};

export default function PublicBusinessDirectoryPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("get_public_business_directory");
      if (!active) return;
      if (rpcError) setError("We couldn't load the business directory right now. Please try again.");
      else setBusinesses((data ?? []) as Business[]);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return businesses;
    return businesses.filter(b => [b.business_name,b.description,b.industry,b.city,b.country].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [businesses, query]);

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
        <nav className="flex gap-4 text-xs font-semibold text-slate-600"><Link href="/business" className="hover:text-teal-700">My Business</Link><Link href="/dashboard" className="hover:text-teal-700">Dashboard</Link></nav>
      </div>
    </header>
    <section className="bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[.22em] text-teal-300">NBJ Business directory</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight md:text-5xl">Discover businesses. Connect with new possibilities.</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">Explore businesses that have chosen to make their profiles visible on NBJCreative Hub.</p>
        <div className="relative mt-8 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by business, industry or location..." className="w-full rounded-full border border-white/20 bg-white py-4 pl-12 pr-5 text-sm text-slate-900 outline-none focus:border-teal-500"/>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-5 py-12">
      <div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Business community</p><h2 className="mt-2 text-2xl font-extrabold text-slate-900">Public business profiles</h2></div><span className="text-sm text-slate-500">{filtered.length} listed</span></div>
      {loading ? <div className="rounded-2xl bg-white p-12 text-center text-sm text-slate-500">Loading businesses...</div> :
       error ? <div role="alert" className="rounded-2xl bg-white p-12 text-center text-sm text-rose-700">{error}</div> :
       filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><Building2 className="mx-auto text-slate-300" size={34}/><h3 className="mt-4 font-bold text-slate-800">{businesses.length ? "No businesses match your search" : "The business directory is getting started"}</h3><p className="mt-2 text-sm text-slate-500">{businesses.length ? "Try another business name, industry or location." : "Businesses that enable public visibility will appear here."}</p><Link href="/business" className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700">Create your business profile</Link></div> :
       <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(b=><article key={b.business_slug} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E5F1EF] text-teal-800"><Building2 size={23}/></div><p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-teal-700">{b.industry || "Business"}</p><h3 className="mt-2 text-xl font-extrabold text-slate-900">{b.business_name}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{b.description || "Discover this business on NBJCreative Hub."}</p><p className="mt-4 text-xs font-semibold text-slate-500">{[b.city,b.country].filter(Boolean).join(", ") || "Location not specified"}</p><div className="mt-5 border-t border-slate-100 pt-4"><Link href={"/business/"+b.business_slug} className="inline-flex items-center gap-1 text-sm font-bold text-teal-700 hover:underline">View business <ArrowUpRight size={15}/></Link></div></article>)}</div>}
      <div className="mt-12 border-t border-slate-200 pt-6"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:underline"><ArrowLeft size={16}/> Back to NBJCreative Hub</Link></div>
    </section>
  </main>;
}
