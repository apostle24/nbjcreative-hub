"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Vendor = {
  id: string;
  store_name: string;
  store_slug: string;
  description: string | null;
  contact_email: string;
  website_url: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  review_note: string | null;
  created_at: string;
};

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function VendorCentrePage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState("");
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        window.location.assign("/account?next=/vendor");
        return;
      }
      setUserId(user.id);
      setContactEmail(user.email ?? "");
      const { data, error: loadError } = await supabase
        .from("vendor_profiles")
        .select("id,store_name,store_slug,description,contact_email,website_url,status,review_note,created_at")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (loadError) setError("We couldn't load Vendor Centre. Please refresh and try again.");
      if (data) {
        const record = data as Vendor;
        setVendor(record);
        setStoreName(record.store_name);
        setDescription(record.description ?? "");
        setContactEmail(record.contact_email);
        setWebsiteUrl(record.website_url ?? "");
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const supabase = createClient();
    const payload = {
      owner_id: userId,
      store_name: storeName.trim(),
      store_slug: slugify(storeName),
      description: description.trim() || null,
      contact_email: contactEmail.trim(),
      website_url: websiteUrl.trim() || null
    };
    if (payload.store_slug.length < 2) {
      setError("Enter a store name with at least two letters or numbers.");
      setBusy(false);
      return;
    }
    if (payload.website_url && !/^https?:\/\//i.test(payload.website_url)) {
      setError("Website address must begin with https:// or http://.");
      setBusy(false);
      return;
    }
    const result = vendor
      ? await supabase.from("vendor_profiles").update(payload).eq("id", vendor.id).select("id,store_name,store_slug,description,contact_email,website_url,status,review_note,created_at").single()
      : await supabase.from("vendor_profiles").insert(payload).select("id,store_name,store_slug,description,contact_email,website_url,status,review_note,created_at").single();
    if (result.error) {
      setError(result.error.code === "23505"
        ? "That store name is already in use. Please choose another."
        : "We couldn't save your application. Please check your details and try again.");
    } else {
      setVendor(result.data as Vendor);
      setNotice(vendor ? "Your pending application has been updated." : "Your vendor application has been submitted.");
    }
    setBusy(false);
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-mist text-sm text-slate-500">Loading Vendor Centre...</main>;

  const statusStyles = vendor?.status === "approved"
    ? "bg-teal-50 text-teal-800"
    : vendor?.status === "rejected" || vendor?.status === "suspended"
      ? "bg-rose-50 text-rose-700"
      : "bg-amber-50 text-amber-800";

  return <main className="min-h-screen bg-mist px-5 py-12">
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="text-xl font-extrabold tracking-tight text-ink">NBJCreative <span className="text-teal">Hub</span></Link>
      <section className="mt-8 rounded-3xl border border-slate-100 bg-white p-7 shadow-soft md:p-9">
        <p className="eyebrow">Seller services</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">NBJ Vendor Centre</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Apply to open a store on NBJCreative Hub. Once approved, you will be able to prepare product listings for review and publication.</p>

        {vendor ? <div className="mt-7 rounded-2xl border border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Application status</p><h2 className="mt-1 text-lg font-bold text-ink">{vendor.store_name}</h2></div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${statusStyles}`}>{vendor.status}</span>
          </div>
          {vendor.status === "pending" && <p className="mt-3 text-sm leading-6 text-slate-600">Your application is waiting for administrator review. You can update your details below while it is pending.</p>}
          {vendor.status === "approved" && <p className="mt-3 text-sm leading-6 text-slate-600">Your seller account is approved. Product listing tools will be available in the next Vendor Centre release.</p>}
          {vendor.review_note && <p className="mt-3 rounded-xl bg-mist p-3 text-sm text-slate-600">Review note: {vendor.review_note}</p>}
          <p className="mt-3 text-xs text-slate-400">Store address: /stores/{vendor.store_slug}</p>
        </div> : null}

        {(!vendor || vendor.status === "pending") && <form onSubmit={submit} className="mt-7 grid gap-5 md:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">Store name *<input required minLength={2} maxLength={80} value={storeName} onChange={e=>setStoreName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal" placeholder="e.g. Joshua Digital Store"/></label>
          <label className="block text-sm font-semibold text-slate-700">Contact email *<input required type="email" value={contactEmail} onChange={e=>setContactEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal" placeholder="store@example.com"/></label>
          <label className="block text-sm font-semibold text-slate-700 md:col-span-2">About your store<textarea rows={4} maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal" placeholder="Tell customers what you plan to sell."/></label>
          <label className="block text-sm font-semibold text-slate-700 md:col-span-2">Website (optional)<input type="url" value={websiteUrl} onChange={e=>setWebsiteUrl(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal" placeholder="https://example.com"/></label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 md:col-span-2">{error}</p>}
          {notice && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800 md:col-span-2">{notice}</p>}
          <button disabled={busy} className="rounded-xl bg-ink px-6 py-3.5 text-sm font-bold text-white hover:bg-teal disabled:opacity-60 md:col-span-2">{busy ? "Saving..." : vendor ? "Update application" : "Submit vendor application"}</button>
        </form>}
        <div className="mt-7 border-t border-slate-100 pt-5 text-xs text-slate-500"><p>Seller approval is required before products can be listed. Payment and payout details are not collected in this application.</p><Link href="/account" className="mt-3 inline-block font-semibold text-teal hover:underline">Go to my account</Link></div>
      </section>
    </div>
  </main>;
}
