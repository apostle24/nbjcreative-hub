"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Vendor = {
  id: string;
  owner_id: string;
  store_name: string;
  store_slug: string;
  description: string | null;
  contact_email: string;
  website_url: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export default function AdminVendorsPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadVendors = useCallback(async () => {
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from("vendor_profiles")
      .select("id,owner_id,store_name,store_slug,description,contact_email,website_url,status,review_note,created_at,reviewed_at")
      .order("created_at", { ascending: false });
    if (queryError) throw queryError;
    setVendors((data ?? []) as Vendor[]);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.assign("/admin/login"); return; }
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!active) return;
      if (profileError || profile?.role !== "admin") {
        setError("This account does not have administrator access.");
        setLoading(false);
        return;
      }
      setAuthorized(true);
      try { await loadVendors(); }
      catch (e) { setError(e instanceof Error ? e.message : "Could not load vendor applications."); }
      if (active) setLoading(false);
    }
    init();
    return () => { active = false; };
  }, [loadVendors]);

  async function review(vendor: Vendor, status: Vendor["status"]) {
    setBusyId(vendor.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/vendors/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: vendor.id,
          status,
          reviewNote: notes[vendor.id]?.trim() || ""
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "The server could not save this decision.");
      }
      const updated = result.vendor as Pick<Vendor, "id" | "status" | "review_note" | "reviewed_at">;
      if (!updated || updated.id !== vendor.id || updated.status !== status) {
        throw new Error("The server did not confirm the requested status change.");
      }

      setVendors(current => current.map(item =>
        item.id === vendor.id
          ? { ...item, status: updated.status, review_note: updated.review_note, reviewed_at: updated.reviewed_at }
          : item
      ));
      setFilter(status);
      setNotice(vendor.store_name + " is now " + status + ".");
      try {
        await loadVendors();
      } catch (refreshError) {
        setError("The status was saved, but the list could not refresh. Please use Refresh. " +
          (refreshError instanceof Error ? refreshError.message : ""));
      }
    } catch (e) {
      setError("The application status was not changed: " +
        (e instanceof Error ? e.message : "Please try again."));
    } finally {
      setBusyId("");
    }
  }

  const visible = filter === "all" ? vendors : vendors.filter(v => v.status === filter);

  if (loading) return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Checking administrator access...</main>;
  if (!authorized) return <main className="min-h-screen grid place-items-center p-6"><div className="max-w-md rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-2xl font-bold text-slate-900">Administrator access required</h1><p className="mt-3 text-sm text-slate-600">{error}</p><Link href="/admin/login" className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">Admin login</Link></div></main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><div><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><p className="mt-1 text-xs text-slate-500">Vendor administration</p></div><Link href="/admin" className="text-sm font-semibold text-teal-700 hover:underline">← Product administration</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-9">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Control centre</p>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Vendor applications</h1>
      <p className="mt-2 text-sm text-slate-500">Review seller applications and control access to Vendor Centre. Only administrators can change these decisions.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {(["pending","approved","rejected","suspended"] as const).map(status => <div key={status} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs capitalize text-slate-500">{status}</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{vendors.filter(v=>v.status===status).length}</p></div>)}
      </div>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{["pending","approved","rejected","suspended","all"].map(value=><button key={value} onClick={()=>setFilter(value)} className={`rounded-full px-4 py-2 text-xs font-bold capitalize ${filter===value?"bg-slate-900 text-white":"border border-slate-200 bg-white text-slate-600"}`}>{value}</button>)}</div><button onClick={()=>{setError("");loadVendors().catch(e=>setError(e.message));}} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Refresh</button></div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      <section className="mt-5 space-y-4">
        {visible.length===0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><p className="font-semibold text-slate-800">No {filter==="all"?"":filter+" "}applications found</p><p className="mt-2 text-sm text-slate-500">New vendor applications will appear here.</p></div> : visible.map(vendor=><article key={vendor.id} className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">{vendor.store_name}</h2><p className="mt-1 text-xs text-slate-500">Submitted {new Date(vendor.created_at).toLocaleString()}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-700">{vendor.status}</span></div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p><span className="font-semibold text-slate-700">Contact:</span> {vendor.contact_email}</p><p><span className="font-semibold text-slate-700">Store URL:</span> /stores/{vendor.store_slug}</p>{vendor.website_url && <p className="sm:col-span-2"><span className="font-semibold text-slate-700">Website:</span> <a className="text-teal-700 underline" href={vendor.website_url} target="_blank" rel="noreferrer">{vendor.website_url}</a></p>}<p className="sm:col-span-2 whitespace-pre-wrap text-slate-600">{vendor.description || "No store description provided."}</p><p className="sm:col-span-2 break-all text-xs text-slate-400">Account ID: {vendor.owner_id}</p></div>
          {vendor.review_note && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Previous review note: {vendor.review_note}</p>}
          <label className="mt-5 block text-xs font-semibold text-slate-600">Review note (optional)<textarea rows={2} value={notes[vendor.id] ?? vendor.review_note ?? ""} onChange={e=>setNotes(current=>({...current,[vendor.id]:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" placeholder="Explain your decision or give the applicant feedback."/></label>
          <div className="mt-4 flex flex-wrap gap-2">
            {vendor.status!=="approved" && <button disabled={!!busyId} onClick={()=>review(vendor,"approved")} className="rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busyId===vendor.id?"Saving...":"Approve vendor"}</button>}
            {vendor.status!=="rejected" && <button disabled={!!busyId} onClick={()=>review(vendor,"rejected")} className="rounded-lg border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-700 disabled:opacity-50">Reject</button>}
            {vendor.status!=="suspended" && <button disabled={!!busyId} onClick={()=>review(vendor,"suspended")} className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50">Suspend</button>}
            {vendor.status!=="pending" && <button disabled={!!busyId} onClick={()=>review(vendor,"pending")} className="rounded-lg border border-amber-200 px-4 py-2.5 text-xs font-bold text-amber-800 disabled:opacity-50">Return to pending</button>}
          </div>
        </article>)}
      </section>
    </div>
  </main>;
}
