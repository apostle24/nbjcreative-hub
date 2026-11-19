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
type Verification = {
  status: "pending" | "verified" | "rejected" | "suspended";
  registration_country: string;
  organisation_type: string;
  review_note: string | null;
  submitted_at: string;
};

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const organisationTypes = [
  ["company", "Registered company"],
  ["nonprofit", "Non-profit / charity"],
  ["government", "Government organisation"],
  ["educational", "Educational institution"],
  ["sole_trader", "Sole trader / individual business"],
  ["other", "Other organisation"]
];

export default function WorkEmployerPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [organisationType, setOrganisationType] = useState("company");
  const [registrationCountry, setRegistrationCountry] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [applicantNote, setApplicantNote] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadVerification(employerId: string) {
    const supabase = createClient();
    const { data } = await supabase.from("work_employer_verifications")
      .select("status,registration_country,organisation_type,review_note,submitted_at")
      .eq("employer_id", employerId).maybeSingle();
    if (data) {
      const record = data as Verification;
      setVerification(record);
      setRegistrationCountry(record.registration_country);
      setOrganisationType(record.organisation_type);
    }
  }

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
        const { data: verificationData } = await supabase.from("work_employer_verifications")
          .select("status,registration_country,organisation_type,review_note,submitted_at")
          .eq("employer_id", record.id).maybeSingle();
        if (verificationData && active) {
          const v = verificationData as Verification;
          setVerification(v);
          setRegistrationCountry(v.registration_country);
          setOrganisationType(v.organisation_type);
        }
      }
      if (active) setLoading(false);
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

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employer) return;
    if (!evidenceFile) {
      setError("Please attach your organisation registration document or other official proof.");
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(evidenceFile.type) || evidenceFile.size > 10 * 1024 * 1024) {
      setError("Evidence must be a PDF, JPG or PNG file no larger than 10 MB.");
      return;
    }
    if (verification?.status === "pending" || verification?.status === "verified" || verification?.status === "suspended") return;

    setBusy(true); setError(""); setNotice("");
    const supabase = createClient();
    const safeName = evidenceFile.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-150);
    const path = employer.id + "/" + crypto.randomUUID() + "-" + safeName;
    const { error: uploadError } = await supabase.storage.from("work-employer-verification")
      .upload(path, evidenceFile, { upsert: false, contentType: evidenceFile.type });
    if (uploadError) {
      setError("We couldn't upload your document. Please try again.");
      setBusy(false);
      return;
    }

    const response = await fetch("/api/work/employer/verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employerId: employer.id,
        organisationType,
        registrationCountry,
        registrationNumber,
        applicantNote,
        evidenceStoragePath: path,
        evidenceFileName: evidenceFile.name
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      setError(result.error || "Your verification request could not be submitted.");
      setBusy(false);
      return;
    }
    setVerification({
      status: "pending",
      registration_country: registrationCountry,
      organisation_type: organisationType,
      review_note: null,
      submitted_at: result.verification.submitted_at
    });
    setEvidenceFile(null);
    setRegistrationNumber("");
    setApplicantNote("");
    setNotice("Your verification request has been submitted. Our team will review it.");
    setBusy(false);
  }

  const locked = verification?.status === "pending" || verification?.status === "verified" || verification?.status === "suspended";
  const statusStyle = verification?.status === "verified" ? "bg-emerald-50 text-emerald-800"
    : verification?.status === "rejected" ? "bg-rose-50 text-rose-800"
    : verification?.status === "suspended" ? "bg-slate-100 text-slate-700"
    : "bg-amber-50 text-amber-800";

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
          <p className="mt-1">Your public company page is ready to view.</p>
          <Link href={"/work/company/" + employer.company_slug} className="mt-3 inline-flex font-bold underline">View public company profile →</Link>
        </div>}
        <form onSubmit={save} className="mt-7 space-y-5">
          <label className="block text-sm font-semibold text-slate-700">Company or organisation name *
            <input required minLength={2} maxLength={120} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. NBJ Creative Solutions" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/>
          </label>
          <label className="block text-sm font-semibold text-slate-700">About your organisation
            <textarea rows={5} maxLength={3000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your organisation, its work and the opportunities you offer." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Website (optional)
            <input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://example.com" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-700"/>
          </label>
          <button disabled={busy} className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">{busy ? "Saving..." : employer ? "Update employer profile" : "Save employer profile"}</button>
        </form>

        {employer && <section className="mt-10 border-t border-slate-100 pt-8">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Organisation trust</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Employer verification</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Submit official organisation evidence so NBJ can review your organisation. Verification is reviewed by our team and is not a guarantee of any particular job or opportunity.</p>
          {verification && <div className={"mt-5 rounded-xl p-4 " + statusStyle}>
            <p className="font-bold">Verification status: {verification.status.charAt(0).toUpperCase() + verification.status.slice(1)}</p>
            <p className="mt-1 text-sm">Submitted {new Date(verification.submitted_at).toLocaleDateString()}</p>
            {verification.review_note && <p className="mt-2 text-sm">Review note: {verification.review_note}</p>}
          </div>}
          {verification?.status === "verified" ? <p className="mt-5 rounded-xl border border-emerald-200 p-4 text-sm text-emerald-800">Your organisation has been verified by NBJ.</p>
          : verification?.status === "suspended" ? <p className="mt-5 rounded-xl border border-slate-200 p-4 text-sm text-slate-600">Verification is currently suspended. Please contact NBJ support for assistance.</p>
          : verification?.status === "pending" ? <p className="mt-5 rounded-xl border border-amber-200 p-4 text-sm text-amber-800">Your documents are awaiting review. You do not need to submit them again.</p>
          : <form onSubmit={submitVerification} className="mt-6 space-y-5">
            <label className="block text-sm font-semibold text-slate-700">Organisation type *
              <select required value={organisationType} onChange={e => setOrganisationType(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">
                {organisationTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Country of registration *
              <input required minLength={2} maxLength={100} value={registrationCountry} onChange={e => setRegistrationCountry(e.target.value)} placeholder="e.g. Ghana" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Registration number (if applicable)
              <input maxLength={120} value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} placeholder="Organisation registration number" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Official evidence document *
              <input required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e => setEvidenceFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"/>
              <span className="mt-2 block text-xs font-normal text-slate-500">PDF, JPG or PNG · maximum 10 MB. Your document is private and only accessible to you and authorised NBJ reviewers.</span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Additional information (optional)
              <textarea rows={3} maxLength={2000} value={applicantNote} onChange={e => setApplicantNote(e.target.value)} placeholder="Add context that may help our review." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
            </label>
            {verification?.status === "rejected" && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Your previous request was not approved. You may submit updated information and evidence.</p>}
            <div className="sticky bottom-3 z-20 rounded-2xl border border-teal-200 bg-white/95 p-3 shadow-xl backdrop-blur-sm"><button type="submit" disabled={busy} className="!flex !min-h-14 !w-full !items-center !justify-center rounded-xl !bg-teal-700 px-6 py-4 text-base font-extrabold !text-white shadow-md hover:!bg-teal-800 disabled:!cursor-not-allowed disabled:!opacity-60">{busy ? "Submitting verification..." : verification?.status === "rejected" ? "Resubmit for verification" : "Submit for verification"}</button><p className="mt-2 text-center text-xs text-slate-500">Review your details, attach your document, then submit.</p></div>
          </form>}
        </section>}
        {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{notice}</p>}
        <div className="mt-8 border-t border-slate-100 pt-5">
          <Link href="/work" className="text-sm font-semibold text-teal-700 hover:underline">← Return to NBJ Work opportunities</Link>
        </div>
      </div>
    </div>
  </main>;
}
