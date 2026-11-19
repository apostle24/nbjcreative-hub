"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, PackageCheck, RefreshCw, Search, ChevronDown, ChevronUp, CheckCircle2, Clock3 } from "lucide-react";

type DownloadItem = {
  id: string;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  revoked_at: string | null;
  file: { file_name: string; size_bytes: number | null } | null;
};
type OrderItem = {
  id: string; product_title: string; quantity: number; unit_price: number | string; currency: string;
  downloads: DownloadItem[];
};
type Order = {
  id: string; reference: string; amount: number | string; currency: string; payment_status: string;
  fulfillment_status: string; paid_at: string | null; created_at: string; items: OrderItem[];
};

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "paid" | "pending">("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);

  async function loadOrders() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/account/orders", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load orders.");
      setOrders(result.orders || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrders(); }, []);

  async function download(entitlementId: string) {
    setDownloading(entitlementId); setError("");
    try {
      const response = await fetch("/api/downloads/" + entitlementId, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Download could not be prepared.");
      window.location.assign(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download could not be prepared.");
    } finally {
      setDownloading(null);
    }
  }

  const money = (amount: number | string, currency: string) =>
    new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(amount));

  const visibleOrders = useMemo(() => orders.filter(order => {
    const matchesFilter = filter === "all" || order.payment_status === filter;
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || order.reference.toLowerCase().includes(term) ||
      order.items.some(item => item.product_title.toLowerCase().includes(term));
    return matchesFilter && matchesQuery;
  }), [orders, filter, query]);

  function toggleDetails(id: string) {
    setExpanded(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  return <main className="min-h-screen bg-mist">
    <header className="border-b border-slate-100 bg-white">
      <div className="container flex h-20 items-center justify-between">
        <Link href="/" className="font-extrabold tracking-tight text-ink">NBJCreative <span className="text-teal">Hub</span></Link>
        <Link href="/account" className="text-sm font-semibold text-slate-600 hover:text-teal"><ArrowLeft size={15} className="mr-2 inline"/>Account</Link>
      </div>
    </header>
    <div className="container max-w-4xl py-12 md:py-16">
      <p className="eyebrow mb-3">Your purchases</p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-4xl font-extrabold tracking-tight text-ink">My orders</h1><p className="mt-2 text-sm text-slate-500">Review purchases, check payment progress and access your files.</p></div>
        <button onClick={loadOrders} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-teal disabled:opacity-50"><RefreshCw size={15}/>Refresh</button>
      </div>
      {error && <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {!loading && orders.length > 0 && <div className="mt-7 space-y-3">
        <div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by order reference or product" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-teal"/></div>
        <div className="flex flex-wrap gap-2">
          {(["all", "paid", "pending"] as const).map(value => <button key={value} onClick={() => setFilter(value)} className={"rounded-full px-4 py-2 text-xs font-bold capitalize " + (filter === value ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-teal")}>{value === "all" ? "All orders" : value + " payment"}</button>)}
        </div>
      </div>}
      {loading && <p className="mt-8 rounded-2xl bg-white p-8 text-sm text-slate-500">Loading your purchases...</p>}
      {!loading && !error && orders.length === 0 && <section className="mt-8 rounded-2xl bg-white p-8 text-center">
        <PackageCheck className="mx-auto text-teal" size={34}/>
        <h2 className="mt-4 text-xl font-bold text-ink">No orders yet</h2>
        <p className="mt-2 text-sm text-slate-500">Your purchases will appear here after checkout.</p>
        <Link href="/marketplace" className="mt-5 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">Explore marketplace</Link>
      </section>}
      {!loading && !error && orders.length > 0 && visibleOrders.length === 0 && <div className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-slate-500">No orders match your search.</div>}
      <div className="mt-6 space-y-5">
        {visibleOrders.map(order => {
          const isPaid = order.payment_status === "paid";
          const hasDownloads = order.items.some(item => item.downloads.length > 0);
          const isOpen = expanded.includes(order.id);
          return <section key={order.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Order reference</p><h2 className="mt-1 text-lg font-extrabold text-ink">{order.reference}</h2><p className="mt-1 text-xs text-slate-400">Placed {new Date(order.created_at).toLocaleString()}</p></div>
                <div className="text-right"><p className="text-lg font-extrabold text-ink">{money(order.amount, order.currency)}</p><span className={"mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize " + (isPaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{order.payment_status} payment</span></div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-mist p-3"><div className="flex items-center gap-2 text-xs font-bold text-slate-700">{isPaid ? <CheckCircle2 size={15} className="text-emerald-600"/> : <Clock3 size={15} className="text-amber-600"/>} Order placed</div><p className="mt-1 text-xs text-slate-500">Your order is recorded.</p></div>
                <div className="rounded-xl bg-mist p-3"><div className="flex items-center gap-2 text-xs font-bold text-slate-700">{isPaid ? <CheckCircle2 size={15} className="text-emerald-600"/> : <Clock3 size={15} className="text-amber-600"/>} Payment {isPaid ? "confirmed" : "pending"}</div><p className="mt-1 text-xs text-slate-500">{order.paid_at ? "Paid " + new Date(order.paid_at).toLocaleString() : "Awaiting payment confirmation."}</p></div>
                <div className="rounded-xl bg-mist p-3"><div className="flex items-center gap-2 text-xs font-bold text-slate-700">{hasDownloads ? <CheckCircle2 size={15} className="text-emerald-600"/> : <Clock3 size={15} className="text-slate-400"/>} Digital access</div><p className="mt-1 text-xs text-slate-500">{hasDownloads ? "Your files are available below." : isPaid ? "No files are available for this order yet." : "Available after confirmed payment."}</p></div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">{order.items.length} {order.items.length === 1 ? "product" : "products"} in this order</p>
                <button onClick={() => toggleDetails(order.id)} aria-expanded={isOpen} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-ink hover:border-teal">{isOpen ? "Hide order details" : "View order details"}{isOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</button>
              </div>
            </div>
            {isOpen && <div className="border-t border-slate-100 bg-slate-50/70 p-6 md:p-8">
              <h3 className="mb-4 text-sm font-extrabold text-ink">Products and downloads</h3>
              <div className="space-y-5">
                {order.items.map(item => <div key={item.id}>
                  <div className="flex flex-wrap justify-between gap-2"><div><h4 className="font-bold text-ink">{item.product_title}</h4><p className="mt-1 text-xs text-slate-500">Quantity: {item.quantity}</p></div><p className="text-sm font-semibold text-slate-600">{money(Number(item.unit_price) * item.quantity, item.currency)}</p></div>
                  {isPaid && item.downloads.length > 0 && <div className="mt-3 space-y-2">
                    {item.downloads.map(d => {
                      const unavailable = !!d.revoked_at || (!!d.expires_at && new Date(d.expires_at) <= new Date()) || (!!d.max_downloads && d.download_count >= d.max_downloads);
                      return <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3">
                        <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{d.file?.file_name || "Product file"}</p><p className="text-xs text-slate-500">{d.download_count} downloads{d.max_downloads ? " of " + d.max_downloads : ""}{d.expires_at ? " · Expires " + new Date(d.expires_at).toLocaleDateString() : ""}</p></div>
                        <button onClick={() => download(d.id)} disabled={downloading === d.id || unavailable} className="inline-flex items-center gap-2 rounded-full bg-teal px-4 py-2.5 text-xs font-bold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"><Download size={14}/>{downloading === d.id ? "Preparing..." : unavailable ? "Unavailable" : "Download"}</button>
                      </div>;
                    })}
                  </div>}
                  {isPaid && item.downloads.length === 0 && <p className="mt-2 text-xs text-slate-500">No downloadable files are attached to this product yet.</p>}
                </div>)}
              </div>
            </div>}
          </section>;
        })}
      </div>
    </div>
  </main>;
}
