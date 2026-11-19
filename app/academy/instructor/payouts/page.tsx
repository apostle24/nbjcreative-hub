"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Earning = { id: string; currency: string; gross_amount: number | string; platform_fee_amount: number | string | null; instructor_amount: number | string | null; status: string; created_at: string };
type Payout = { id: string; currency: string; amount: number | string; payout_method: string; status: string; requested_at: string; admin_note: string | null };

export default function AcademyInstructorPayoutsPage() {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [currency, setCurrency] = useState("GHS");
  const [method, setMethod] = useState("Mobile Money");
  const [accountName, setAccountName] = useState("");
  const [accountDetails, setAccountDetails] = useState("");

  async function load() {
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) { window.location.assign("/account?next=/academy/instructor/payouts"); return; }
    const [earningResult, payoutResult] = await Promise.all([
      db.from("academy_instructor_earnings").select("id,currency,gross_amount,platform_fee_amount,instructor_amount,status,created_at").eq("instructor_id", user.id).order("created_at", { ascending: false }).limit(500),
      db.from("academy_instructor_payout_requests").select("id,currency,amount,payout_method,status,requested_at,admin_note").eq("instructor_id", user.id).order("requested_at", { ascending: false }).limit(100)
    ]);
    if (earningResult.error || payoutResult.error) setError("We couldn't load your Academy finance records. Please refresh.");
    else { setEarnings((earningResult.data ?? []) as Earning[]); setPayouts((payoutResult.data ?? []) as Payout[]); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const currencies = useMemo(() => Array.from(new Set(earnings.map(row => row.currency))).sort(), [earnings]);
  const totals = useMemo(() => {
    const result: Record<string, { review: number; available: number; requested: number; paid: number }> = {};
    for (const row of earnings) {
      const item = result[row.currency] ?? { review: 0, available: 0, requested: 0, paid: 0 };
      if (row.status === "pending_review") item.review += Number(row.gross_amount);
      if (row.status === "available") item.available += Number(row.instructor_amount ?? 0);
      if (row.status === "requested") item.requested += Number(row.instructor_amount ?? 0);
      if (row.status === "paid") item.paid += Number(row.instructor_amount ?? 0);
      result[row.currency] = item;
    }
    return result;
  }, [earnings]);

  async function requestPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const db = createClient();
    const { error: requestError } = await db.rpc("request_academy_instructor_payout", {
      p_currency: currency, p_payout_method: method, p_account_name: accountName.trim(), p_account_details: accountDetails.trim()
    });
    if (requestError) setError(requestError.message || "We couldn't submit your payout request.");
    else { setNotice("Your payout request has been submitted for finance review. No transfer has been made."); setAccountName(""); setAccountDetails(""); await load(); }
    setBusy(false);
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading instructor payouts...</main>;

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10"><div className="mx-auto max-w-6xl">
    <header><Link href="/academy/instructor/revenue" className="text-sm font-bold text-teal-700">← Course revenue</Link><p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Academy · Finance</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Earnings & payouts</h1><p className="mt-2 text-sm text-slate-600">Track earnings, available balances and payout requests.</p></header>
    {error && <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="mt-6 rounded-xl bg-teal-50 p-4 text-sm text-teal-800">{notice}</p>}
    <section className="mt-7 grid gap-4 md:grid-cols-2">{currencies.length ? currencies.map(code => { const value = totals[code]; return <article key={code} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{code} balance summary</p><div className="mt-4 grid grid-cols-2 gap-4"><div><p className="text-xs text-slate-500">Under review (gross)</p><p className="mt-1 text-xl font-extrabold text-slate-900">{code} {value.review.toFixed(2)}</p></div><div><p className="text-xs text-slate-500">Available</p><p className="mt-1 text-xl font-extrabold text-emerald-700">{code} {value.available.toFixed(2)}</p></div><div><p className="text-xs text-slate-500">Payout requested</p><p className="mt-1 text-lg font-bold text-slate-800">{code} {value.requested.toFixed(2)}</p></div><div><p className="text-xs text-slate-500">Paid out</p><p className="mt-1 text-lg font-bold text-slate-800">{code} {value.paid.toFixed(2)}</p></div></div></article>; }) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500 md:col-span-2">Your course earnings will appear here after confirmed course payments are recorded.</div>}</section>
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-extrabold text-slate-900">Request a payout</h2><p className="mt-1 text-sm text-slate-500">Requests include your full available balance in the selected currency. Requests are reviewed before any transfer.</p>
      <form onSubmit={requestPayout} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Currency<select required value={currency} onChange={e=>setCurrency(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3">{Array.from(new Set(["GHS",...currencies])).map(code=><option key={code}>{code}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Payout method<select value={method} onChange={e=>setMethod(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option>Mobile Money</option><option>Bank Transfer</option><option>Other</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Account / wallet name<input required minLength={2} maxLength={120} value={accountName} onChange={e=>setAccountName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Name on the account"/></label>
        <label className="text-sm font-semibold text-slate-700">Account / wallet details<input required minLength={4} maxLength={240} value={accountDetails} onChange={e=>setAccountDetails(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="MoMo number or bank and account number"/></label>
        <p className="text-xs leading-5 text-slate-500 md:col-span-2">Only submit details needed to identify your payout destination. They are stored with your private request. Do not enter card PINs, passwords or OTPs.</p>
        <button disabled={busy || (totals[currency]?.available ?? 0) <= 0} className="rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-50 md:col-span-2">{busy ? "Submitting..." : "Request available balance"}</button>
      </form>
    </section>
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-extrabold text-slate-900">Payout request history</h2>{payouts.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="px-3 py-3">Date</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Method</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{payouts.map(row=><tr key={row.id} className="border-b border-slate-100"><td className="px-3 py-4 text-slate-500">{new Date(row.requested_at).toLocaleDateString()}</td><td className="px-3 py-4 font-bold">{row.currency} {Number(row.amount).toFixed(2)}</td><td className="px-3 py-4">{row.payout_method}</td><td className="px-3 py-4 capitalize">{row.status}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-slate-500">No payout requests yet.</p>}</section>
    <p className="mt-5 text-xs leading-5 text-slate-500">New earnings stay under review until the platform fee and instructor share are reconciled. Actual bank and Mobile Money transfers are not connected yet.</p>
  </div></main>;
}
