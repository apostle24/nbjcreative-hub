"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Candidate = {
  profile_id:string; professional_headline:string|null; professional_summary:string|null;
  location:string|null; country:string|null; skills:string[]; experience_years:number|null;
  education:string|null; certifications:string|null; website_url:string|null;
  linkedin_url:string|null; portfolio_url:string|null; updated_at:string;
};

export default function PublicCandidateProfilePage() {
  const params = useParams<{id:string}>();
  const [candidate,setCandidate] = useState<Candidate|null>(null);
  const [loading,setLoading] = useState(true);
  useEffect(()=>{
    let active=true;
    async function load(){
      const supabase=createClient();
      const {data,error}=await supabase.rpc("get_public_work_candidate",{p_profile_id:params.id});
      if(!active)return;
      if(!error&&data?.length)setCandidate(data[0] as Candidate);
      setLoading(false);
    }
    if(params.id)load();
    return ()=>{active=false;};
  },[params.id]);
  if(loading)return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading professional profile...</main>;
  if(!candidate)return <main className="min-h-screen bg-[#F5F7F8] px-5 py-16"><div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center"><h1 className="text-xl font-extrabold text-slate-900">Profile unavailable</h1><p className="mt-2 text-sm text-slate-500">This profile may be private or no longer available.</p><Link href="/work/talent" className="mt-5 inline-flex text-sm font-bold text-teal-700">Back to talent directory</Link></div></main>;
  const links=[["Website",candidate.website_url],["LinkedIn",candidate.linkedin_url],["Portfolio",candidate.portfolio_url]].filter(x=>x[1]) as [string,string][];
  return <main className="min-h-screen bg-[#F5F7F8]"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5"><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><Link href="/work/talent" className="text-sm font-semibold text-slate-600">Talent directory</Link></div></header><div className="mx-auto max-w-4xl px-5 py-12"><Link href="/work/talent" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><ArrowLeft size={16}/> All candidates</Link><article className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 md:p-10"><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Public professional profile</p><h1 className="mt-3 text-3xl font-extrabold text-slate-900">{candidate.professional_headline||"Professional profile"}</h1><p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><MapPin size={16}/>{[candidate.location,candidate.country].filter(Boolean).join(", ")||"Location not specified"}</p>{candidate.experience_years!==null&&<p className="mt-2 text-sm font-semibold text-slate-700">{candidate.experience_years} years of experience</p>}<section className="mt-8"><h2 className="font-extrabold text-slate-900">Professional summary</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{candidate.professional_summary||"No summary provided."}</p></section><section className="mt-8"><h2 className="font-extrabold text-slate-900">Skills</h2><div className="mt-3 flex flex-wrap gap-2">{(candidate.skills||[]).map(s=><span key={s} className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">{s}</span>)}</div></section>{candidate.education&&<section className="mt-8"><h2 className="font-extrabold text-slate-900">Education</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{candidate.education}</p></section>}{candidate.certifications&&<section className="mt-8"><h2 className="font-extrabold text-slate-900">Certifications</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{candidate.certifications}</p></section>}{links.length>0&&<section className="mt-8"><h2 className="font-extrabold text-slate-900">Professional links</h2><div className="mt-3 flex flex-wrap gap-3">{links.map(([label,url])=><a key={label} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-teal-700">{label}<ExternalLink size={14}/></a>)}</div></section>}<p className="mt-10 border-t border-slate-100 pt-5 text-xs text-slate-400">CV documents and private account details are not displayed on public profiles.</p></article></div></main>;
}
