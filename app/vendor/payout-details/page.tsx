"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Method = { id:string; method_type:"bank"|"mobile_money"; country_code:string; currency:string; provider_name:string; account_name:string; destination_masked:string; branch_name:string|null; updated_at:string };

export default function VendorPayoutDetailsPage(){
  const [method,setMethod]=useState<Method|null>(null);
  const [methodType,setMethodType]=useState<"bank"|"mobile_money">("mobile_money");
  const [country,setCountry]=useState("GH");
  const [currency,setCurrency]=useState("GHS");
  const [provider,setProvider]=useState("");
  const [accountName,setAccountName]=useState("");
  const [destination,setDestination]=useState("");
  const [branch,setBranch]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function load(){
    const response=await fetch("/api/vendor/payout-details",{cache:"no-store",credentials:"same-origin"});
    const result=await response.json();
    if(response.status===401){window.location.assign("/account?next=/vendor/payout-details");return;}
    if(!response.ok)throw new Error(result.error||"Could not load payout details.");
    const m=result.method as Method|null;setMethod(m);
    if(m){setMethodType(m.method_type);setCountry(m.country_code);setCurrency(m.currency);setProvider(m.provider_name);setAccountName(m.account_name);setBranch(m.branch_name||"");}
  }
  useEffect(()=>{load().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setSaving(true);setError("");setNotice("");
    const response=await fetch("/api/vendor/payout-details",{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({method_type:methodType,country_code:country,currency,provider_name:provider,account_name:accountName,destination_reference:destination,branch_name:branch})});
    const result=await response.json();
    if(!response.ok)setError(result.error||"Could not save payout details.");
    else{setMethod(result.method);setDestination("");setNotice("Your payout details have been saved. The account reference is masked for security.");}
    setSaving(false);
  }

  if(loading)return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Loading payout details...</main>;
  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10"><div className="mx-auto max-w-3xl">
    <header className="flex items-center justify-between"><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><Link href="/vendor/payouts" className="text-sm font-semibold text-teal-700">← Earnings & payouts</Link></header>
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 md:p-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Seller finance</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Payout details</h1><p className="mt-2 text-sm leading-6 text-slate-600">Add the bank account or mobile-money destination where you want future vendor payouts sent. Your full account reference is never shown again after saving.</p>
      {method&&<div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm"><p className="font-bold text-slate-800">Saved payout destination</p><p className="mt-1 text-slate-600">{method.method_type==="bank"?"Bank account":"Mobile money"} · {method.provider_name}</p><p className="text-slate-600">{method.account_name} · {method.destination_masked}</p><p className="text-xs text-slate-500">{method.currency} · {method.country_code}</p></div>}
      {error&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{notice}</p>}
      <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Payout method<select value={methodType} onChange={e=>setMethodType(e.target.value as "bank"|"mobile_money")} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"><option value="mobile_money">Mobile money</option><option value="bank">Bank account</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Country code<input required maxLength={2} value={country} onChange={e=>setCountry(e.target.value.toUpperCase())} placeholder="GH" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>
        <label className="text-sm font-semibold text-slate-700">Currency<select value={currency} onChange={e=>setCurrency(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">{["GHS","USD","GBP","EUR"].map(c=><option key={c}>{c}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">{methodType==="bank"?"Bank name":"Mobile-money network"}<input required maxLength={100} value={provider} onChange={e=>setProvider(e.target.value)} placeholder={methodType==="bank"?"Bank name":"e.g. MTN MoMo"} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>
        <label className="text-sm font-semibold text-slate-700">Account holder name<input required maxLength={120} value={accountName} onChange={e=>setAccountName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Name on account"/></label>
        <label className="text-sm font-semibold text-slate-700">{methodType==="bank"?"Account number":"Mobile-money number"}<input required={!method} maxLength={80} value={destination} onChange={e=>setDestination(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder={method?"Leave blank to keep saved number":"Enter account or wallet number"}/>{method&&<span className="mt-1 block text-xs font-normal text-slate-500">Leave blank to keep the existing number.</span>}</label>
        {methodType==="bank"&&<label className="text-sm font-semibold text-slate-700 md:col-span-2">Branch (optional)<input maxLength={120} value={branch} onChange={e=>setBranch(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>}
        <button disabled={saving} className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50 md:col-span-2">{saving?"Saving...":"Save payout details"}</button>
      </form>
    </section>
    <p className="mt-4 text-xs leading-5 text-slate-400">Only the platform's authorised payout administrators can access the full destination details for processing. Saving details does not trigger a payment.</p>
  </div></main>;
}
