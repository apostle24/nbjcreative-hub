"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Balance = { currency: string; gross_sales: number | string; reserved_amount: number | string; available_balance: number | string };
type Request = { id: string; amount: number | string; currency: string; status: "pending"|"approved"|"rejected"|"paid"; vendor_note: string|null; admin_note: string|null; requested_at: string; reviewed_at: string|null; paid_at: string|null };

const money = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount); }
  catch { return currency + " " + amount.toFixed(2); }
};

export default function VendorPayoutsPage() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [currency, setCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.assign("/account?next=/vendor/payouts"); return; }
    const { data: vendor, error: vendorError } = await supabase.from("vendor_profiles")
      .select("id,status").eq("owner_id", user.id).maybeSingle();
    if (vendorError) throw vendorError;
    if (!vendor || vendor.status !== "approved") throw new Error("An approved vendor account is required to view earnings.");
    const [balanceResult, requestResult] = await Promise.all([
      supabase.rpc("get_vendor_earnings"),
      supabase.from("vendor_payout_requests").select("id,amount,currency,status,vendor_note,admin_note,requested_at,reviewed_at,paid_at")
        .eq("vendor_id", vendor.id).order("requested_at", { ascending: false }).limit(100)
    ]);
    if (balanceResult.error) throw balanceResult.error;
    if (requestResult.error) throw requestResult.error;
    const nextBalances = (balanceResult.data ?? []) as Balance[];
    setBalances(nextBalances);
    setRequests((requestResult.data ?? []) as Request[]);
    setCurrency(current => current || nextBalances[0]?.currency || "");
  }, []);

  useEffect(() => {
    let active = true;
    load().catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load earnings."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  const selected = useMemo(() => balances.find(b => b.currency === currency), [balances, currency]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    const value = Number(amount);
    if (!currency || !Number.isFinite(value) || value <= 0 || Math.round(value * 100) !== value * 100) {
      setError("Enter a valid amount with no more than two decimal places."); setSaving(false); return;
    }
    const { data, error: rpcError } = await createClient().rpc("request_vendor_payout", {
      p_amount: value, p_currency: currency, p_vendor_note: note.trim() || null
    });
    if (rpcError) setError(rpcError.message);
    else {
      setAmount(""); setNote("");
      setNotice("Your payout request has been submitted for administrator review. No transfer has been made.");
      await load();
    }
    setSaving(false);
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading earnings...</main>;

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10">
    <div className="mx-auto max-w-5xl">
      <header className="flex items-center justify-between gap-4"><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><Link href="/vendor" className="text-sm font-semibold text-teal-700 hover:underline">← Vendor Centre</Link></header>
      <section className="mt-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Seller workspace</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Earnings & payouts</h1><p className="mt-2 text-sm text-slate-600">Review paid sales, amounts already reserved for payout and your available balance.</p></section>
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!error && <>
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {balances.length ? balances.map(b => <article key={b.currency} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">{b.currency} gross paid sales</p><p className="mt-2 text-2xl font-extrabold text-slate-900">{money(Number(b.gross_sales),b.currency)}</p><p className="mt-3 text-xs text-slate-500">Reserved for payouts: {money(Number(b.reserved_amount),b.currency)}</p><p className="mt-1 text-sm font-bold text-teal-800">Available: {money(Number(b.available_balance),b.currency)}</p></article>) : <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 md:col-span-3">No paid sales have been recorded yet. Earnings will appear here after customers complete purchases.</div>}
        </section>
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">Request a payout</h2><p className="mt-1 text-sm text-slate-500">Add or update where your payout should be sent.</p></div><Link href="/vendor/payout-details" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-teal-800 hover:border-teal-600">Manage payout details →</Link></div><p className="mt-1 text-sm text-slate-500">Requests are reviewed by the platform administrator. A request does not transfer money.</p>
          <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Currency<select required value={currency} onChange={e=>setCurrency(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">{balances.map(b=><option key={b.currency} value={b.currency}>{b.currency} — available {money(Number(b.available_balance),b.currency)}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Amount<input required type="number" min="0.01" step="0.01" max={selected ? Number(selected.available_balance) : undefined} value={amount} onChange={e=>setAmount(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="0.00"/></label>
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">Note for administrator (optional)<textarea maxLength={500} rows={3} value={note} onChange={e=>setNote(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Any details about this payout request."/></label>
            {notice && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800 md:col-span-2">{notice}</p>}
            <button disabled={saving || !balances.length} className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50 md:col-span-2">{saving ? "Submitting..." : "Submit payout request"}</button>
          </form>
        </section>
        <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5"><h2 className="text-lg font-bold text-slate-900">Payout history</h2></div>
          {requests.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No payout requests yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Requested</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Admin note</th></tr></thead><tbody className="divide-y divide-slate-100">{requests.map(r=><tr key={r.id}><td className="px-5 py-4 text-slate-600">{new Date(r.requested_at).toLocaleDateString()}</td><td className="px-5 py-4 font-semibold text-slate-800">{money(Number(r.amount),r.currency)}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{r.status}</span></td><td className="px-5 py-4 text-slate-600">{r.admin_note || "—"}</td></tr>)}</tbody></table></div>}
        </section>
        <p className="mt-5 text-xs leading-5 text-slate-400">Balances are gross paid sales, before any platform fees, refunds, taxes or adjustments. Payout requests are manual review records only. No money is transferred automatically.</p>
      </>}
    </div>
  </main>;
}
