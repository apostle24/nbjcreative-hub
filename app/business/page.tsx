"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type BusinessOverview = {
  published_offerings_count: number;
  total_enquiries: number;
  new_enquiries: number;
  in_progress_enquiries: number;
  paid_orders_count: number;
  pending_orders_count: number;
  sales_by_currency: { currency: string; total: number; items_sold: number }[];
};

type Workspace = {
  id: string;
  business_name: string;
  business_slug: string;
  description: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  default_currency: string;
  is_public: boolean;
};

const industries = [
  "Agriculture & Food", "Arts, Media & Entertainment", "Construction & Real Estate",
  "Education & Training", "Fashion & Apparel", "Financial Services",
  "Health & Wellness", "Logistics & Transport", "Manufacturing",
  "Professional Services", "Retail & E-commerce", "Technology",
  "Tourism & Hospitality", "Other"
];

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function BusinessWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [overview, setOverview] = useState<BusinessOverview | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [currency, setCurrency] = useState("GHS");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        window.location.assign("/account?next=/business");
        return;
      }
      const { data, error: loadError } = await supabase
        .from("business_workspaces")
        .select("id,business_name,business_slug,description,industry,country,city,website_url,contact_email,contact_phone,default_currency,is_public")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (loadError) setError("We couldn't load your business workspace. Please refresh and try again.");
      if (data) {
        const item = data as Workspace;
        setWorkspace(item);
        const { data: overviewData, error: overviewLoadError } = await supabase.rpc("get_business_workspace_overview", { p_workspace_id: item.id });
        if (!active) return;
        if (overviewLoadError) setOverviewError("Business performance figures are temporarily unavailable.");
        else setOverview(overviewData as BusinessOverview);
        setBusinessName(item.business_name);
        setDescription(item.description ?? "");
        setIndustry(item.industry ?? "");
        setCountry(item.country ?? "");
        setCity(item.city ?? "");
        setWebsite(item.website_url ?? "");
        setContactEmail(item.contact_email ?? "");
        setContactPhone(item.contact_phone ?? "");
        setCurrency(item.default_currency ?? "GHS");
        setIsPublic(item.is_public ?? false);
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const supabase = createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user) {
      setError(userError?.message || "Your sign-in session could not be verified. Please sign in again.");
      setBusy(false);
      return;
    }
    let tokenClaims: Record<string, unknown> | null = null;
    try {
      const tokenPart = session?.access_token.split(".")[1];
      if (tokenPart) {
        const normalized = tokenPart.replace(/-/g, "+").replace(/_/g, "/");
        tokenClaims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
      }
    } catch {
      tokenClaims = null;
    }
    const slug = slugify(businessName);
    if (slug.length < 2) {
      setError("Enter a business name with at least two letters or numbers.");
      setBusy(false);
      return;
    }
    const safeWebsite = website.trim() || null;
    if (safeWebsite && !/^https?:\/\//i.test(safeWebsite)) {
      setError("Website must begin with https:// or http://.");
      setBusy(false);
      return;
    }
    const payload = {
      owner_id: user.id,
      business_name: businessName.trim(),
      business_slug: slug,
      description: description.trim() || null,
      industry: industry || null,
      country: country.trim() || null,
      city: city.trim() || null,
      website_url: safeWebsite,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      default_currency: currency,
      is_public: isPublic
    };
    const { data: databaseAuthContext, error: databaseAuthError } = await supabase.rpc("get_business_workspace_auth_context");

    const workspaceSelect = "id,business_name,business_slug,description,industry,country,city,website_url,contact_email,contact_phone,default_currency,is_public";
    const writeResult = workspace
      ? await supabase.from("business_workspaces").update(payload).eq("id", workspace.id)
      : await supabase.from("business_workspaces").insert(payload);

    // Keep INSERT/UPDATE separate from SELECT so an RLS failure on RETURNING
    // can be distinguished from a failure of the write policy itself.
    const result = writeResult.error
      ? { data: null, error: writeResult.error }
      : await supabase.from("business_workspaces")
          .select(workspaceSelect)
          .eq("owner_id", user.id)
          .single();

    if (result.error) {
      const databaseDetail = [result.error.message, result.error.details, result.error.hint]
        .filter(Boolean)
        .join(" ");
      const authDiagnostic = [
        `Signed-in account: ${user.email || "not returned"}`,
        `App user ID: ${user.id}`,
        `Session token email: ${typeof tokenClaims?.email === "string" ? tokenClaims.email : "not available"}`,
        `Session token user ID: ${typeof tokenClaims?.sub === "string" ? tokenClaims.sub : "not available"}`,
        `Session token role: ${typeof tokenClaims?.role === "string" ? tokenClaims.role : "not available"}`,
        `App ID matches token ID: ${Boolean(tokenClaims?.sub && tokenClaims.sub === user.id) ? "YES" : "NO"}`,
        `Session check: ${sessionError?.message || "no error"}`,
        `Database auth user ID: ${databaseAuthContext?.database_user_id || "not returned"}`,
        `Database auth role: ${databaseAuthContext?.database_role || "not returned"}`,
        `Database current user: ${databaseAuthContext?.database_current_user || "not returned"}`,
        `Database auth RPC check: ${databaseAuthError?.message || "no error"}`
      ].join(" | ");
      setError(result.error.code === "23505"
        ? "A business workspace already exists for this account, or that business address is already taken."
        : `We couldn't save your business workspace. Database response: ${databaseDetail || "No additional details returned"} (code: ${result.error.code || "unknown"}). Authentication check: ${authDiagnostic}`);
    } else {
      setWorkspace(result.data as Workspace);
      setNotice("Your business workspace has been saved.");
    }
    setBusy(false);
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading NBJ Business...</main>;

  return (
    <main className="min-h-screen bg-[#F5F7F8] px-5 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4"><Link href="/" className="text-sm font-bold text-teal-700 hover:underline">← NBJCreative Hub</Link><nav className="flex flex-wrap gap-3 text-xs font-semibold text-slate-600"><Link href="/marketplace">Marketplace</Link><Link href="/work">Work</Link><Link href="/academy">Academy</Link><Link href="/vendor">Vendor Centre</Link><Link href="/dashboard">Dashboard</Link></nav></div>
        <div className="mt-6 rounded-3xl bg-slate-950 p-8 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Create · Manage · Grow</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">NBJ Business</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Build your business presence, reach customers and connect with opportunities through NBJCreative Hub.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/businesses" className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">Discover businesses →</Link>
            {workspace && <Link href="/business/enquiries" className="inline-flex rounded-full bg-teal-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-teal-400">View customer enquiries →</Link>}
            {workspace && <Link href="/vendor/products" className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">Manage products & services →</Link>}
            {workspace && <Link href="/vendor/orders" className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">Manage sales & orders →</Link>}
          </div>
        </div>

        {workspace && <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Business performance</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Your business at a glance</h2>
              <p className="mt-2 text-sm text-slate-500">Live figures from your published Marketplace listings, customer enquiries and paid orders.</p>
            </div>
            <Link href="/business/enquiries" className="text-sm font-bold text-teal-700 hover:underline">Open enquiry inbox →</Link>
          </div>
          {overviewError ? <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{overviewError}</p> : overview ? <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Published offerings</p><p className="mt-2 text-3xl font-extrabold text-slate-950">{overview.published_offerings_count}</p><Link href="/vendor/products" className="mt-2 inline-block text-xs font-bold text-teal-700">Manage listings →</Link></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Customer enquiries</p><p className="mt-2 text-3xl font-extrabold text-slate-950">{overview.total_enquiries}</p><p className="mt-2 text-xs text-slate-500">{overview.new_enquiries} new · {overview.in_progress_enquiries} in progress</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Paid orders</p><p className="mt-2 text-3xl font-extrabold text-slate-950">{overview.paid_orders_count}</p><p className="mt-2 text-xs text-slate-500">{overview.pending_orders_count} pending payment</p><Link href="/vendor/orders" className="mt-2 inline-block text-xs font-bold text-teal-700">Manage orders →</Link></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Marketplace sales</p>
                {overview.sales_by_currency.length ? overview.sales_by_currency.map(sale => <div key={sale.currency} className="mt-2"><p className="text-xl font-extrabold text-slate-950">{new Intl.NumberFormat(undefined,{style:"currency",currency:sale.currency}).format(Number(sale.total))}</p><p className="text-xs text-slate-500">{sale.items_sold} item(s) sold · {sale.currency}</p></div>) : <p className="mt-2 text-sm font-semibold text-slate-700">No paid sales yet</p>}
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Sales are calculated from your own paid order items and grouped by currency. Pending, failed and refunded orders are not counted as sales.</p>
          </> : <p className="mt-5 text-sm text-slate-500">Loading business performance...</p>}
        </section>}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Business setup</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">{workspace ? "Business profile" : "Create your workspace"}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Start with your business details. You can update them whenever your business changes.</p>
            </div>
            {workspace && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Workspace active</span>}
          </div>

          <form onSubmit={save} className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Business name
              <input required minLength={2} maxLength={120} value={businessName} onChange={e=>setBusinessName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600" placeholder="e.g. Heritage Royal Foods"/>
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Business description
              <textarea rows={4} maxLength={3000} value={description} onChange={e=>setDescription(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600" placeholder="What does your business do? Who do you serve?"/>
            </label>
            <label className="text-sm font-semibold text-slate-700">Industry
              <select value={industry} onChange={e=>setIndustry(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3">
                <option value="">Select an industry</option>
                {industries.map(item=><option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Default currency
              <select value={currency} onChange={e=>setCurrency(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3">
                <option value="GHS">GHS — Ghana cedi</option><option value="USD">USD — US dollar</option><option value="GBP">GBP — British pound</option><option value="EUR">EUR — Euro</option><option value="NGN">NGN — Nigerian naira</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Country
              <input value={country} onChange={e=>setCountry(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600" placeholder="Country"/>
            </label>
            <label className="text-sm font-semibold text-slate-700">City
              <input value={city} onChange={e=>setCity(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600" placeholder="City"/>
            </label>
            <label className="text-sm font-semibold text-slate-700">Website
              <input type="url" value={website} onChange={e=>setWebsite(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600" placeholder="https://example.com"/>
            </label>
            <label className="text-sm font-semibold text-slate-700">Business email
              <input type="email" value={contactEmail} onChange={e=>setContactEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600" placeholder="business@example.com"/>
            </label>
            <div className="sm:col-span-2 rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
              <label className="flex items-start gap-3 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={isPublic} onChange={e=>setIsPublic(e.target.checked)} className="mt-1 h-4 w-4 accent-teal-700"/>
                <span>Show my business in the public NBJ Business directory
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-600">When enabled, visitors can discover your business name, description, industry, location and website. Your account details, business email and phone number remain private.</span>
                </span>
              </label>
              {workspace?.is_public && <Link href={"/business/"+workspace.business_slug} className="mt-3 inline-block text-xs font-bold text-teal-800 hover:underline">View your public business profile →</Link>}
            </div>
            <label className="text-sm font-semibold text-slate-700">Business phone
              <input value={contactPhone} onChange={e=>setContactPhone(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600" placeholder="+233..."/>
            </label>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">{error}</p>}
            {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 sm:col-span-2">{notice}</p>}
            <div className="sm:col-span-2">
              <button disabled={busy} className="w-full rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60 sm:w-auto">{busy ? "Saving workspace..." : workspace ? "Save business profile" : "Create business workspace"}</button>
            </div>
          </form>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["Business finances","Optional tools to understand business income and expenses."],
            ["Products & services","Publish products and online services through Vendor Centre; published listings can appear on your public business profile."],
            ["Customers & growth","Build your public presence and connect with potential customers."]
          ].map(([title,body])=><div key={title} className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>{title === "Products & services" && workspace ? <Link href="/vendor/products" className="mt-4 inline-block text-sm font-bold text-teal-700 hover:underline">Manage offerings →</Link> : <span className="mt-4 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Coming next</span>}</div>)}
        </section>
      </div>
    </main>
  );
}
