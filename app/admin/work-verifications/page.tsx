"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type RequestRow = {
  id: string; employer_id: string; submitted_by: string;
  organisation_type: string; registration_country: string; registration_number: string | null;
  evidence_file_name: string; evidence_url: string | null; status: "pending"|"verified"|"rejected"|"suspended";
  applicant_note: string | null; review_note: string | null; reviewed_at: string | null; submitted_at: string;
  employer: { company_name: string; company_slug: string; website_url: string | null } | null;
};
const filters = ["pending","verified","rejected","suspended","all"];
const labels: Record<string,string> = {company:"Registered company",nonprofit:"Non-profit / charity",government:"Government organisation",educational:"Educational institution",sole_trader:"Sole trader / individual business",other:"Other organisation"};

export default function WorkEmployerVerificationsPage() {
  const [rows,setRows] = useState<RequestRow[]>([]);
  const [filter,setFilter] = useState("pending");
  const [notes,setNotes] = useState<Record<string,string>>({});
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/admin/work-verifications",{cache:"no-store"});
    const result = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(result.error || "Could not load verification requests.");
    setRows((result.requests ?? []) as RequestRow[]);
  },[]);

  useEffect(() => {
    let active = true;
    load().catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load requests.");})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[load]);

  async function review(row:RequestRow,status:RequestRow["status"]) {
    setBusy(row.id);setError("");setNotice("");
    try {
      const response = await fetch("/api/admin/work-verifications",{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id:row.id,status,reviewNote:notes[row.id] ?? row.review_note ?? ""})
      });
      const result = await response.json().catch(()=>({}));
      if(!response.ok || !result.ok || result.verification?.status!==status) throw new Error(result.error || "The server did not confirm this decision.");
      setRows(current=>current.map(item=>item.id===row.id?{...item,status,review_note:result.verification.review_note,reviewed_at:result.verification.reviewed_at}:item));
      setFilter(status);
      setNotice((row.employer?.company_name || "Organisation")+" verification is now "+status+".");
      await load();
    } catch(e) { setError(e instanceof Error?e.message:"Could not save this decision."); }
    finally { setBusy(""); }
  }

  const visible = useMemo(()=>filter==="all"?rows:rows.filter(row=>row.status===filter),[rows,filter]);
  if(loading)return <main className="grid min-h-screen place-items-center text-sm text-slate-500">Loading employer verification requests...</main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><div><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><p className="mt-1 text-xs text-slate-500">NBJ Work administration</p></div><Link href="/admin" className="text-sm font-bold text-teal-700 hover:underline">← Admin dashboard</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-9">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Trust & safety</p>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Employer verification</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Review organisation details and official evidence before granting a public Verified Employer badge. Evidence links are private and expire after five minutes.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">{(["pending","verified","rejected","suspended"] as const).map(s=><div key={s} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs capitalize text-slate-500">{s}</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{rows.filter(r=>r.status===s).length}</p></div>)}</div>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{filters.map(s=><button key={s} onClick={()=>setFilter(s)} className={`rounded-full px-4 py-2 text-xs font-bold capitalize ${filter===s?"bg-slate-900 text-white":"border border-slate-200 bg-white text-slate-600"}`}>{s}</button>)}</div><button onClick={()=>load().catch(e=>setError(e.message))} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Refresh</button></div>
      {error&&<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {notice&&<p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      <section className="mt-5 space-y-4">
        {visible.length===0?<div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><p className="font-semibold text-slate-800">No {filter==="all"?"":filter+" "}verification requests</p><p className="mt-2 text-sm text-slate-500">New employer submissions will appear here.</p></div>:visible.map(row=><article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold text-slate-900">{row.employer?.company_name || "Organisation"}</h2><p className="mt-1 text-xs text-slate-500">Submitted {new Date(row.submitted_at).toLocaleString()}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-700">{row.status}</span></div>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><p><b>Organisation type:</b> {labels[row.organisation_type]||row.organisation_type}</p><p><b>Registration country:</b> {row.registration_country}</p><p><b>Registration number:</b> {row.registration_number||"Not provided"}</p><p><b>Company page:</b> <Link className="font-semibold text-teal-700 underline" href={"/work/company/"+(row.employer?.company_slug||"")}>View public profile</Link></p>{row.employer?.website_url&&<p className="sm:col-span-2"><b>Website:</b> <a className="text-teal-700 underline" href={row.employer.website_url} target="_blank" rel="noreferrer">{row.employer.website_url}</a></p>}</div>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-600">Submitted evidence</p><p className="mt-2 break-all text-sm text-slate-700">{row.evidence_file_name}</p>{row.evidence_url?<a href={row.evidence_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white">Open private evidence ↗</a>:<p className="mt-2 text-xs text-rose-700">A temporary evidence link could not be created. Refresh to try again.</p>}</div>
          {row.applicant_note&&<div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-600">Applicant note</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{row.applicant_note}</p></div>}
          {row.review_note&&<div className="mt-4 rounded-xl bg-amber-50 p-4"><p className="text-xs font-bold text-amber-800">Previous review note</p><p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">{row.review_note}</p></div>}
          <label className="mt-5 block text-xs font-semibold text-slate-600">Review note (optional)<textarea rows={2} maxLength={2000} value={notes[row.id]??row.review_note??""} onChange={e=>setNotes(current=>({...current,[row.id]:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" placeholder="Explain your decision or provide guidance to the organisation."/></label>
          <div className="mt-4 flex flex-wrap gap-2"><button disabled={!!busy} onClick={()=>review(row,"verified")} className="rounded-lg bg-teal-700 px-5 py-3 text-xs font-extrabold text-white hover:bg-teal-800 disabled:opacity-50">{busy===row.id?"Saving...":"Approve & verify"}</button>{row.status!=="rejected"&&<button disabled={!!busy} onClick={()=>review(row,"rejected")} className="rounded-lg border border-rose-200 px-4 py-3 text-xs font-bold text-rose-700 disabled:opacity-50">Reject</button>}{row.status!=="suspended"&&<button disabled={!!busy} onClick={()=>review(row,"suspended")} className="rounded-lg border border-slate-300 px-4 py-3 text-xs font-bold text-slate-700 disabled:opacity-50">Suspend</button>}{row.status!=="pending"&&<button disabled={!!busy} onClick={()=>review(row,"pending")} className="rounded-lg border border-amber-200 px-4 py-3 text-xs font-bold text-amber-800 disabled:opacity-50">Return to pending</button>}</div>
        </article>)}
      </section>
    </div>
  </main>;
}
