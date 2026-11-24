"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink, MapPin, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type BusinessOffering = {
  id: string;
  title: string;
  slug: string;
  product_type: "physical" | "digital" | "online_service";
  summary: string | null;
  description: string | null;
  price: number | string;
  currency: string;
  shipping_note: string | null;
  delivery_note: string | null;
};

type BusinessProfile = {
  business_name: string;
  business_slug: string;
  description: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  website_url: string | null;
};

export default function PublicBusinessProfilePage() {
  const params = useParams<{ slug: string }>();
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [offerings, setOfferings] = useState<BusinessOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [shareNotice, setShareNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("get_public_business_profile", { p_business_slug: params.slug });
      if (!active) return;
      if (rpcError) setError("We couldn't load this business profile. Please try again later.");
      else if (data) {
        setBusiness(data as BusinessProfile);
        const { data: offeringData } = await supabase.rpc("get_public_business_offerings", { p_business_slug: params.slug });
        if (active) setOfferings((offeringData ?? []) as BusinessOffering[]);
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [params.slug]);

  async function shareBusiness() {
    const profileUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: business?.business_name || "Business profile", text: "Discover this business on NBJCreative Hub.", url: profileUrl });
        setShareNotice("Business profile shared.");
      } else {
        await navigator.clipboard.writeText(profileUrl);
        setShareNotice("Business profile link copied. You can now share it with customers.");
      }
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(profileUrl);
        setShareNotice("Business profile link copied. You can now share it with customers.");
      } catch {
        setShareNotice("Copy this page's web address from your browser to share the profile.");
      }
    }
  }

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    setSending(true);
    setError("");
    setSuccess("");
    const supabase = createClient();
    const { error: submitError } = await supabase.rpc("submit_business_enquiry", {
      p_business_slug: business.business_slug,
      p_sender_name: senderName,
      p_sender_email: senderEmail,
      p_sender_phone: senderPhone || null,
      p_subject: subject,
      p_message: message
    });
    if (submitError) {
      setError(submitError.message || "Your enquiry could not be sent. Please try again.");
    } else {
      setSuccess("Your enquiry has been sent to this business. They can review it through their NBJ Business workspace.");
      setSenderName("");
      setSenderEmail("");
      setSenderPhone("");
      setSubject("");
      setMessage("");
    }
    setSending(false);
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading business profile...</main>;

  if (!business) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] px-5"><div className="max-w-md rounded-3xl bg-white p-9 text-center shadow-sm"><Building2 className="mx-auto text-teal-700" size={34}/><h1 className="mt-4 text-2xl font-extrabold text-slate-900">Business profile unavailable</h1><p className="mt-2 text-sm leading-6 text-slate-500">{error || "This business profile may be private or may not exist."}</p><Link href="/businesses" className="mt-6 inline-flex items-center gap-2 font-bold text-teal-700"><ArrowLeft size={16}/> Browse businesses</Link></div></main>;

  const location = [business.city,business.country].filter(Boolean).join(", ");

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5"><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><Link href="/businesses" className="text-sm font-semibold text-teal-700 hover:underline">Business directory</Link></div></header>
    <section className="bg-slate-950 text-white"><div className="mx-auto max-w-5xl px-5 py-16 md:py-24"><p className="text-xs font-bold uppercase tracking-[.22em] text-teal-300">Business profile</p><div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-teal-200"><Building2 size={28}/></div><h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight md:text-6xl">{business.business_name}</h1>{business.industry && <p className="mt-4 text-sm font-semibold text-teal-200">{business.industry}</p>}<p className="mt-5 max-w-2xl whitespace-pre-wrap text-base leading-8 text-slate-300">{business.description || "Discover this business and its work."}</p><div className="mt-7 flex flex-wrap items-center gap-4 text-sm text-slate-300">{location && <span className="inline-flex items-center gap-2"><MapPin size={16}/>{location}</span>}{business.website_url && <a href={business.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-bold text-teal-200 hover:underline">Visit business website <ExternalLink size={15}/></a>}<button type="button" onClick={shareBusiness} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 font-bold text-white hover:bg-white/10"><Share2 size={15}/> Share business</button></div>{shareNotice && <p role="status" className="mt-3 text-xs font-semibold text-teal-200">{shareNotice}</p>}</div></section>
    <section className="mx-auto max-w-5xl px-5 py-12">
      {offerings.length > 0 && <section id="offerings" className="mb-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wider text-teal-700">What we offer</p><h2 className="mt-2 text-2xl font-extrabold text-slate-900">Products & services</h2><p className="mt-2 text-sm text-slate-600">Explore this business's published offerings on NBJ Marketplace.</p></div>
          <Link href="/marketplace" className="text-sm font-bold text-teal-700 hover:underline">Explore marketplace →</Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offerings.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-700">{item.product_type === "physical" ? "Physical product" : item.product_type === "online_service" ? "Online service" : "Digital product"}</p>
            <h3 className="mt-2 text-lg font-bold text-slate-900">{item.title}</h3>
            {item.summary && <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>}
            <p className="mt-4 text-base font-extrabold text-slate-900">{item.currency} {Number(item.price).toFixed(2)}</p>
            {(item.shipping_note || item.delivery_note) && <p className="mt-2 text-xs leading-5 text-slate-500">{item.shipping_note || item.delivery_note}</p>}
            <Link href={"/products/" + item.slug} className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700">View offering →</Link>
          </article>)}
        </div>
      </section>}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-7">
          <h2 className="text-xl font-extrabold text-slate-900">Connect with this business</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Send a question, request information, or discuss a possible business partnership. Your message will be delivered to the business through NBJCreative Hub.</p>
          <p className="mt-5 text-xs leading-5 text-slate-500">Your contact details are shared with this business only so it can respond to your enquiry. They are not displayed publicly.</p>
        </div>
        <form id="enquiry" onSubmit={submitEnquiry} className="rounded-2xl border border-slate-200 bg-white p-7">
          <h2 className="text-xl font-extrabold text-slate-900">Send an enquiry</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Your name
              <input required minLength={2} maxLength={120} value={senderName} onChange={e=>setSenderName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-600"/>
            </label>
            <label className="text-sm font-semibold text-slate-700">Email address
              <input required type="email" maxLength={254} value={senderEmail} onChange={e=>setSenderEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-600"/>
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Phone (optional)
              <input maxLength={40} value={senderPhone} onChange={e=>setSenderPhone(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-600"/>
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Subject
              <input required minLength={2} maxLength={160} value={subject} onChange={e=>setSubject(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-600" placeholder="What would you like to discuss?"/>
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Message
              <textarea required minLength={10} maxLength={5000} rows={5} value={message} onChange={e=>setMessage(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-600" placeholder="Write your enquiry..."/>
            </label>
          </div>
          {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {success && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
          <button disabled={sending} className="mt-5 rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">{sending ? "Sending enquiry..." : "Send enquiry"}</button>
        </form>
      </div>
      <div className="mt-8"><Link href="/businesses" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:underline"><ArrowLeft size={16}/> Back to business directory</Link></div>
    </section>
  </main>;
}
