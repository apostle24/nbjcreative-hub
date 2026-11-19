"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type VendorOrder = {
  order_reference: string;
  product_title: string;
  quantity: number;
  unit_price: number | string;
  currency: string;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  fulfillment_status: "unfulfilled" | "fulfilled" | "partially_fulfilled" | "cancelled";
  order_created_at: string;
};

const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);

export default function VendorOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [storeName, setStoreName] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.assign("/account?next=/vendor/orders");
        return;
      }
      const { data: vendor, error: vendorError } = await supabase
        .from("vendor_profiles").select("store_name,status")
        .eq("owner_id", user.id).maybeSingle();
      if (!active) return;
      if (vendorError || !vendor || vendor.status !== "approved") {
        setError(vendorError?.message || "An approved vendor account is required to view orders.");
        setLoading(false);
        return;
      }
      setStoreName(vendor.store_name);
      const { data, error: ordersError } = await supabase.rpc("get_vendor_orders");
      if (!active) return;
      if (ordersError) setError(ordersError.message);
      else setOrders((data ?? []) as VendorOrder[]);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const visibleOrders = useMemo(() => filter === "all"
    ? orders
    : orders.filter(order => filter === "paid" || filter === "pending"
      ? order.payment_status === filter
      : order.fulfillment_status === filter), [orders, filter]);

  const paidCount = useMemo(() => new Set(orders.filter(o => o.payment_status === "paid").map(o => o.order_reference)).size, [orders]);
  const pendingCount = useMemo(() => new Set(orders.filter(o => o.payment_status === "pending").map(o => o.order_reference)).size, [orders]);
  const fulfilledCount = useMemo(() => new Set(orders.filter(o => o.fulfillment_status === "fulfilled").map(o => o.order_reference)).size, [orders]);

  if (loading) return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Loading your orders...</main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><p className="mt-1 text-xs text-slate-500">Vendor workspace</p></div>
        <Link href="/vendor" className="text-sm font-semibold text-teal-700 hover:underline">← Vendor Centre</Link>
      </div>
    </header>
    <div className="mx-auto max-w-6xl px-5 py-9">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Seller workspace</p>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Order management</h1>
      <p className="mt-2 text-sm text-slate-500">{storeName} · Track customer orders, payment and digital fulfilment.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!error && <>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Paid orders</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{paidCount}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Awaiting payment</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{pendingCount}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Fulfilled orders</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{fulfilledCount}</p></article>
        </div>
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
            <div><h2 className="text-lg font-bold text-slate-900">Your order items</h2><p className="mt-1 text-xs text-slate-500">Latest 500 order items for your products. Customer personal details are hidden.</p></div>
            <select aria-label="Filter orders" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="all">All orders</option><option value="paid">Paid</option><option value="pending">Awaiting payment</option><option value="fulfilled">Fulfilled</option><option value="unfulfilled">Unfulfilled</option><option value="partially_fulfilled">Partially fulfilled</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
          {visibleOrders.length === 0 ? <div className="p-10 text-center"><p className="font-semibold text-slate-800">No matching orders</p><p className="mt-2 text-sm text-slate-500">Orders for your published products will appear here.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Order reference</th><th className="px-6 py-3">Product</th><th className="px-6 py-3">Qty</th><th className="px-6 py-3">Total</th><th className="px-6 py-3">Payment</th><th className="px-6 py-3">Fulfilment</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleOrders.map((order,i)=><tr key={order.order_reference+order.product_title+i}><td className="whitespace-nowrap px-6 py-4 text-slate-600">{new Date(order.order_created_at).toLocaleDateString()}</td><td className="px-6 py-4 font-medium text-slate-700">{order.order_reference}</td><td className="px-6 py-4 text-slate-800">{order.product_title}</td><td className="px-6 py-4 text-slate-600">{order.quantity}</td><td className="whitespace-nowrap px-6 py-4 text-slate-700">{money(Number(order.unit_price)*Number(order.quantity),order.currency)}</td><td className="px-6 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{order.payment_status}</span></td><td className="px-6 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{order.fulfillment_status.replaceAll("_"," ")}</span></td></tr>)}</tbody></table></div>}
        </section>
        <p className="mt-5 text-xs leading-5 text-slate-400">This page is read-only. Digital fulfilment and download access are handled by NBJCreative Hub after verified payment. Physical shipping and seller-managed fulfilment can be added as a separate workflow later.</p>
      </>}
    </div>
  </main>;
}
