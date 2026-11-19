"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Sale = {
  order_reference: string;
  product_title: string;
  quantity: number;
  unit_price: number | string;
  currency: string;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  order_created_at: string;
};

const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);

export default function VendorSalesPage() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.assign("/account?next=/vendor/sales");
        return;
      }
      const { data: vendor, error: vendorError } = await supabase
        .from("vendor_profiles").select("id,store_name,status")
        .eq("owner_id", user.id).maybeSingle();
      if (!active) return;
      if (vendorError || !vendor || vendor.status !== "approved") {
        setError(vendorError?.message || "An approved vendor account is required to view sales.");
        setLoading(false);
        return;
      }
      setStoreName(vendor.store_name);
      const { data, error: salesError } = await supabase.rpc("get_vendor_sales");
      if (!active) return;
      if (salesError) setError(salesError.message);
      else setSales((data ?? []) as Sale[]);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const paid = useMemo(() => sales.filter(s => s.payment_status === "paid"), [sales]);
  const pending = useMemo(() => sales.filter(s => s.payment_status === "pending"), [sales]);
  const unitsSold = useMemo(() => paid.reduce((sum, s) => sum + Number(s.quantity), 0), [paid]);
  const revenueByCurrency = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const sale of paid) totals[sale.currency] = (totals[sale.currency] || 0) + Number(sale.unit_price) * Number(sale.quantity);
    return totals;
  }, [paid]);

  if (loading) return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Loading sales dashboard...</main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><p className="mt-1 text-xs text-slate-500">Vendor workspace</p></div>
        <Link href="/vendor" className="text-sm font-semibold text-teal-700 hover:underline">← Vendor Centre</Link>
      </div>
    </header>
    <div className="mx-auto max-w-6xl px-5 py-9">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Seller analytics</p>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Sales dashboard</h1>
      <p className="mt-2 text-sm text-slate-500">{storeName}</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!error && <>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Paid orders</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{paid.length}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Pending orders</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{pending.length}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Units sold</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{unitsSold}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Sales revenue</p><div className="mt-2 space-y-1">{Object.keys(revenueByCurrency).length ? Object.entries(revenueByCurrency).map(([currency,total])=><p key={currency} className="text-xl font-extrabold text-slate-900">{money(total,currency)}</p>) : <p className="text-3xl font-extrabold text-slate-900">—</p>}</div></article>
        </div>
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5"><div><h2 className="text-lg font-bold text-slate-900">Recent sales</h2><p className="mt-1 text-xs text-slate-500">Up to 500 latest order items for your store.</p></div><Link href="/vendor/products" className="text-sm font-bold text-teal-700 hover:underline">Manage products →</Link></div>
          {sales.length === 0 ? <div className="p-10 text-center"><p className="font-semibold text-slate-800">No sales recorded yet</p><p className="mt-2 text-sm text-slate-500">Your orders will appear here when customers purchase your published products.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Order</th><th className="px-6 py-3">Product</th><th className="px-6 py-3">Qty</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3">Payment</th></tr></thead><tbody className="divide-y divide-slate-100">{sales.map((sale,i)=><tr key={sale.order_reference + sale.product_title + i}><td className="whitespace-nowrap px-6 py-4 text-slate-600">{new Date(sale.order_created_at).toLocaleDateString()}</td><td className="px-6 py-4 font-medium text-slate-700">{sale.order_reference}</td><td className="px-6 py-4 text-slate-800">{sale.product_title}</td><td className="px-6 py-4 text-slate-600">{sale.quantity}</td><td className="whitespace-nowrap px-6 py-4 text-slate-700">{money(Number(sale.unit_price)*Number(sale.quantity),sale.currency)}</td><td className="px-6 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{sale.payment_status}</span></td></tr>)}</tbody></table></div>}
        </section>
        <p className="mt-5 text-xs leading-5 text-slate-400">This dashboard shows only your store's product sales. Customer email addresses and personal information are not displayed. Revenue is calculated from paid order items and is not a payout balance.</p>
      </>}
    </div>
  </main>;
}
