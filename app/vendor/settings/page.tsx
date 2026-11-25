"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Vendor = {
  store_name: string;
  store_slug: string;
  description: string | null;
  contact_email: string;
  website_url: string | null;
  status: string;
};

export default function VendorSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      if (!user) { window.location.assign("/account?next=/vendor/settings"); return; }
      const { data, error: loadError } = await supabase.from("vendor_profiles")
        .select("store_name,store_slug,description,contact_email,website_url,status")
        .eq("owner_id", user.id).maybeSingle();
      if (!active) return;
      if (loadError) setError("We couldn't load your store settings. Please refresh.");
      else if (!data || data.status !== "approved") setError("An approved vendor account is required to manage store settings.");
      else {
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    const response = await fetch("/api/vendor/store-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ storeName, description, contactEmail, websiteUrl })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      setError(result.error || "Your store settings could not be saved. Please try again.");
    } else {
      const savedVendor = result.vendor as Vendor;
      setVendor(savedVendor);
      setStoreName(savedVendor.store_name);
      setNotice("Your store settings have been saved.");
    }
    setSaving(false);
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading store settings...</main>;

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10">
    <div className="mx-auto max-w-3xl">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
        <Link href="/vendor" className="text-sm font-semibold text-teal-700 hover:underline">← Vendor Centre</Link>
      </header>
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Seller workspace</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Store settings</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Update your public store name and information. Your store web address stays unchanged to protect existing links.</p>
        {vendor ? <>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Store identity</p>
            <p className="mt-1 font-bold text-slate-900">{vendor.store_name}</p>
            <Link href={"/stores/" + vendor.store_slug} className="mt-1 inline-block text-sm text-teal-700 hover:underline">View public store →</Link>
          </div>
          <form onSubmit={save} className="mt-7 grid gap-5">
            <label className="block text-sm font-semibold text-slate-700">Store name
              <input required type="text" minLength={2} maxLength={80} value={storeName} onChange={e=>setStoreName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-teal-600" placeholder="Enter your public store name"/>
              <span className="mt-1 block text-xs font-normal text-slate-400">2–80 characters. Your public store URL will not change.</span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Store description
              <textarea rows={5} maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-teal-600" placeholder="Tell customers what your store offers."/>
              <span className="mt-1 block text-xs font-normal text-slate-400">{description.length}/1000 characters</span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Store contact email
              <input required type="email" maxLength={254} value={contactEmail} onChange={e=>setContactEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-teal-600"/>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Website address (optional)
              <input type="url" maxLength={500} value={websiteUrl} onChange={e=>setWebsiteUrl(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-teal-600" placeholder="https://example.com"/>
            </label>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            {notice && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{notice}</p>}
            <button disabled={saving} className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">{saving ? "Saving..." : "Save store settings"}</button>
          </form>
        </> : <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{error || "Your store settings are not available yet."}</div>}
      </section>
    </div>
  </main>;
}
