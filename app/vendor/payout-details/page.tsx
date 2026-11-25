"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Method = { id:string; method_type:"bank"|"mobile_money"; country_code:string; currency:string; provider_name:string; account_name:string; destination_masked:string; branch_name:string|null; updated_at:string };

const COUNTRY_CODES = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ",
  "BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ",
  "CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CU","CV","CW","CX","CY","CZ",
  "DE","DJ","DK","DM","DO","DZ",
  "EC","EE","EG","EH","ER","ES","ET",
  "FI","FJ","FK","FM","FO","FR",
  "GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY",
  "HK","HM","HN","HR","HT","HU",
  "ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT",
  "JE","JM","JO","JP",
  "KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ",
  "LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY",
  "MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ",
  "NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ",
  "OM",
  "PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY",
  "QA",
  "RE","RO","RS","RU","RW",
  "SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ",
  "TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ",
  "UA","UG","UM","US","UY","UZ",
  "VA","VC","VE","VG","VI","VN","VU",
  "WF","WS",
  "YE","YT",
  "ZA","ZM","ZW"
] as const;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const COUNTRIES = COUNTRY_CODES
  .map(code => ({ code, name: regionNames.of(code) || code }))
  .sort((a, b) => a.name.localeCompare(b.name));

const currencyValues = (Intl as unknown as { supportedValuesOf?: (key: "currency") => string[] }).supportedValuesOf;
const CURRENCIES = (currencyValues ? currencyValues("currency") : [
  "AED","AFN","ALL","AMD","ANG","AOA","ARS","AUD","AWG","AZN","BAM","BBD","BDT","BGN","BHD","BIF","BMD","BND","BOB","BRL","BSD","BTN","BWP","BYN","BZD",
  "CAD","CDF","CHF","CLP","CNY","COP","CRC","CUP","CVE","CZK","DJF","DKK","DOP","DZD","EGP","ERN","ETB","EUR","FJD","FKP","GBP","GEL","GHS","GIP","GMD","GNF","GTQ","GYD",
  "HKD","HNL","HTG","HUF","IDR","ILS","INR","IQD","IRR","ISK","JMD","JOD","JPY","KES","KGS","KHR","KMF","KPW","KRW","KWD","KYD","KZT","LAK","LBP","LKR","LRD","LSL","LYD",
  "MAD","MDL","MGA","MKD","MMK","MNT","MOP","MRU","MUR","MVR","MWK","MXN","MYR","MZN","NAD","NGN","NIO","NOK","NPR","NZD","OMR","PAB","PEN","PGK","PHP","PKR","PLN","PYG",
  "QAR","RON","RSD","RUB","RWF","SAR","SBD","SCR","SDG","SEK","SGD","SHP","SLE","SOS","SRD","SSP","STN","SYP","SZL","THB","TJS","TMT","TND","TOP","TRY","TTD","TWD","TZS",
  "UAH","UGX","USD","UYU","UZS","VES","VND","VUV","WST","XAF","XCD","XOF","XPF","YER","ZAR","ZMW","ZWL"
]).filter(code => /^[A-Z]{3}$/.test(code)).sort();

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
        <label className="text-sm font-semibold text-slate-700">Country where your payout account is held<select required value={country} onChange={e=>setCountry(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"><option value="">Select country</option>{COUNTRIES.map(item=><option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Payout currency<select required value={currency} onChange={e=>setCurrency(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">{CURRENCIES.map(code=><option key={code} value={code}>{code}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">Choose the currency your bank or wallet can receive. Availability depends on your payout provider.</span></label>
        <label className="text-sm font-semibold text-slate-700">{methodType==="bank"?"Bank name":"Mobile-money network or wallet provider"}<input required maxLength={100} value={provider} onChange={e=>setProvider(e.target.value)} placeholder={methodType==="bank"?"Bank name":"e.g. MTN MoMo"} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>
        <label className="text-sm font-semibold text-slate-700">Account holder name<input required maxLength={120} value={accountName} onChange={e=>setAccountName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Name on account"/></label>
        <label className="text-sm font-semibold text-slate-700">{methodType==="bank"?"Account number or IBAN":"Mobile-money number or wallet reference"}<input required={!method} maxLength={80} value={destination} onChange={e=>setDestination(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder={method?"Leave blank to keep saved number":"Enter account or wallet number"}/>{method&&<span className="mt-1 block text-xs font-normal text-slate-500">Leave blank to keep the existing number.</span>}</label>
        {methodType==="bank"&&<label className="text-sm font-semibold text-slate-700 md:col-span-2">Branch (optional)<input maxLength={120} value={branch} onChange={e=>setBranch(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>}
        <button disabled={saving} className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50 md:col-span-2">{saving?"Saving...":"Save payout details"}</button>
      </form>
    </section>
    <p className="mt-4 text-xs leading-5 text-slate-400">Only the platform's authorised payout administrators can access the full destination details for processing. Saving details does not trigger a payment. Country and currency choices do not guarantee that an external payout provider supports that destination.</p>
  </div></main>;
}
