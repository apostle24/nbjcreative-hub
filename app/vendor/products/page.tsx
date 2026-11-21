"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Vendor = { id: string; store_name: string; status: string };
type Product = {
  id: string; title: string; slug: string; product_type: "physical" | "digital" | "online_service"; inventory_quantity: number | null; sku: string | null; shipping_required: boolean; shipping_note: string | null; delivery_note: string | null; summary: string | null;
  description: string | null; price: number | string; currency: string;
  status: "draft" | "published" | "archived"; cover_image_path: string | null;
  created_at: string;
};

const empty = { title: "", slug: "", product_type: "digital" as "physical" | "digital" | "online_service", inventory_quantity: "", sku: "", shipping_required: false, shipping_note: "", delivery_note: "", summary: "", description: "", price: "", currency: "GHS" };
const slugify = (s: string) => s.toLowerCase().trim().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function VendorProductsPage() {
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadProducts(vendorId: string) {
    const supabase = createClient();
    const { data, error } = await supabase.from("products")
      .select("id,title,slug,product_type,inventory_quantity,sku,shipping_required,shipping_note,delivery_note,summary,description,price,currency,status,cover_image_path,created_at")
      .eq("vendor_id", vendorId).order("created_at", { ascending: false });
    if (error) throw error;
    setProducts((data ?? []) as Product[]);
  }

  useEffect(() => {
    let active = true;
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.assign("/account?next=/vendor/products"); return; }
      const { data, error } = await supabase.from("vendor_profiles")
        .select("id,store_name,status").eq("owner_id", user.id).maybeSingle();
      if (!active) return;
      if (error) setError(error.message);
      else if (!data || data.status !== "approved") setError("An approved vendor account is required to manage products.");
      else {
        setVendor(data as Vendor);
        try { await loadProducts(data.id); }
        catch (e) { setError(e instanceof Error ? e.message : "Could not load your products."); }
      }
      if (active) setLoading(false);
    }
    init();
    return () => { active = false; };
  }, []);

  function edit(product: Product) {
    setEditing(product.id);
    setForm({ title: product.title, slug: product.slug, summary: product.summary ?? "",
      description: product.description ?? "", price: String(product.price), currency: product.currency });
    setCover(null); setFiles([]); setError(""); setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() { setEditing(null); setForm(empty); setCover(null); setFiles([]); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vendor) return;
    setBusy(true); setError(""); setNotice("");
    const supabase = createClient();
    const price = Number(form.price);
    const slug = slugify(form.slug || form.title);
    if (!slug || !Number.isFinite(price) || price < 0) {
      setError("Enter a valid product title, URL and price."); setBusy(false); return;
    }
    if (cover && (!["image/jpeg", "image/png", "image/webp"].includes(cover.type) || cover.size > 5 * 1024 * 1024)) {
      setError("Cover must be JPG, PNG or WebP and no larger than 5 MB."); setBusy(false); return;
    }
    if (files.length > 10 || files.some(f => f.size > 50 * 1024 * 1024)) {
      setError("Choose up to 10 files, each no larger than 50 MB."); setBusy(false); return;
    }
    const payload = { title: form.title.trim(), slug, summary: form.summary.trim() || null,
      description: form.description.trim() || null, price, currency: form.currency };
    let productId = editing;
    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing);
      if (error) { setError(error.message); setBusy(false); return; }
    } else {
      const { data, error } = await supabase.from("products").insert({
        ...payload, vendor_id: vendor.id, created_by: (await supabase.auth.getUser()).data.user?.id,
        status: "draft"
      }).select("id").single();
      if (error || !data) { setError(error?.message ?? "Could not create product."); setBusy(false); return; }
      productId = data.id;
    }
    if (!productId) { setError("Product could not be saved."); setBusy(false); return; }

    if (cover) {
      const path = productId + "/" + crypto.randomUUID() + "-" + cover.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const { error: uploadError } = await supabase.storage.from("product-covers")
        .upload(path, cover, { contentType: cover.type, upsert: false });
      if (uploadError) { setError("Product saved, but cover upload failed: " + uploadError.message); setBusy(false); return; }
      const { error: updateError } = await supabase.from("products")
        .update({ cover_image_path: path }).eq("id", productId);
      if (updateError) { setError("Cover uploaded but could not be attached: " + updateError.message); setBusy(false); return; }
    }
    for (const file of files) {
      const path = productId + "/" + crypto.randomUUID() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const { error: uploadError } = await supabase.storage.from("product-downloads")
        .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (uploadError) { setError("Product saved, but file upload failed: " + uploadError.message); setBusy(false); return; }
      const { error: rowError } = await supabase.from("product_files").insert({
        product_id: productId, storage_path: path, file_name: file.name,
        content_type: file.type || null, size_bytes: file.size
      });
      if (rowError) { setError("File uploaded, but its record could not be saved: " + rowError.message); setBusy(false); return; }
    }
    const { error: publishError } = await supabase.from("products")
      .update({ status: "published" }).eq("id", productId).eq("vendor_id", vendor.id);
    if (publishError) { setError("Your product and files were saved, but publication failed. You can publish it from your listings: " + publishError.message); setBusy(false); await loadProducts(vendor.id); return; }
    reset();
    setNotice("Your product is now published on the NBJCreative Hub marketplace.");
    try { await loadProducts(vendor.id); } catch (e) { setError(e instanceof Error ? e.message : "Refresh failed."); }
    setBusy(false);
  }

  async function remove(product: Product) {
    if (!vendor || !window.confirm("Delete the draft listing " + product.title + "?")) return;
    setBusy(true); setError(""); setNotice("");
    const supabase = createClient();
    const { data: rows, error: rowsError } = await supabase.from("product_files")
      .select("id,storage_path").eq("product_id", product.id);
    if (rowsError) { setError(rowsError.message); setBusy(false); return; }
    const paths = (rows ?? []).map(row => row.storage_path);
    if (paths.length) {
      const { error } = await supabase.storage.from("product-downloads").remove(paths);
      if (error) { setError(error.message); setBusy(false); return; }
    }
    if (product.cover_image_path) {
      const { error } = await supabase.storage.from("product-covers").remove([product.cover_image_path]);
      if (error) { setError(error.message); setBusy(false); return; }
    }
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) setError(error.message);
    else { setNotice("Draft listing deleted."); await loadProducts(vendor.id); }
    setBusy(false);
  }

  if (loading) return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Loading seller workspace...</main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
      <div><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><p className="mt-1 text-xs text-slate-500">Vendor workspace</p></div>
      <Link href="/vendor" className="text-sm font-semibold text-teal-700 hover:underline">← Vendor Centre</Link>
    </div></header>
    <div className="mx-auto max-w-6xl px-5 py-9">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Seller workspace</p>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Manage your products</h1>
      {vendor && <p className="mt-2 text-sm text-slate-500">Store: {vendor.store_name}</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {vendor && <><section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">{editing ? "Edit draft listing" : "Add a product"}</h2><p className="mt-1 text-xs text-slate-500">Complete your product details and upload all files. Your listing goes live when you click Publish.</p></div>
          {editing && <button onClick={reset} className="text-xs font-bold text-slate-500">Cancel editing</button>}</div>
        <form onSubmit={save} className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Product title *<input required maxLength={160} value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value,slug:editing?v.slug:slugify(e.target.value)}))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal"/></label>
          <label className="text-sm font-semibold text-slate-700">What are you selling? *<select value={form.product_type} onChange={e=>setForm(v=>({...v,product_type:e.target.value as typeof v.product_type}))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal"><option value="physical">Physical product — shipped to customer</option><option value="digital">Digital product — customer downloads files</option><option value="online_service">Online service — delivered online</option></select></label>\n          <label className="text-sm font-semibold text-slate-700">URL slug *<input required value={form.slug} onChange={e=>setForm(v=>({...v,slug:slugify(e.target.value)}))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal"/></label>
          <div className="grid grid-cols-[1fr_110px] gap-3"><label className="text-sm font-semibold text-slate-700">Price *<input required type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm(v=>({...v,price:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal"/></label>
            <label className="text-sm font-semibold text-slate-700">Currency<select value={form.currency} onChange={e=>setForm(v=>({...v,currency:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-2 py-3 text-sm font-normal"><option>GHS</option><option>USD</option><option>GBP</option><option>EUR</option></select></label></div>
          <label className="text-sm font-semibold text-slate-700">Short summary<input maxLength={220} value={form.summary} onChange={e=>setForm(v=>({...v,summary:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal"/></label>
          {form.product_type === "physical" && <><label className="text-sm font-semibold text-slate-700">Available stock quantity *<input required type="number" min="0" step="1" value={form.inventory_quantity} onChange={e=>setForm(v=>({...v,inventory_quantity:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal"/></label><label className="text-sm font-semibold text-slate-700">SKU (optional)<input value={form.sku} onChange={e=>setForm(v=>({...v,sku:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal"/></label><label className="text-sm font-semibold text-slate-700 md:col-span-2">Shipping information<textarea rows={2} value={form.shipping_note} onChange={e=>setForm(v=>({...v,shipping_note:e.target.value}))} placeholder="Shipping regions, estimated dispatch and delivery times, or collection details" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal"/></label></>}
          {form.product_type === "online_service" && <label className="text-sm font-semibold text-slate-700 md:col-span-2">How will you deliver this service? *<textarea required rows={3} value={form.delivery_note} onChange={e=>setForm(v=>({...v,delivery_note:e.target.value}))} placeholder="Explain what the customer receives and how you will deliver it online." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal"/></label>}
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">Full description<textarea rows={4} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal"/></label>
          <label className="text-sm font-semibold text-slate-700">Cover image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setCover(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-xs font-normal"/><span className="mt-1 block text-xs font-normal text-slate-400">JPG, PNG or WebP · up to 5 MB</span></label>
          <label className="text-sm font-semibold text-slate-700">Downloadable files (digital products)<input type="file" multiple accept=".pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt" onChange={e=>setFiles(Array.from(e.target.files ?? []))} className="mt-2 block w-full text-xs font-normal"/><span className="mt-1 block text-xs font-normal text-slate-400">Up to 10 files · 50 MB each</span></label>
          {notice && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800 md:col-span-2">{notice}</p>}
          <div className="md:col-span-2"><button disabled={busy} className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Publishing..." : editing ? "Save & publish changes" : "Publish to Marketplace"}</button></div>
        </form>
      </section>
      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-5"><h2 className="text-lg font-bold text-slate-900">Your listings ({products.length})</h2></div>
        {products.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">You haven't added any products yet.</p> : <div className="divide-y divide-slate-100">{products.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div><p className="font-semibold text-slate-900">{p.title}</p><p className="mt-1 text-xs text-slate-500">{p.currency} {Number(p.price).toFixed(2)} · {p.product_type === "physical" ? "Physical" : p.product_type === "online_service" ? "Online service" : "Digital"} · <span className="capitalize">{p.status}</span></p></div>
          <div className="flex gap-4"><><button onClick={()=>edit(p)} className="text-xs font-bold text-teal-700">Edit</button>{p.status === "draft" && <><button disabled={busy} onClick={async()=>{setBusy(true);setError("");const {error}=await createClient().from("products").update({status:"published"}).eq("id",p.id).eq("vendor_id",vendor.id);if(error)setError("Could not publish this listing: "+error.message);else setNotice("Your product is now published on the marketplace.");await loadProducts(vendor.id);setBusy(false);}} className="text-xs font-bold text-emerald-700">Publish now</button><button disabled={busy} onClick={()=>remove(p)} className="text-xs font-bold text-rose-600">Delete</button></>}</></div>
        </div>)}</div>}
      </section></>}
      <p className="mt-6 text-xs leading-5 text-slate-400">Published listings appear in the public marketplace automatically. NBJ may remove or suspend listings that violate marketplace rules. Payout setup is managed separately.</p>
    </div>
  </main>;
}
