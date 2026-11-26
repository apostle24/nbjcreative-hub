"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Refund = {
  id: string; order_id: string; customer_id: string; refund_reference: string;
  amount: number|string; currency: string; reason: string; customer_note: string|null;
  status: string; admin_note: string|null; requested_at: string; processed_at: string|null;
  orders: { reference: string; customer_email: string } | null;
};
const money = (amount:number|string,currency:string) => {
  try { return new Intl.NumberFormat(undefined,{style:"currency",currency}).format(Number(amount)); }
  catch { return currency+" "+Number(amount).toFixed(2); }
};

export default function AdminRefundsPage() {
  const [items,setItems]=useState<Refund[]>([]);
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [filter,setFilter]=useState("requested");
  const [busy,setBusy]=useState("");
  const [loading,setLoading]=useState(true);
  const [authorized,setAuthorized]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    const response=await fetch("/api/admin/refunds",{cache:"no-store",credentials:"same-origin"});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Could not load refund requests.");
    setItems(result.refunds||[]);
  },[]);

  useEffect(()=>{
    let active=true;
    async function init(){
      const supabase=createClient();
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){window.location.assign("/admin/login");return;}
      const {data:profile,error:profileError}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
      if(!active)return;
      if(profileError||profile?.role!=="admin"){setError("Administrator access is required.");setLoading(false);return;}
      setAuthorized(true);
      try{await load();}catch(e){setError(e instanceof Error?e.message:"Could not load refunds.");}
      if(active)setLoading(false);
    }
    init();return()=>{active=false;};
  },[load]);

  async function decide(item:Refund,decision:"approve"|"reject"){
    const prompt=decision==="approve"
      ? "Approve and submit this full refund to Paystack now?"
      : "Reject this customer's refund request?";
    if(!window.confirm(prompt))return;
    setBusy(item.id);setError("");setNotice("");
    const response=await fetch("/api/admin/refunds",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,decision,adminNote:notes[item.id]||""})});
    const result=await response.json();
    if(!response.ok&&!result.refund){setError(result.error||"Could not process this decision.");}
    else if(response.status===202){setNotice(result.error||"Refund submission is being reconciled. Do not submit it again.");}
    else if(result.ok){setItems(current=>current.map(row=>row.id===item.id?{...row,...result.refund}:row));setNotice(decision==="approve"?"Refund sent to Paystack for processing.":"Refund request rejected.");}
    else setError(result.error||"Could not update refund.");
    setBusy("");
    await load().catch(()=>undefined);
  }

  const visible=items.filter(item=>filter==="all"||item.status===filter);
  const statuses=["requested","processing","pending","needs_attention","failed","processed","rejected","all"];
  if(loading)return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Checking administrator access...</main>;
  if(!authorized)return <main className="min-h-screen grid place-items-center p-6"><div className="rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-xl font-bold">Administrator access required</h1><p className="mt-3 text-sm text-slate-600">{error}</p><Link href="/admin/login" className="mt-5 inline-block text-sm font-bold text-teal-700">Admin login</Link></div></main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><div><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><p className="mt-1 text-xs text-slate-500">Finance administration</p></div><Link href="/admin" className="text-sm font-semibold text-teal-700">← Admin dashboard</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-9">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Customer finance</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Refund requests</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-500">Review full Marketplace order refunds. Approval submits the refund to Paystack; the final status is updated by Paystack webhooks. A queued refund is not yet a completed refund.</p>
      <div className="mt-6 flex flex-wrap gap-2">{statuses.map(status=><button key={status} onClick={()=>setFilter(status)} className={"rounded-full px-4 py-2 text-xs font-bold capitalize "+(filter===status?"bg-slate-900 text-white":"border border-slate-200 bg-white text-slate-600")}>{status.replaceAll("_"," ")}</button>)}<button onClick={()=>load().catch(e=>setError(e.message))} className="ml-auto rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold">Refresh</button></div>
      {error&&<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice&&<p role="status" className="mt-5 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{notice}</p>}
      <section className="mt-5 space-y-4">{visible.length===0?<div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">No refund requests in this view.</div>:visible.map(item=><article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{item.orders?.reference||"Marketplace order"}</h2><p className="mt-1 text-xs text-slate-500">{item.orders?.customer_email||"Customer"} · {new Date(item.requested_at).toLocaleString()}</p><p className="mt-3 text-2xl font-extrabold text-slate-900">{money(item.amount,item.currency)}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{item.status.replaceAll("_"," ")}</span></div>
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><p><strong>Reason:</strong> {item.reason}</p>{item.customer_note&&<p className="mt-2 whitespace-pre-wrap"><strong>Customer note:</strong> {item.customer_note}</p>}<p className="mt-2 text-xs text-slate-500">Paystack refund reference: {item.refund_reference}</p></div>
        {item.admin_note&&<p className="mt-3 text-sm text-slate-600"><strong>Administrator note:</strong> {item.admin_note}</p>}
        {item.status==="requested"&&<div className="mt-5"><label className="block text-xs font-semibold text-slate-600">Administrator note<textarea maxLength={2000} rows={2} value={notes[item.id]||""} onChange={e=>setNotes(current=>({...current,[item.id]:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"/></label><div className="mt-3 flex flex-wrap gap-2"><button disabled={!!busy} onClick={()=>decide(item,"approve")} className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy===item.id?"Processing...":"Approve and refund via Paystack"}</button><button disabled={!!busy} onClick={()=>decide(item,"reject")} className="rounded-lg border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">Reject request</button></div></div>}
        {item.status==="processing"&&<p className="mt-4 text-xs text-amber-700">Paystack response is being reconciled. Check the Paystack dashboard using the refund reference before taking further action.</p>}
        {item.status==="processed"&&<p className="mt-4 text-xs text-emerald-700">Paystack confirmed processing. Bank posting may take up to 10 business days.</p>}
      </article>)}</section>
    </div>
  </main>;
}
