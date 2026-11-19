"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SupportPage() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.assign("/account?next=/support"); return; }
      if (active) { setEmail(user.email ?? ""); setLoading(false); }
    }
    init();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.assign("/account?next=/support"); return; }
    const { error: insertError } = await supabase.from("support_messages").insert({
      customer_id: user.id,
      customer_email: user.email ?? email,
      subject: subject.trim(),
      message: message.trim()
    });
    if (insertError) setError("We couldn't send your message. Please try again.");
    else { setNotice("Your support request has been submitted. Our team will review it."); setSubject(""); setMessage(""); }
    setBusy(false);
  }

  if (loading) return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Loading support...</main>;
  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-12">
    <div className="mx-auto max-w-2xl">
      <Link href="/" className="text-xl font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Customer care</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900">How can we help?</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Send our team a message about your account, an order, a download or the marketplace.</p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block text-sm font-semibold text-slate-700">Your email<input readOnly value={email} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-600"/></label>
          <label className="block text-sm font-semibold text-slate-700">Subject<input required maxLength={160} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="What do you need help with?" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal"/></label>
          <label className="block text-sm font-semibold text-slate-700">Message<textarea required minLength={10} maxLength={5000} rows={6} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Describe the issue and include an order reference if relevant." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal"/></label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {notice && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{notice}</p>}
          <button disabled={busy} className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50">{busy ? "Sending..." : "Submit support request"}</button>
        </form>
      </section>
      <div className="mt-5 flex flex-wrap gap-5 text-sm"><Link href="/help" className="font-semibold text-teal-700 hover:underline">Help Centre</Link><Link href="/account/support" className="font-semibold text-teal-700 hover:underline">My support tickets</Link><Link href="/account/orders" className="font-semibold text-teal-700 hover:underline">My orders</Link><Link href="/account" className="font-semibold text-teal-700 hover:underline">My account</Link></div>
    </div>
  </main>;
}
