"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, ExternalLink, Trash2, Upload, Save, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CandidateProfile = {
  professional_headline: string | null;
  professional_summary: string | null;
  location: string | null;
  country: string | null;
  skills: string[];
  experience_years: number | null;
  education: string | null;
  certifications: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  is_public: boolean;
};

type CandidateDocument = {
  id: string;
  file_name: string;
  storage_path: string;
  content_type: string;
  size_bytes: number;
  document_type: "resume" | "certificate" | "portfolio";
  created_at: string;
};

const emptyProfile: CandidateProfile = {
  professional_headline: "", professional_summary: "", location: "", country: "",
  skills: [], experience_years: null, education: "", certifications: "",
  website_url: "", linkedin_url: "", portfolio_url: "", is_public: false
};

const allowedTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? Math.round(bytes / 1024) + " KB" : (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function CandidateProfilePage() {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<CandidateProfile>(emptyProfile);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [skillsText, setSkillsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      window.location.assign("/account?next=/account/work-profile");
      return;
    }
    setUserId(user.id);
    const [{ data: profileData, error: profileError }, { data: documentData, error: documentError }] = await Promise.all([
      supabase.from("work_candidate_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("work_candidate_documents").select("id,file_name,storage_path,content_type,size_bytes,document_type,created_at").eq("user_id", user.id).order("created_at", { ascending: false })
    ]);
    if (profileError || documentError) {
      setError("We couldn't load your candidate workspace. Please make sure the NBJ Work candidate profile database update has been applied.");
    } else {
      const nextProfile = profileData ? { ...emptyProfile, ...profileData } as CandidateProfile : emptyProfile;
      setProfile(nextProfile);
      setSkillsText((nextProfile.skills || []).join(", "));
      setDocuments((documentData || []) as CandidateDocument[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function update<K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) {
    setProfile(current => ({ ...current, [key]: value }));
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    const skills = Array.from(new Set(skillsText.split(",").map(s => s.trim()).filter(Boolean))).slice(0, 40);
    const payload = {
      ...profile,
      user_id: userId,
      professional_headline: profile.professional_headline?.trim() || null,
      professional_summary: profile.professional_summary?.trim() || null,
      location: profile.location?.trim() || null,
      country: profile.country?.trim() || null,
      skills,
      education: profile.education?.trim() || null,
      certifications: profile.certifications?.trim() || null,
      website_url: profile.website_url?.trim() || null,
      linkedin_url: profile.linkedin_url?.trim() || null,
      portfolio_url: profile.portfolio_url?.trim() || null
    };
    const supabase = createClient();
    const { error: saveError } = await supabase.from("work_candidate_profiles").upsert(payload, { onConflict: "user_id" });
    if (saveError) setError(saveError.message || "Your professional profile could not be saved.");
    else {
      update("skills", skills);
      setNotice("Your NBJ Work professional profile has been saved.");
    }
    setSaving(false);
  }

  async function uploadDocument(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(""); setNotice("");
    if (!allowedTypes.includes(file.type)) {
      setError("Upload a PDF, DOC or DOCX file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Each document must be 10 MB or smaller.");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const path = userId + "/" + crypto.randomUUID() + "-" + safeName;
    const { error: uploadError } = await supabase.storage.from("work-candidate-files").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setError(uploadError.message || "The document could not be uploaded.");
      setUploading(false);
      return;
    }
    const { error: recordError } = await supabase.from("work_candidate_documents").insert({
      user_id: userId, file_name: file.name, storage_path: path, content_type: file.type,
      size_bytes: file.size, document_type: "resume"
    });
    if (recordError) {
      await supabase.storage.from("work-candidate-files").remove([path]);
      setError(recordError.message || "The uploaded file could not be saved to your profile.");
    } else {
      setNotice("Your CV has been uploaded securely.");
      await load();
    }
    setUploading(false);
  }

  async function openDocument(doc: CandidateDocument) {
    setError("");
    const supabase = createClient();
    const { data, error: urlError } = await supabase.storage.from("work-candidate-files").createSignedUrl(doc.storage_path, 60);
    if (urlError || !data?.signedUrl) {
      setError("We couldn't open this document. Please try again.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDocument(doc: CandidateDocument) {
    if (!window.confirm("Delete " + doc.file_name + " from your candidate profile?")) return;
    setError(""); setNotice("");
    const supabase = createClient();
    const { error: recordError } = await supabase.from("work_candidate_documents").delete().eq("id", doc.id).eq("user_id", userId);
    if (recordError) {
      setError("We couldn't remove this CV record.");
      return;
    }
    const { error: fileError } = await supabase.storage.from("work-candidate-files").remove([doc.storage_path]);
    if (fileError) setError("The CV record was removed, but the stored file could not be deleted. Please contact support.");
    else setNotice("The document has been deleted.");
    await load();
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading your candidate profile...</main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
      <Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
      <Link href="/account" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-700"><ArrowLeft size={15}/> Account</Link>
    </div></header>
    <div className="mx-auto max-w-5xl px-5 py-10 md:py-14">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Work · Candidate workspace</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">Professional profile & CV</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Build a professional profile, highlight your skills and securely manage the CV documents you may use when applying for opportunities.</p>
      {error && <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="mt-6 rounded-xl bg-teal-50 p-4 text-sm text-teal-800">{notice}</p>}

      <form onSubmit={saveProfile} className="mt-8 space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-extrabold text-slate-900">Professional introduction</h2>
          <p className="mt-1 text-sm text-slate-500">Tell employers what you do and what you can contribute.</p>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">Professional headline<input maxLength={160} value={profile.professional_headline || ""} onChange={e => update("professional_headline", e.target.value)} placeholder="e.g. Front-end Developer | UI Designer" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600"/></label>
            <label className="block text-sm font-semibold text-slate-700">Professional summary<textarea rows={5} maxLength={3000} value={profile.professional_summary || ""} onChange={e => update("professional_summary", e.target.value)} placeholder="Summarise your experience, strengths and the work you are looking for..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600"/></label>
            <label className="block text-sm font-semibold text-slate-700">Skills<input value={skillsText} onChange={e => setSkillsText(e.target.value)} placeholder="Web development, communication, project management" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600"/><span className="mt-1 block text-xs font-normal text-slate-400">Separate skills with commas.</span></label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-extrabold text-slate-900">Experience & education</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">Years of experience<input type="number" min="0" max="60" value={profile.experience_years ?? ""} onChange={e => update("experience_years", e.target.value === "" ? null : Number(e.target.value))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600"/></label>
            <label className="block text-sm font-semibold text-slate-700">Country<input maxLength={100} value={profile.country || ""} onChange={e => update("country", e.target.value)} placeholder="e.g. Ghana" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600"/></label>
            <label className="block text-sm font-semibold text-slate-700 md:col-span-2">City or location<input maxLength={120} value={profile.location || ""} onChange={e => update("location", e.target.value)} placeholder="e.g. Accra" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600"/></label>
            <label className="block text-sm font-semibold text-slate-700 md:col-span-2">Education<textarea rows={3} maxLength={2000} value={profile.education || ""} onChange={e => update("education", e.target.value)} placeholder="Schools, qualifications and relevant training" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600"/></label>
            <label className="block text-sm font-semibold text-slate-700 md:col-span-2">Certifications<textarea rows={3} maxLength={2000} value={profile.certifications || ""} onChange={e => update("certifications", e.target.value)} placeholder="Professional certificates, licences and awards" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600"/></label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-extrabold text-slate-900">Professional links</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">Personal website<input type="url" value={profile.website_url || ""} onChange={e => update("website_url", e.target.value)} placeholder="https://" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600"/></label>
            <label className="block text-sm font-semibold text-slate-700">LinkedIn profile<input type="url" value={profile.linkedin_url || ""} onChange={e => update("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600"/></label>
            <label className="block text-sm font-semibold text-slate-700 md:col-span-2">Portfolio or work samples<input type="url" value={profile.portfolio_url || ""} onChange={e => update("portfolio_url", e.target.value)} placeholder="https://" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600"/></label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-center gap-2"><ShieldCheck size={20} className="text-teal-700"/><h2 className="text-xl font-extrabold text-slate-900">Profile privacy</h2></div>
          <label className="mt-4 flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={profile.is_public} onChange={e => update("is_public", e.target.checked)} className="mt-1 h-4 w-4 accent-teal-700"/><span><strong>Make my professional profile discoverable</strong><span className="mt-1 block text-xs leading-5 text-slate-500">When enabled, your professional profile information can be displayed publicly. Your uploaded CV files remain private and are not made public by this setting.</span></span></label>
        </section>

        <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60"><Save size={16}/>{saving ? "Saving profile..." : "Save professional profile"}</button>
      </form>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-extrabold text-slate-900">My CV documents</h2><p className="mt-1 text-sm text-slate-500">Upload PDF, DOC or DOCX files. Maximum 10 MB per file.</p></div>
          <label className={"inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800 " + (uploading ? "pointer-events-none opacity-60" : "")}><Upload size={16}/>{uploading ? "Uploading..." : "Upload CV"}<input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={uploadDocument} disabled={uploading} className="hidden"/></label>
        </div>
        <div className="mt-5 space-y-3">
          {documents.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center"><FileText className="mx-auto text-slate-400" size={30}/><p className="mt-3 text-sm font-semibold text-slate-700">No CV uploaded yet</p><p className="mt-1 text-xs text-slate-500">Upload your latest CV so you can use it in future NBJ Work applications.</p></div> : documents.map(doc => <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
            <div className="flex min-w-0 items-center gap-3"><FileText className="shrink-0 text-teal-700" size={22}/><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{doc.file_name}</p><p className="mt-1 text-xs text-slate-500">{formatSize(doc.size_bytes)} · Uploaded {new Date(doc.created_at).toLocaleDateString()}</p></div></div>
            <div className="flex items-center gap-3"><button type="button" onClick={() => openDocument(doc)} className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:underline">Open <ExternalLink size={13}/></button><button type="button" onClick={() => deleteDocument(doc)} className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline"><Trash2 size={13}/>Delete</button></div>
          </div>)}
        </div>
      </section>
      <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold"><Link href="/account/work-applications" className="text-teal-700 hover:underline">My applications</Link><Link href="/work" className="text-teal-700 hover:underline">Explore opportunities</Link><Link href="/account" className="text-teal-700 hover:underline">Account</Link></div>
    </div>
  </main>;
}
