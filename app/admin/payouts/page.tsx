"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Payout = {
  id: string; vendor_id: string; amount: number|string; currency: string;
  status: "pending"|"approved"|"rejected"|"paid"; vendor_note: string|null;
  admin_note: string|null; payout_method_snapshot: {method_type:string;country_code:string;currency:string;provider_name:string;account_name:string;destination_reference:string;branch_name:string|null}|null; requested_at: string; reviewed_at: string|null; paid_at: string|null;
  vendor_profiles: { store_name: string; store_slug: string; contact_email: string } | null;
};
const money = (amount:number,currency:string) => {
  try { return new Intl.NumberFormat(undefined,{style:"currency",currency}).format(amount); }
  catch { return currency+" "+amount.toFixed(2); }
};

export default function AdminPayoutsPage() {
  const [items,setItems]=useState<Payout[]>([]);
  const [filter,setFilter]=useState("pending");
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState("");
  const [loading,setLoading]=useState(true);
  const [authorized,setAuthorized]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    const response=await fetch("/api/admin/payouts",{cache:"no-store",credentials:"same-origin"});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Could not load payout requests.");
    setItems((result.requests||[]) as Payout[]);
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
      try{await load();}catch(e){setError(e instanceof Error?e.message:"Could not load payout requests.");}
      if(active)setLoading(false);
    }
    init();return()=>{active=false;};
  },[load]);

  async function decide(item:Payout,status:"approved"|"rejected"|"paid"){
    setBusy(item.id);setError("");setNotice("");
    const confirmsExternalPayment=status==="paid"
      ? window.confirm("Confirm that you have already transferred this amount to the seller outside NBJCreative Hub. No transfer will be made by this action.")
      : false;
    if(status==="paid"&&!confirmsExternalPayment){setBusy("");return;}
    const response=await fetch("/api/admin/payouts",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,status,adminNote:notes[item.id]||"",confirmsExternalPayment})});
    const result=await response.json();
    if(!response.ok||!result.ok)setError(result.error||"The decision could not be saved.");
    else{setItems(current=>current.map(row=>row.id===item.id?{...row,...result.request}:row));setNotice("Payout request marked "+status+".");}
    setBusy("");
  }

  const visible=useMemo(()=>filter==="all"?items:items.filter(item=>item.status===filter),[items,filter]);
  const counts={pending:items.filter(x=>x.status==="pending").length,approved:items.filter(x=>x.status==="approved").length,paid:items.filter(x=>x.status==="paid").length,rejected:items.filter(x=>x.status==="rejected").length};
  if(loading)return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Checking administrator access...</main>;
  if(!authorized)return <main className="min-h-screen grid place-items-center p-6"><div className="rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-xl font-bold">Administrator access required</h1><p className="mt-3 text-sm text-slate-600">{error}</p><Link href="/admin/login" className="mt-5 inline-block text-sm font-bold text-teal-700">Admin login</Link></div></main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><div><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><p className="mt-1 text-xs text-slate-500">Finance administration</p></div><Link href="/admin" className="text-sm font-semibold text-teal-700">← Admin dashboard</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-9">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Seller finance</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Payout management</h1><p className="mt-2 text-sm text-slate-500">Review vendor requests and record decisions. Transfers must be made separately using your chosen payment provider.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">{(["pending","approved","paid","rejected"] as const).map(s=><article key={s} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs capitalize text-slate-500">{s} requests</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{counts[s]}</p></article>)}</div>
      <div className="mt-7 flex flex-wrap gap-2">{["pending","approved","paid","rejected","all"].map(s=><button key={s} onClick={()=>setFilter(s)} className={"rounded-full px-4 py-2 text-xs font-bold capitalize "+(filter===s?"bg-slate-900 text-white":"border border-slate-200 bg-white text-slate-600")}>{s}</button>)}<button onClick={()=>load().catch(e=>setError(e.message))} className="ml-auto rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold">Refresh</button></div>
      {error&&<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice&&<p role="status" className="mt-5 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{notice}</p>}
      <section className="mt-5 space-y-4">{visible.length===0?<div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">No {filter==="all"?"":filter+" "}payout requests.</div>:visible.map(item=><article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{item.vendor_profiles?.store_name||"Vendor store"}</h2><p className="mt-1 text-xs text-slate-500">{item.vendor_profiles?.contact_email||"No contact email"} · {new Date(item.requested_at).toLocaleString()}</p><p className="mt-3 text-2xl font-extrabold text-slate-900">{money(Number(item.amount),item.currency)}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{item.status}</span></div>
        {item.payout_method_snapshot&&<div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/50 p-4 text-sm"><p className="font-bold text-slate-800">Payout destination snapshot</p><p className="mt-1 text-slate-700">{item.payout_method_snapshot.method_type==="bank"?"Bank account":"Mobile money"} · {item.payout_method_snapshot.provider_name}</p><p className="text-slate-700">Account holder: {item.payout_method_snapshot.account_name}</p><p className="font-semibold text-slate-900">Destination: {item.payout_method_snapshot.destination_reference}</p><p className="text-xs text-slate-500">{item.payout_method_snapshot.currency} · {item.payout_method_snapshot.country_code}{item.payout_method_snapshot.branch_name?" · "+item.payout_method_snapshot.branch_name:""}</p></div>}{item.vendor_note&&<p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><strong>Seller note:</strong> {item.vendor_note}</p>}
        {item.admin_note&&<p className="mt-3 text-sm text-slate-600"><strong>Previous admin note:</strong> {item.admin_note}</p>}
        {item.status!=="paid"&&item.status!=="rejected"&&<div className="mt-5"><label className="block text-xs font-semibold text-slate-600">Administrator note<textarea maxLength={1000} rows={2} value={notes[item.id]??item.admin_note??""} onChange={e=>setNotes(current=>({...current,[item.id]:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"/></label><div className="mt-3 flex flex-wrap gap-2">{item.status==="pending"&&<><button disabled={!!busy} onClick={()=>decide(item,"approved")} className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Approve request</button><button disabled={!!busy} onClick={()=>decide(item,"rejected")} className="rounded-lg border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">Reject request</button></>}{item.status==="approved"&&<button disabled={!!busy} onClick={()=>decide(item,"paid")} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Mark paid (after external transfer)</button>}</div></div>}
      </article>)}</section>
      <p className="mt-6 text-xs leading-5 text-slate-400">Marking a request as paid is an administrative record only and requires confirmation that the seller has already been paid outside this platform. This page does not initiate bank or mobile-money transfers.</p>
    </div>
  </main>;
}
