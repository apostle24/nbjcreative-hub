"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Building2, Search, SlidersHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Business = {
  business_name: string;
  business_slug: string;
  description: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  website_url: string | null;
  offerings_count: number;
};

export default function PublicBusinessDirectoryPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
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

  const industries = useMemo(
    () => Array.from(new Set(businesses.map(b => b.industry).filter((value): value is string => Boolean(value)))).sort(),
    [businesses]
  );
  const locations = useMemo(
    () => Array.from(new Set(businesses.map(b => [b.city, b.country].filter(Boolean).join(", ")).filter(Boolean))).sort(),
    [businesses]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return businesses.filter(b => {
      const matchesQuery = !term || [b.business_name, b.description, b.industry, b.city, b.country]
        .filter(Boolean).join(" ").toLowerCase().includes(term);
      const matchesIndustry = !industry || b.industry === industry;
      const businessLocation = [b.city, b.country].filter(Boolean).join(", ");
      const matchesLocation = !location || businessLocation === location;
      return matchesQuery && matchesIndustry && matchesLocation;
    });
  }, [businesses, query, industry, location]);

  const hasFilters = Boolean(query.trim() || industry || location);
  function clearFilters() {
    setQuery("");
    setIndustry("");
    setLocation("");
  }

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
        <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">Find businesses, explore what they offer and connect directly with the people behind them.</p>
        <div className="relative mt-8 max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search business name, industry, service or location..." className="w-full rounded-full border border-white/20 bg-white py-4 pl-12 pr-5 text-sm text-slate-900 outline-none focus:border-teal-500"/>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/business" className="inline-flex rounded-full bg-teal-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-teal-300">List your business</Link>
          <span className="text-xs text-slate-400">For businesses looking to reach new customers</span>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-5 py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Business community</p><h2 className="mt-2 text-2xl font-extrabold text-slate-900">Explore public businesses</h2><p className="mt-2 text-sm text-slate-500">Choose an industry or location to narrow your search.</p></div>
        <span className="text-sm font-semibold text-slate-500">{loading ? "Loading..." : `${filtered.length} of ${businesses.length} businesses`}</span>
      </div>

      <div className="mb-7 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block text-xs font-bold text-slate-600">Industry
          <select value={industry} onChange={e=>setIndustry(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-600">
            <option value="">All industries</option>
            {industries.map(item=><option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-600">Location
          <select value={location} onChange={e=>setLocation(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-600">
            <option value="">All locations</option>
            {locations.map(item=><option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:border-teal-600 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40"><X size={15}/> Clear filters</button>
      </div>

      {loading ? <div className="rounded-2xl bg-white p-12 text-center text-sm text-slate-500">Loading businesses...</div> :
       error ? <div role="alert" className="rounded-2xl bg-white p-12 text-center text-sm text-rose-700">{error}</div> :
       filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><SlidersHorizontal className="mx-auto text-slate-300" size={34}/><h3 className="mt-4 font-bold text-slate-800">{businesses.length ? "No businesses match these filters" : "The business directory is getting started"}</h3><p className="mt-2 text-sm text-slate-500">{businesses.length ? "Try a different search, industry or location." : "Businesses that enable public visibility will appear here."}</p>{businesses.length > 0 ? <button type="button" onClick={clearFilters} className="mt-5 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700">Clear filters</button> : <Link href="/business" className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700">Create your business profile</Link>}</div> :
       <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(b=><article key={b.business_slug} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E5F1EF] text-teal-800"><Building2 size={23}/></div><p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-teal-700">{b.industry || "Business"}</p><h3 className="mt-2 text-xl font-extrabold text-slate-900">{b.business_name}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{b.description || "Discover this business on NBJCreative Hub."}</p><p className="mt-4 text-xs font-semibold text-slate-500">{[b.city,b.country].filter(Boolean).join(", ") || "Location not specified"}</p>{b.offerings_count > 0 && <p className="mt-3 inline-flex w-fit rounded-full bg-teal-50 px-3 py-1.5 text-[11px] font-bold text-teal-800">{b.offerings_count} published {b.offerings_count === 1 ? "offering" : "offerings"} on NBJ Marketplace</p>}<div className="mt-auto border-t border-slate-100 pt-4"><Link href={"/business/"+b.business_slug} className="inline-flex items-center gap-1 text-sm font-bold text-teal-700 hover:underline">View business <ArrowUpRight size={15}/></Link></div></article>)}</div>}

      <div className="mt-12 rounded-2xl bg-[#E7F1EF] p-7 sm:flex sm:items-center sm:justify-between sm:gap-6"><div><h3 className="text-lg font-extrabold text-slate-900">Ready to grow your business?</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Create your public profile, showcase your products and services, and receive enquiries from interested customers.</p></div><Link href="/business" className="mt-5 inline-flex shrink-0 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700 sm:mt-0">Build your business presence <ArrowUpRight size={15} className="ml-2"/></Link></div>

      <div className="mt-8 border-t border-slate-200 pt-6"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:underline"><ArrowLeft size={16}/> Back to NBJCreative Hub</Link></div>
    </section>
  </main>;
}
