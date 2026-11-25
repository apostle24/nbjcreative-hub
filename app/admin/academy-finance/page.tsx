"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Earning = { id:string; instructor_id:string; course_id:string; currency:string; gross_amount:number|string; platform_fee_amount:number|string|null; instructor_amount:number|string|null; status:string; created_at:string; instructor:{email:string|null;name:string|null}|null; course_title:string };
type Audit = { id:string; actor_id:string; action:string; earning_id:string|null; payout_request_id:string|null; amount:number|string|null; currency:string|null; note:string|null; created_at:string };
type Payout = { id:string; instructor_id:string; currency:string; amount:number|string; payout_method:string; account_name:string; account_details:string; status:string; admin_note:string|null; requested_at:string; instructor:{email:string|null;name:string|null}|null };

export default function AcademyFinancePage() {
  const [loading,setLoading] = useState(true);
  const [allowed,setAllowed] = useState(false);
  const [earnings,setEarnings] = useState<Earning[]>([]);
  const [payouts,setPayouts] = useState<Payout[]>([]);
  const [audit,setAudit] = useState<Audit[]>([]);
  const [fees,setFees] = useState<Record<string,string>>({});
  const [notes,setNotes] = useState<Record<string,string>>({});
  const [busy,setBusy] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/admin/academy-finance",{cache:"no-store"});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load finance records.");
    setEarnings(data.earnings ?? []);
    setPayouts(data.payouts ?? []);
    setAudit(data.audit ?? []);
  },[]);

  useEffect(() => {
    let active = true;
    async function init() {
      const supabase = createClient();
      const {data:{user}} = await supabase.auth.getUser();
      if (!user) { window.location.assign("/admin/login"); return; }
      const {data:profile} = await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
      if (!active) return;
      if (profile?.role !== "admin") { setLoading(false); return; }
      setAllowed(true);
      try { await load(); } catch(e) { setError(e instanceof Error ? e.message : "Could not load records."); }
      if (active) setLoading(false);
    }
    init();
    return () => { active = false; };
  },[load]);

  async function act(key:string, payload:Record<string,unknown>) {
    setBusy(key); setError(""); setNotice("");
    const response = await fetch("/api/admin/academy-finance",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data = await response.json();
    if (!response.ok) setError(data.error || "The finance action failed.");
    else { setNotice("Finance record updated."); await load(); }
    setBusy("");
  }

  const money = (amount:number|string, currency:string) => currency + " " + Number(amount).toFixed(2);
  const pending = earnings.filter(x=>x.status==="pending_review");
  const available = earnings.filter(x=>x.status==="available");
  const requested = payouts.filter(x=>x.status==="pending");
  const currencyReport = Array.from(new Set(earnings.map(row=>row.currency))).map(currency => ({
    currency,
    gross: earnings.filter(row=>row.currency===currency).reduce((sum,row)=>sum+Number(row.gross_amount),0),
    instructorAvailable: earnings.filter(row=>row.currency===currency && row.status==="available").reduce((sum,row)=>sum+Number(row.instructor_amount||0),0),
    paidOut: earnings.filter(row=>row.currency===currency && row.status==="paid").reduce((sum,row)=>sum+Number(row.instructor_amount||0),0)
  }));

  if (loading) return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Checking finance access...</main>;
  if (!allowed) return <main className="min-h-screen grid place-items-center p-6"><div className="max-w-md rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-xl font-bold">Administrator access required</h1><p className="mt-3 text-sm text-slate-600">This finance centre is restricted to authorised administrators.</p><Link href="/admin/login" className="mt-5 inline-block font-bold text-teal-700">Admin login</Link></div></main>;

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-9"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><Link href="/admin" className="text-sm font-bold text-teal-700">← Admin control centre</Link><p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Academy finance</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Instructor earnings & payouts</h1><p className="mt-2 text-sm text-slate-600">Reconcile course revenue, release instructor balances and manage payout requests.</p></div><button onClick={()=>load().catch(e=>setError(e.message))} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold">Refresh records</button></header>
    <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[["Awaiting review",pending.length],["Available earnings",available.length],["Pending payouts",requested.length],["Gross under review",pending.reduce((s,x)=>s+Number(x.gross_amount),0).toFixed(2)]].map(([label,value])=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p></div>)}
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold text-slate-900">Finance summary by currency</h2><p className="mt-1 text-sm text-slate-500">Amounts are kept separate by currency; no cross-currency totals are calculated.</p>{currencyReport.length===0 ? <p className="mt-4 text-sm text-slate-500">No recorded earnings yet.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-3">Currency</th><th className="py-3">Gross collected</th><th className="py-3">Instructor available</th><th className="py-3">Instructor paid</th></tr></thead><tbody>{currencyReport.map(row=><tr key={row.currency} className="border-b last:border-0"><td className="py-3 font-bold">{row.currency}</td><td className="py-3">{money(row.gross,row.currency)}</td><td className="py-3">{money(row.instructorAvailable,row.currency)}</td><td className="py-3">{money(row.paidOut,row.currency)}</td></tr>)}</tbody></table></div>}</section>
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold text-slate-900">Earnings reconciliation</h2><p className="mt-1 text-sm text-slate-500">Enter the platform fee for each payment. The instructor balance is calculated automatically.</p>
      {pending.length===0 ? <p className="mt-5 rounded-xl border border-dashed p-7 text-center text-sm text-slate-500">No earnings awaiting review.</p> : <div className="mt-5 space-y-4">{pending.map(row=><article key={row.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold text-slate-900">{row.course_title}</h3><p className="mt-1 text-xs text-slate-500">{row.instructor?.name || row.instructor?.email || row.instructor_id} · {new Date(row.created_at).toLocaleString()}</p></div><p className="font-bold">{money(row.gross_amount,row.currency)}</p></div><div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-xs font-semibold text-slate-600">Platform fee ({row.currency})<input type="number" min="0" max={Number(row.gross_amount)-0.01} step="0.01" value={fees[row.id] ?? ""} onChange={e=>setFees(s=>({...s,[row.id]:e.target.value}))} className="mt-1 block w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label><p className="text-xs text-slate-500">Instructor receives: {money(Math.max(0,Number(row.gross_amount)-Number(fees[row.id]||0)),row.currency)}</p><button disabled={busy===row.id || fees[row.id]==null || fees[row.id]===""} onClick={()=>act(row.id,{action:"reconcile",id:row.id,platformFee:Number(fees[row.id])})} className="rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy===row.id?"Saving...":"Release balance"}</button></div></article>)}</div>}
    </section>
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold text-slate-900">Instructor payout requests</h2><p className="mt-1 text-sm text-slate-500">Payout details are masked while a request is pending. Full transfer details become visible after approval. Mark as paid only after the transfer has actually been completed.</p>
      {payouts.length===0 ? <p className="mt-5 rounded-xl border border-dashed p-7 text-center text-sm text-slate-500">No payout requests yet.</p> : <div className="mt-5 space-y-4">{payouts.map(row=><article key={row.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold text-slate-900">{row.instructor?.name || row.instructor?.email || row.instructor_id}</h3><p className="mt-1 text-xs text-slate-500">{row.payout_method} · {row.account_name} · {row.account_details}</p><p className="mt-1 text-xs text-slate-400">Requested {new Date(row.requested_at).toLocaleString()}</p></div><div className="text-right"><p className="font-extrabold">{money(row.amount,row.currency)}</p><p className="mt-1 text-xs font-bold uppercase text-slate-500">{row.status}</p></div></div><label className="mt-3 block text-xs font-semibold text-slate-600">Admin note<input value={notes[row.id] ?? row.admin_note ?? ""} onChange={e=>setNotes(s=>({...s,[row.id]:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label><div className="mt-3 flex flex-wrap gap-2">{row.status==="pending" && <><button disabled={busy===row.id} onClick={()=>act(row.id,{action:"payout",id:row.id,status:"approved",note:notes[row.id]||""})} className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white">Approve</button><button disabled={busy===row.id} onClick={()=>act(row.id,{action:"payout",id:row.id,status:"rejected",note:notes[row.id]||""})} className="rounded-lg border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700">Reject</button></>}{row.status==="approved" && <button disabled={busy===row.id} onClick={()=>act(row.id,{action:"payout",id:row.id,status:"paid",note:notes[row.id]||""})} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white">Record transfer completed</button>}</div></article>)}</div>}
    </section>
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold text-slate-900">Finance audit history</h2><p className="mt-1 text-sm text-slate-500">A record of administrator reconciliation and payout decisions.</p>{audit.length===0 ? <p className="mt-4 text-sm text-slate-500">No finance actions recorded yet.</p> : <div className="mt-4 space-y-3">{audit.map(item=><div key={item.id} className="flex flex-wrap justify-between gap-3 border-b border-slate-100 pb-3 text-sm last:border-0"><div><p className="font-semibold text-slate-800">{item.action.replaceAll("_"," ")}</p><p className="mt-1 text-xs text-slate-500">{item.note || (item.earning_id ? "Earning " + item.earning_id : "Payout " + item.payout_request_id)}</p></div><div className="text-right"><p className="font-semibold">{item.amount==null ? "—" : money(item.amount,item.currency||"")}</p><p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p></div></div>)}</div>}</section>
  </div></main>;
}
