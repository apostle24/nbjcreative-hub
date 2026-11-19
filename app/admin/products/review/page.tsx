"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  price: number | string;
  currency: string;
  status: "draft" | "published" | "archived";
  cover_image_path: string | null;
  created_at: string;
  vendor: { store_name: string; store_slug: string } | null;
};

export default function AdminProductReviewPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState("draft");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from("products")
      .select("id,title,slug,summary,description,price,currency,status,cover_image_path,created_at,vendor:vendor_profiles(store_name,store_slug)")
      .not("vendor_id", "is", null)
      .order("created_at", { ascending: false });
    if (queryError) throw queryError;
    setProducts((data ?? []) as unknown as Product[]);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.assign("/admin/login"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!active) return;
      if (profileError || profile?.role !== "admin") {
        setError("This account does not have administrator access.");
        setLoading(false);
        return;
      }
      setAuthorized(true);
      try { await load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not load vendor products."); }
      if (active) setLoading(false);
    }
    init();
    return () => { active = false; };
  }, [load]);

  async function moderate(product: Product, status: "published" | "archived" | "draft") {
    setBusyId(product.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/products/moderate", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, status })
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true || result.product?.status !== status) {
        throw new Error(result.error || "The server did not confirm the decision.");
      }
      setProducts(current => current.map(item => item.id === product.id ? { ...item, status } : item));
      setFilter(status);
      setNotice(product.title + " is now " + status + ".");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The moderation decision failed.");
    } finally {
      setBusyId("");
    }
  }

  const visible = useMemo(() => filter === "all" ? products : products.filter(p => p.status === filter), [products, filter]);
  const coverUrl = (path: string | null) => path ? createClient().storage.from("product-covers").getPublicUrl(path).data.publicUrl : null;
  const formatPrice = (price: number | string, currency: string) => {
    try { return new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(price)); }
    catch { return currency + " " + Number(price).toFixed(2); }
  };

  if (loading) return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Checking administrator access...</main>;
  if (!authorized) return <main className="min-h-screen grid place-items-center p-6"><div className="max-w-md rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-2xl font-bold text-slate-900">Administrator access required</h1><p className="mt-3 text-sm text-slate-600">{error}</p><Link href="/admin/login" className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">Admin login</Link></div></main>;

  return (
    <main className="min-h-screen bg-[#F5F7F8]">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><div><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><p className="mt-1 text-xs text-slate-500">Product moderation</p></div><Link href="/admin" className="text-sm font-semibold text-teal-700 hover:underline">← Product administration</Link></div></header>
      <div className="mx-auto max-w-6xl px-5 py-9">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Marketplace control</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Vendor product review</h1>
        <p className="mt-2 text-sm text-slate-500">Review seller submissions before they appear in the public marketplace.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {(["draft","published","archived"] as const).map(status => <div key={status} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs capitalize text-slate-500">{status === "draft" ? "Awaiting review" : status}</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{products.filter(p => p.status === status).length}</p></div>)}
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{["draft","published","archived","all"].map(value => <button key={value} onClick={() => setFilter(value)} className={"rounded-full px-4 py-2 text-xs font-bold capitalize " + (filter === value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600")}>{value === "draft" ? "Awaiting review" : value}</button>)}</div><button onClick={() => { setError(""); load().catch(e => setError(e.message)); }} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Refresh</button></div>
        {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
        <section className="mt-5 space-y-4">
          {visible.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><p className="font-semibold text-slate-800">No {filter === "all" ? "" : filter + " "}vendor products</p><p className="mt-2 text-sm text-slate-500">New seller listings will appear here when submitted.</p></div> : visible.map(product => {
            const cover = coverUrl(product.cover_image_path);
            return <article key={product.id} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 gap-4">
                  {cover ? <img src={cover} alt="" className="h-24 w-24 rounded-xl object-cover"/> : <div className="grid h-24 w-24 place-items-center rounded-xl bg-[#E5F1EF] text-3xl text-teal-800">▤</div>}
                  <div className="min-w-0"><h2 className="text-lg font-bold text-slate-900">{product.title}</h2><p className="mt-1 text-xs text-slate-500">/{product.slug} · {formatPrice(product.price, product.currency)}</p><p className="mt-1 text-xs text-teal-700">Seller: {product.vendor?.store_name || "Unknown store"} {product.vendor?.store_slug ? "· /stores/" + product.vendor.store_slug : ""}</p><p className="mt-1 text-xs text-slate-400">Submitted {new Date(product.created_at).toLocaleString()}</p></div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-700">{product.status === "draft" ? "Awaiting review" : product.status}</span>
              </div>
              {product.summary && <p className="mt-5 text-sm font-semibold text-slate-700">{product.summary}</p>}
              {product.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{product.description}</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                {product.status !== "published" && <button disabled={!!busyId} onClick={() => moderate(product, "published")} className="rounded-lg bg-teal-700 px-5 py-3 text-xs font-extrabold text-white hover:bg-teal-800 disabled:opacity-50">{busyId === product.id ? "Saving..." : "Approve & publish"}</button>}
                {product.status !== "archived" && <button disabled={!!busyId} onClick={() => moderate(product, "archived")} className="rounded-lg border border-rose-200 px-4 py-3 text-xs font-bold text-rose-700 disabled:opacity-50">Reject / archive</button>}
                {product.status !== "draft" && <button disabled={!!busyId} onClick={() => moderate(product, "draft")} className="rounded-lg border border-slate-300 px-4 py-3 text-xs font-bold text-slate-700 disabled:opacity-50">Return to review</button>}
              </div>
            </article>;
          })}
        </section>
      </div>
    </main>
  );
}
