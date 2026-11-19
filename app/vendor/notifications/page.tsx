"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  notification_type: "store_status" | "product_status" | "new_order" | "announcement";
  title: string;
  message: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

export default function VendorNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { window.location.assign("/account?next=/vendor/notifications"); return; }
    const { data: vendor, error: vendorError } = await supabase.from("vendor_profiles")
      .select("id").eq("owner_id", user.id).maybeSingle();
    if (vendorError) throw vendorError;
    if (!vendor) { setItems([]); return; }
    const { data, error: queryError } = await supabase.from("vendor_notifications")
      .select("id,notification_type,title,message,action_url,read_at,created_at")
      .eq("vendor_id", vendor.id).order("created_at", { ascending: false }).limit(100);
    if (queryError) throw queryError;
    setItems((data ?? []) as Notification[]);
  }, []);

  useEffect(() => {
    let active = true;
    load().catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load notifications."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  async function markRead(id: string) {
    setBusy(id); setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase.from("vendor_notifications")
      .update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
    if (updateError) setError("Could not mark this notification as read.");
    else setItems(current => current.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    setBusy("");
  }

  async function markAllRead() {
    setBusy("all"); setError("");
    const unread = items.filter(item => !item.read_at);
    if (!unread.length) { setBusy(""); return; }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(""); return; }
    const { data: vendor } = await supabase.from("vendor_profiles").select("id").eq("owner_id", user.id).maybeSingle();
    if (!vendor) { setBusy(""); return; }
    const { error: updateError } = await supabase.from("vendor_notifications")
      .update({ read_at: new Date().toISOString() }).eq("vendor_id", vendor.id).is("read_at", null);
    if (updateError) setError("Could not update notifications.");
    else await load();
    setBusy("");
  }

  const unreadCount = items.filter(item => !item.read_at).length;
  const icon = (type: Notification["notification_type"]) => type === "store_status" ? "🏪" : type === "product_status" ? "📦" : type === "new_order" ? "🛒" : "📢";

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading notifications...</main>;

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10">
    <div className="mx-auto max-w-4xl">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
        <Link href="/vendor" className="text-sm font-semibold text-teal-700 hover:underline">← Vendor Centre</Link>
      </header>
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Seller workspace</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Notifications</h1><p className="mt-2 text-sm text-slate-600">Store decisions, product reviews and order updates in one place.</p></div>
          <div className="flex items-center gap-3"><span className="text-sm font-semibold text-slate-600">{unreadCount} unread</span><button onClick={markAllRead} disabled={!unreadCount || !!busy} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50">Mark all read</button></div>
        </div>
        {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="mt-6 space-y-3">
          {items.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><p className="font-bold text-slate-800">No notifications yet</p><p className="mt-2 text-sm text-slate-500">Updates about your store and products will appear here.</p></div> : items.map(item => <article key={item.id} className={"rounded-2xl border bg-white p-5 " + (item.read_at ? "border-slate-200" : "border-teal-300 shadow-sm")}>
            <div className="flex items-start gap-4"><span className="text-2xl" aria-hidden="true">{icon(item.notification_type)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-900">{item.title}</h2>{!item.read_at && <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-bold uppercase text-teal-800">New</span>}</div><p className="mt-2 text-sm leading-6 text-slate-600">{item.message}</p><p className="mt-2 text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</p><div className="mt-3 flex flex-wrap gap-3">{item.action_url && <Link href={item.action_url} className="text-xs font-bold text-teal-700 hover:underline">Open →</Link>}{!item.read_at && <button disabled={!!busy} onClick={() => markRead(item.id)} className="text-xs font-bold text-slate-600 hover:underline">{busy === item.id ? "Saving..." : "Mark as read"}</button>}</div></div></div>
          </article>)}
        </div>
      </section>
    </div>
  </main>;
}
