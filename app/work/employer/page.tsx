"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Employer = {
  id: string;
  company_name: string;
  company_slug: string;
  description: string | null;
  website_url: string | null;
};

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function WorkEmployerPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
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
        window.location.assign("/account?next=/work/employer");
        return;
      }
      const { data, error: loadError } = await supabase
        .from("work_employer_profiles")
        .select("id,company_name,company_slug,description,website_url")
        .eq("owner_id", user.id).maybeSingle();
      if (!active) return;
      if (loadError) setError("We couldn't load your employer profile. Please refresh and try again.");
      if (data) {
        const record = data as Employer;
        setEmployer(record);
        setCompanyName(record.company_name);
        setDescription(record.description ?? "");
        setWebsiteUrl(record.website_url ?? "");
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.assign("/account?next=/work/employer");
      return;
    }
    const slug = slugify(companyName);
    if (slug.length < 2) {
      setError("Enter a company name with at least two letters or numbers.");
      setBusy(false);
      return;
    }
    const website = websiteUrl.trim() || null;
    if (website && !/^https?:\/\//i.test(website)) {
      setError("Website address must begin with https:// or http://.");
      setBusy(false);
      return;
    }
    const payload = {
      owner_id: user.id,
      company_name: companyName.trim(),
      company_slug: slug,
      description: description.trim() || null,
      website_url: website
    };
    const result = employer
      ? await supabase.from("work_employer_profiles").update(payload).eq("id", employer.id)
        .select("id,company_name,company_slug,description,website_url").single()
      : await supabase.from("work_employer_profiles").insert(payload)
        .select("id,company_name,company_slug,description,website_url").single();

    if (result.error) {
      setError(result.error.code === "23505"
        ? "That company name or page address is already in use. Please choose a different company name."
        : "We couldn't save your company profile. Please check the details and try again.");
    } else {
      setEmployer(result.data as Employer);
      setNotice("Your employer profile has been saved successfully.");
    }
    setBusy(false);
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading employer workspace...</main>;

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10">
    <div className="mx-auto max-w-3xl">
      <Link href="/work" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 md:p-10">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Work · Employer workspace</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">Create your employer profile</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Introduce your company or organisation to people exploring opportunities on NBJ Work. You can update these details later.</p>
        {employer && <div className="mt-6 rounded-xl bg-teal-50 p-4 text-sm text-teal-900">
          <p className="font-bold">Employer profile saved</p>
          <p className="mt-1">Your company page address: /work/company/{employer.company_slug}</p>
        </div>}
        <form onSubmit={save} className="mt-7 space-y-5">
          <label className="block text-sm font-semibold text-slate-700">Company or organisation name *
            <input required minLength={2} maxLength={120} value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="e.g. NBJ Creative Solutions" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/>
          </label>
          <label className="block text-sm font-semibold text-slate-700">About your organisation
            <textarea rows={5} maxLength={3000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe your organisation, its work and the opportunities you offer." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Website (optional)
            <input type="url" value={websiteUrl} onChange={e=>setWebsiteUrl(e.target.value)} placeholder="https://example.com" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/>
          </label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {notice && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{notice}</p>}
          <button disabled={busy} className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">{busy ? "Saving..." : employer ? "Update employer profile" : "Save employer profile"}</button>
        </form>
        <div className="mt-8 border-t border-slate-100 pt-5">
          <Link href="/work" className="text-sm font-semibold text-teal-700 hover:underline">← Return to NBJ Work opportunities</Link>
        </div>
      </div>
    </div>
  </main>;
}
