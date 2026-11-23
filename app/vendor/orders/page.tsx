"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type VendorOrder = {
  order_item_id: string;
  order_reference: string;
  product_title: string;
  quantity: number;
  unit_price: number | string;
  currency: string;
  product_type: "physical" | "digital" | "online_service";
  payment_status: "pending" | "paid" | "failed" | "refunded";
  fulfillment_status: "unfulfilled" | "fulfilled" | "partially_fulfilled" | "cancelled";
  item_fulfillment_status: "unfulfilled" | "processing" | "shipped" | "delivered" | "fulfilled";
  order_created_at: string;
  shipping_full_name: string | null;
  shipping_phone: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_region: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  seller_fulfillment_note: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  service_status: string;
  service_seller_note: string | null;
  service_customer_note: string | null;
  service_started_at: string | null;
  service_submitted_at: string | null;
  service_completed_at: string | null;
  service_revision_count: number;
};

type FulfillmentForm = { status: string; carrier: string; trackingNumber: string; trackingUrl: string; note: string };
type ServiceDeliverable = { id: string; order_item_id: string; file_name: string; content_type: string | null; size_bytes: number; created_at: string };
const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
const emptyForm = (order: VendorOrder): FulfillmentForm => ({
  status: order.item_fulfillment_status === "fulfilled" ? "delivered" : order.item_fulfillment_status,
  carrier: order.shipping_carrier || "",
  trackingNumber: order.tracking_number || "",
  trackingUrl: order.tracking_url || "",
  note: order.seller_fulfillment_note || "",
});

export default function VendorOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [storeName, setStoreName] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forms, setForms] = useState<Record<string, FulfillmentForm>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [serviceNotes, setServiceNotes] = useState<Record<string, string>>({});
  const [serviceFiles, setServiceFiles] = useState<Record<string, ServiceDeliverable[]>>({});
  const [serviceUploadFiles, setServiceUploadFiles] = useState<Record<string, File | null>>({});

  async function loadOrders() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.assign("/account?next=/vendor/orders"); return; }
    const { data: vendor, error: vendorError } = await supabase.from("vendor_profiles")
      .select("store_name,status").eq("owner_id", user.id).maybeSingle();
    if (vendorError || !vendor || vendor.status !== "approved") {
      setError(vendorError?.message || "An approved vendor account is required to view orders.");
      setLoading(false); return;
    }
    setStoreName(vendor.store_name);
    const { data, error: ordersError } = await supabase.rpc("get_vendor_orders");
    if (ordersError) setError(ordersError.message);
    else {
      const rows = (data ?? []) as VendorOrder[];
      setOrders(rows);
      const filesResponse = await fetch("/api/vendor/service-deliverables", { cache: "no-store" });
      if (filesResponse.ok) {
        const filesResult = await filesResponse.json();
        const grouped: Record<string, ServiceDeliverable[]> = {};
        for (const file of (filesResult.deliverables || []) as ServiceDeliverable[]) {
          grouped[file.order_item_id] = [...(grouped[file.order_item_id] || []), file];
        }
        setServiceFiles(grouped);
      }
      setForms(current => {
        const next = { ...current };
        rows.forEach(row => { if (!next[row.order_item_id]) next[row.order_item_id] = emptyForm(row); });
        return next;
      });
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => { void loadOrders(); }, []);

  function updateForm(id: string, key: keyof FulfillmentForm, value: string) {
    setForms(current => ({ ...current, [id]: { ...(current[id] || { status: "processing", carrier: "", trackingNumber: "", trackingUrl: "", note: "" }), [key]: value } }));
  }

  async function saveService(order: VendorOrder, status: "in_progress" | "submitted") {
    setSaving(order.order_item_id); setError(""); setNotice("");
    const supabase = createClient();
    const { error: saveError } = await supabase.rpc("update_vendor_service_fulfillment", {
      p_order_item_id: order.order_item_id,
      p_status: status,
      p_note: serviceNotes[order.order_item_id] || null,
    });
    if (saveError) setError(saveError.message);
    else { setNotice("Service update saved for " + order.order_reference + "."); await loadOrders(); }
    setSaving(null);
  }

  async function uploadServiceFile(order: VendorOrder) {
    const file = serviceUploadFiles[order.order_item_id];
    if (!file) { setError("Choose a delivery file first."); return; }
    setSaving(order.order_item_id); setError(""); setNotice("");
    try {
      const body = new FormData();
      body.append("orderItemId", order.order_item_id);
      body.append("file", file);
      const response = await fetch("/api/vendor/service-deliverables", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "File upload failed.");
      setServiceUploadFiles(current => ({ ...current, [order.order_item_id]: null }));
      setNotice("Delivery file uploaded for " + order.order_reference + ".");
      const filesResponse = await fetch("/api/vendor/service-deliverables", { cache: "no-store" });
      if (filesResponse.ok) {
        const filesResult = await filesResponse.json();
        const grouped: Record<string, ServiceDeliverable[]> = {};
        for (const item of (filesResult.deliverables || []) as ServiceDeliverable[]) {
          grouped[item.order_item_id] = [...(grouped[item.order_item_id] || []), item];
        }
        setServiceFiles(grouped);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "File upload failed.");
    } finally {
      setSaving(null);
    }
  }

  async function saveFulfillment(order: VendorOrder) {
    const form = forms[order.order_item_id] || emptyForm(order);
    setSaving(order.order_item_id); setError(""); setNotice("");
    const supabase = createClient();
    const { error: saveError } = await supabase.rpc("update_vendor_order_fulfillment", {
      p_order_item_id: order.order_item_id,
      p_status: form.status,
      p_carrier: form.carrier || null,
      p_tracking_number: form.trackingNumber || null,
      p_tracking_url: form.trackingUrl || null,
      p_note: form.note || null,
    });
    if (saveError) setError(saveError.message);
    else { setNotice("Fulfilment details saved for " + order.order_reference + "."); await loadOrders(); }
    setSaving(null);
  }

  const visibleOrders = useMemo(() => filter === "all" ? orders : orders.filter(order =>
    filter === "paid" || filter === "pending" ? order.payment_status === filter :
    filter === "physical" ? order.product_type === "physical" :
    filter === "online_service" ? order.product_type === "online_service" :
    order.item_fulfillment_status === filter
  ), [orders, filter]);
  const paidCount = new Set(orders.filter(o => o.payment_status === "paid").map(o => o.order_reference)).size;
  const pendingCount = new Set(orders.filter(o => o.payment_status === "pending").map(o => o.order_reference)).size;
  const shippedCount = orders.filter(o => o.item_fulfillment_status === "shipped" || o.item_fulfillment_status === "delivered").length;

  if (loading) return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Loading your orders...</main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
      <div><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><p className="mt-1 text-xs text-slate-500">Vendor workspace</p></div>
      <Link href="/vendor" className="text-sm font-semibold text-teal-700 hover:underline">← Vendor Centre</Link>
    </div></header>
    <div className="mx-auto max-w-6xl px-5 py-9">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Seller workspace</p>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Order management</h1>
      <p className="mt-2 text-sm text-slate-500">{storeName} · Manage paid physical orders and online-service work in one place.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      {!error && <>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Paid orders</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{paidCount}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Awaiting payment</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{pendingCount}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Shipped or delivered items</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{shippedCount}</p></article>
        </div>
        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Your order items</h2><p className="mt-1 text-xs text-slate-500">Customer delivery details appear only for paid physical orders.</p></div>
            <select aria-label="Filter orders" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="all">All orders</option><option value="paid">Paid</option><option value="pending">Awaiting payment</option><option value="physical">Physical products</option><option value="online_service">Online services</option><option value="unfulfilled">Not started</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option>
            </select>
          </div>
          {visibleOrders.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><p className="font-semibold text-slate-800">No matching orders</p><p className="mt-2 text-sm text-slate-500">Orders for your products will appear here after checkout.</p></div> :
            visibleOrders.map(order => <article key={order.order_item_id} className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-slate-400">{new Date(order.order_created_at).toLocaleString()} · {order.order_reference}</p><h3 className="mt-1 text-lg font-bold text-slate-900">{order.product_title}</h3><p className="mt-1 text-sm text-slate-600">Qty {order.quantity} · {money(Number(order.unit_price) * order.quantity, order.currency)} · {order.product_type.replaceAll("_"," ")}</p></div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{order.payment_status} · {order.product_type === "online_service" ? order.service_status.replaceAll("_"," ") : order.item_fulfillment_status.replaceAll("_"," ")}</span>
              </div>
              {order.product_type === "physical" && order.payment_status === "paid" && <div className="mt-5 grid gap-5 border-t border-slate-100 pt-5 lg:grid-cols-2">
                <div><h4 className="text-sm font-bold text-slate-900">Delivery address</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{order.shipping_full_name}<br/>{order.shipping_phone}<br/>{order.shipping_address_line1}{order.shipping_address_line2 ? ", " + order.shipping_address_line2 : ""}<br/>{[order.shipping_city,order.shipping_region,order.shipping_postal_code,order.shipping_country].filter(Boolean).join(", ")}</p>
                </div>
                <div className="space-y-3"><h4 className="text-sm font-bold text-slate-900">Update shipment</h4>
                  <select aria-label="Fulfilment status" value={(forms[order.order_item_id] || emptyForm(order)).status} onChange={e=>updateForm(order.order_item_id,"status",e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option>
                  </select>
                  <input aria-label="Shipping carrier" placeholder="Shipping carrier (e.g. DHL)" value={(forms[order.order_item_id] || emptyForm(order)).carrier} onChange={e=>updateForm(order.order_item_id,"carrier",e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"/>
                  <input aria-label="Tracking number" placeholder="Tracking number" value={(forms[order.order_item_id] || emptyForm(order)).trackingNumber} onChange={e=>updateForm(order.order_item_id,"trackingNumber",e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"/>
                  <input aria-label="Tracking URL" type="url" placeholder="Tracking link (https://...)" value={(forms[order.order_item_id] || emptyForm(order)).trackingUrl} onChange={e=>updateForm(order.order_item_id,"trackingUrl",e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"/>
                  <textarea aria-label="Customer fulfilment note" placeholder="Optional note for the customer" value={(forms[order.order_item_id] || emptyForm(order)).note} onChange={e=>updateForm(order.order_item_id,"note",e.target.value)} rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"/>
                  <button onClick={()=>saveFulfillment(order)} disabled={saving===order.order_item_id} className="rounded-full bg-teal-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-50">{saving===order.order_item_id ? "Saving..." : "Save fulfilment update"}</button>
                </div>
              </div>}
              {order.product_type === "online_service" && <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
                <div><h4 className="text-sm font-bold text-slate-900">Online-service fulfilment</h4><p className="mt-1 text-xs text-slate-500">Paid orders only. Start the work, then submit it with a clear message describing what you delivered.</p></div>
                <p className="text-sm font-semibold capitalize text-teal-800">Status: {order.service_status.replaceAll("_"," ")}</p>
                {order.service_customer_note && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Customer revision request: {order.service_customer_note}</p>}
                {order.service_seller_note && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Your latest delivery note: {order.service_seller_note}</p>}
                {order.payment_status === "paid" && order.service_status === "in_progress" && <div className="rounded-xl border border-dashed border-teal-300 bg-teal-50/40 p-4">
                  <h5 className="text-sm font-bold text-slate-800">Attach completed work</h5>
                  <p className="mt-1 text-xs text-slate-500">Upload up to 10 files, maximum 50 MB each. Supported: PDF, Office documents, ZIP, TXT, CSV, JPG, PNG and WebP.</p>
                  <input type="file" accept=".pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp" onChange={e=>setServiceUploadFiles(current=>({...current,[order.order_item_id]:e.target.files?.[0] || null}))} className="mt-3 block w-full text-sm"/>
                  <button onClick={()=>uploadServiceFile(order)} disabled={saving===order.order_item_id || !serviceUploadFiles[order.order_item_id] || (serviceFiles[order.order_item_id] || []).length>=10} className="mt-3 rounded-full border border-teal-700 px-4 py-2 text-sm font-bold text-teal-800 disabled:opacity-50">{saving===order.order_item_id ? "Uploading..." : "Upload delivery file"}</button>
                </div>}
                {(serviceFiles[order.order_item_id] || []).length > 0 && <div className="rounded-xl bg-slate-50 p-4">
                  <h5 className="text-sm font-bold text-slate-800">Uploaded delivery files</h5>
                  <ul className="mt-2 space-y-1">{(serviceFiles[order.order_item_id] || []).map(file=><li key={file.id} className="text-xs text-slate-600">{file.file_name} · {(file.size_bytes / 1024 / 1024).toFixed(2)} MB</li>)}</ul>
                </div>}
                <textarea aria-label="Service update message" rows={3} placeholder="Describe the work completed or update the customer..." value={serviceNotes[order.order_item_id] ?? order.service_seller_note ?? ""} onChange={e=>setServiceNotes(current=>({...current,[order.order_item_id]:e.target.value}))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"/>
                {order.payment_status !== "paid" ? <p className="text-xs text-amber-700">You can begin fulfilment after payment is confirmed.</p> : order.service_status === "completed" ? <p className="text-sm font-semibold text-emerald-700">Customer marked this service as completed.</p> : order.service_status === "submitted" ? <p className="text-sm font-semibold text-sky-700">Work has been submitted. Waiting for the customer to review it.</p> : <div className="flex flex-wrap gap-2">
                  {(order.service_status === "not_started" || order.service_status === "revision_requested") && <button onClick={()=>saveService(order,"in_progress")} disabled={saving===order.order_item_id} className="rounded-full border border-teal-700 px-4 py-2 text-sm font-bold text-teal-800 disabled:opacity-50">{saving===order.order_item_id ? "Saving..." : order.service_status === "revision_requested" ? "Start requested revision" : "Start work"}</button>}
                  {order.service_status === "in_progress" && <button onClick={()=>saveService(order,"submitted")} disabled={saving===order.order_item_id || !(serviceNotes[order.order_item_id] ?? order.service_seller_note ?? "").trim()} className="rounded-full bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving===order.order_item_id ? "Saving..." : "Submit work to customer"}</button>}
                </div>}
                <p className="text-xs text-slate-500">Revision requests: {order.service_revision_count || 0} · Submitted: {order.service_submitted_at ? new Date(order.service_submitted_at).toLocaleString() : "Not yet"}</p>
              </div>}
              {order.product_type === "digital" && <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">Digital files are delivered through the customer’s secure downloads area.</p>}
            </article>)
          }
        </section>
      </>}
    </div>
  </main>;
}
