"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Enquiry = {
  id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  subject: string;
  message: string;
  status: "new" | "in_progress" | "responded" | "closed";
  created_at: string;
};

const statusLabels: Record<Enquiry["status"], string> = {
  new: "New",
  in_progress: "In progress",
  responded: "Responded",
  closed: "Closed"
};

export default function BusinessEnquiriesPage() {
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      window.location.assign("/account?next=/business/enquiries");
      return;
    }
    const { data: workspace, error: workspaceError } = await supabase
      .from("business_workspaces")
      .select("id,business_name")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (workspaceError || !workspace) {
      setError(workspaceError?.message || "No business workspace was found for this account.");
      setLoading(false);
      return;
    }
    setWorkspaceId(workspace.id);
    setBusinessName(workspace.business_name);
    const { data, error: enquiryError } = await supabase
      .from("business_enquiries")
      .select("id,sender_name,sender_email,sender_phone,subject,message,status,created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });
    if (enquiryError) setError("We couldn't load your enquiries. " + enquiryError.message);
    else setEnquiries((data || []) as Enquiry[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function changeStatus(id: string, status: Enquiry["status"]) {
    setSavingId(id);
    setError("");
    setNotice("");
    const supabase = createClient();
    const { error: updateError } = await supabase.rpc("update_business_enquiry_status", {
      p_enquiry_id: id,
      p_status: status
    });
    if (updateError) setError(updateError.message || "The enquiry status could not be updated.");
    else {
      setEnquiries(current => current.map(item => item.id === id ? { ...item, status } : item));
      setNotice("Enquiry status updated.");
    }
    setSavingId("");
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading business enquiries...</main>;

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10">
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/business" className="text-sm font-bold text-teal-700 hover:underline">← NBJ Business</Link>
        <Link href="/dashboard" className="text-sm font-semibold text-slate-600 hover:underline">Dashboard</Link>
      </div>
      <section className="mt-6 rounded-3xl bg-slate-950 p-8 text-white">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-300">Customer connections</p>
        <h1 className="mt-3 text-3xl font-extrabold">Business enquiries</h1>
        <p className="mt-2 text-sm text-slate-300">{businessName || "Your business"} · Review messages sent through your public NBJ Business profile.</p>
      </section>
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-extrabold text-slate-900">Received messages</h2><p className="mt-1 text-sm text-slate-500">{enquiries.length} {enquiries.length === 1 ? "enquiry" : "enquiries"}</p></div>
        <button onClick={load} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-teal-600">Refresh</button>
      </div>
      {enquiries.length === 0 ? <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-10 text-center"><h3 className="font-bold text-slate-900">No enquiries yet</h3><p className="mt-2 text-sm text-slate-500">When visitors contact your business through its public profile, their messages will appear here.</p></div> :
        <div className="mt-5 space-y-4">{enquiries.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-semibold text-slate-500">{new Date(item.created_at).toLocaleString()}</p><h3 className="mt-2 text-lg font-extrabold text-slate-900">{item.subject}</h3><p className="mt-1 text-sm font-semibold text-slate-700">{item.sender_name}</p><a href={"mailto:" + item.sender_email} className="text-sm text-teal-700 hover:underline">{item.sender_email}</a>{item.sender_phone && <p className="mt-1 text-sm text-slate-600">{item.sender_phone}</p>}</div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Status
              <select value={item.status} disabled={savingId === item.id} onChange={e=>changeStatus(item.id,e.target.value as Enquiry["status"])} className="mt-2 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
                {Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.message}</p>
          <a href={"mailto:" + item.sender_email + "?subject=" + encodeURIComponent("Re: " + item.subject)} className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700">Reply by email</a>
        </article>)}</div>}
    </div>
  </main>;
}
