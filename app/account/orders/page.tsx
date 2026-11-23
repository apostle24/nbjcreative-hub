"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  product_type?: string; item_fulfillment_status?: string; shipping_carrier?: string | null; tracking_number?: string | null; tracking_url?: string | null; seller_fulfillment_note?: string | null; shipped_at?: string | null; delivered_at?: string | null;
  service_status?: string; service_seller_note?: string | null; service_customer_note?: string | null;
  service_submitted_at?: string | null; service_completed_at?: string | null; service_revision_count?: number;
  downloads: DownloadItem[];
  service_deliverables?: { id: string; file_name: string; content_type: string | null; size_bytes: number; created_at: string }[];
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
  const [serviceNotes, setServiceNotes] = useState<Record<string, string>>({});
  const [serviceSaving, setServiceSaving] = useState<string | null>(null);
  const [serviceNotice, setServiceNotice] = useState("");

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

  async function downloadServiceDeliverable(deliverableId: string) {
    setDownloading(deliverableId); setError("");
    try {
      const response = await fetch("/api/service-deliverables/" + deliverableId, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Delivery download could not be prepared.");
      window.location.assign(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delivery download could not be prepared.");
    } finally {
      setDownloading(null);
    }
  }

  async function respondToService(item: OrderItem, action: "revision_requested" | "completed") {
    setServiceSaving(item.id); setError(""); setServiceNotice("");
    const supabase = createClient();
    const { error: responseError } = await supabase.rpc("respond_to_service_delivery", {
      p_order_item_id: item.id,
      p_action: action,
      p_note: serviceNotes[item.id] || null,
    });
    if (responseError) setError(responseError.message);
    else { setServiceNotice(action === "completed" ? "You confirmed the service as completed." : "Your revision request was sent to the seller."); await loadOrders(); }
    setServiceSaving(null);
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
      {error && <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}{serviceNotice && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{serviceNotice}</p>}
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
              <h3 className="mb-4 text-sm font-extrabold text-ink">Products, delivery, services and downloads</h3>
              <div className="space-y-5">
                {order.items.map(item => <div key={item.id}>
                  <div className="flex flex-wrap justify-between gap-2"><div><h4 className="font-bold text-ink">{item.product_title}</h4><p className="mt-1 text-xs text-slate-500">Quantity: {item.quantity}</p></div><p className="text-sm font-semibold text-slate-600">{money(Number(item.unit_price) * item.quantity, item.currency)}</p></div>
                  {isPaid && item.product_type === "physical" && <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Delivery progress</p><p className="mt-2 text-sm font-bold capitalize text-ink">{(item.item_fulfillment_status || "unfulfilled").replaceAll("_", " ")}</p>{item.shipping_carrier && <p className="mt-1 text-xs text-slate-600">Carrier: {item.shipping_carrier}</p>}{item.tracking_number && <p className="mt-1 text-xs text-slate-600">Tracking number: {item.tracking_number}</p>}{item.tracking_url && <a href={item.tracking_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-bold text-teal underline">Track shipment</a>}{item.shipped_at && <p className="mt-1 text-xs text-slate-500">Shipped {new Date(item.shipped_at).toLocaleString()}</p>}{item.delivered_at && <p className="mt-1 text-xs text-slate-500">Delivered {new Date(item.delivered_at).toLocaleString()}</p>}{item.seller_fulfillment_note && <p className="mt-2 text-xs text-slate-600">{item.seller_fulfillment_note}</p>}</div>}
                  {isPaid && item.product_type === "online_service" && <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Online-service progress</p>
                    <p className="mt-2 text-sm font-bold capitalize text-ink">{(item.service_status || "not_started").replaceAll("_"," ")}</p>
                    {item.service_seller_note && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.service_seller_note}</p>}
                    {item.service_submitted_at && <p className="mt-2 text-xs text-slate-500">Submitted {new Date(item.service_submitted_at).toLocaleString()}</p>}
                    {(item.service_deliverables || []).length > 0 && <div className="mt-3 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Files delivered by the seller</p>
                      {(item.service_deliverables || []).map(file=><div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                        <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{file.file_name}</p><p className="text-xs text-slate-500">{(file.size_bytes / 1024 / 1024).toFixed(2)} MB · {new Date(file.created_at).toLocaleString()}</p></div>
                        <button onClick={()=>downloadServiceDeliverable(file.id)} disabled={downloading===file.id} className="inline-flex items-center gap-2 rounded-full bg-teal px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Download size={14}/>{downloading===file.id ? "Preparing..." : "Download file"}</button>
                      </div>)}
                    </div>}
                    {item.service_status === "submitted" && <div className="mt-3 space-y-2">
                      <textarea aria-label="Service review or revision instructions" rows={3} placeholder="If you need a change, explain it here..." value={serviceNotes[item.id] || ""} onChange={e=>setServiceNotes(current=>({...current,[item.id]:e.target.value}))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"/>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={()=>respondToService(item,"revision_requested")} disabled={serviceSaving===item.id || !(serviceNotes[item.id] || "").trim()} className="rounded-full border border-amber-500 px-4 py-2 text-xs font-bold text-amber-700 disabled:opacity-50">Request a revision</button>
                        <button onClick={()=>respondToService(item,"completed")} disabled={serviceSaving===item.id} className="rounded-full bg-teal px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{serviceSaving===item.id ? "Saving..." : "Accept and complete"}</button>
                      </div>
                    </div>}
                    {item.service_status === "completed" && <p className="mt-2 text-sm font-semibold text-emerald-700">You marked this service as completed.</p>}
                    {item.service_status === "revision_requested" && <p className="mt-2 text-xs text-amber-700">Your revision request has been sent. The seller will update the work and submit it again.</p>}
                    {(item.service_status === "not_started" || item.service_status === "in_progress") && <p className="mt-2 text-xs text-slate-500">The seller will submit the work here when it is ready for your review.</p>}
                    <p className="mt-2 text-xs text-slate-400">Revisions requested: {item.service_revision_count || 0}</p>
                  </div>}
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
