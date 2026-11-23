"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type BusinessProfile = {
  business_name: string;
  business_slug: string;
  description: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  website_url: string | null;
};

export default function PublicBusinessProfilePage() {
  const params = useParams<{ slug: string }>();
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("get_public_business_profile", { p_business_slug: params.slug });
      if (!active) return;
      if (rpcError) setError("We couldn't load this business profile. Please try again later.");
      else if (data) setBusiness(data as BusinessProfile);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [params.slug]);

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading business profile...</main>;

  if (!business) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] px-5"><div className="max-w-md rounded-3xl bg-white p-9 text-center shadow-sm"><Building2 className="mx-auto text-teal-700" size={34}/><h1 className="mt-4 text-2xl font-extrabold text-slate-900">Business profile unavailable</h1><p className="mt-2 text-sm leading-6 text-slate-500">{error || "This business profile may be private or may not exist."}</p><Link href="/businesses" className="mt-6 inline-flex items-center gap-2 font-bold text-teal-700"><ArrowLeft size={16}/> Browse businesses</Link></div></main>;

  const location = [business.city,business.country].filter(Boolean).join(", ");

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5"><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><Link href="/businesses" className="text-sm font-semibold text-teal-700 hover:underline">Business directory</Link></div></header>
    <section className="bg-slate-950 text-white"><div className="mx-auto max-w-5xl px-5 py-16 md:py-24"><p className="text-xs font-bold uppercase tracking-[.22em] text-teal-300">Business profile</p><div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-teal-200"><Building2 size={28}/></div><h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight md:text-6xl">{business.business_name}</h1>{business.industry && <p className="mt-4 text-sm font-semibold text-teal-200">{business.industry}</p>}<p className="mt-5 max-w-2xl whitespace-pre-wrap text-base leading-8 text-slate-300">{business.description || "Discover this business and its work."}</p><div className="mt-7 flex flex-wrap gap-4 text-sm text-slate-300">{location && <span className="inline-flex items-center gap-2"><MapPin size={16}/>{location}</span>}{business.website_url && <a href={business.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-bold text-teal-200 hover:underline">Visit business website <ExternalLink size={15}/></a>}</div></div></section>
    <section className="mx-auto max-w-5xl px-5 py-12"><div className="rounded-2xl border border-slate-200 bg-white p-7"><h2 className="text-xl font-extrabold text-slate-900">Connect through NBJCreative Hub</h2><p className="mt-2 text-sm leading-6 text-slate-600">This public profile introduces the business. Customer enquiries and business-to-business connections will be added as the next part of NBJ Business.</p></div><div className="mt-8"><Link href="/businesses" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:underline"><ArrowLeft size={16}/> Back to business directory</Link></div></section>
  </main>;
}
