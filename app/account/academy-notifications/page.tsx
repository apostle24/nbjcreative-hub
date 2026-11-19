"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, CheckCheck, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

export default function AcademyNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  async function load() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      window.location.assign("/account?next=/account/academy-notifications");
      return;
    }
    const { data, error: queryError } = await supabase
      .from("academy_notifications")
      .select("id,notification_type,title,message,action_url,read_at,created_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (queryError) setError("We couldn't load your Academy notifications. Please refresh and try again.");
    else setItems((data ?? []) as Notification[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    setBusy(id);
    setError("");
    const now = new Date().toISOString();
    const { error: updateError } = await createClient()
      .from("academy_notifications")
      .update({ read_at: now })
      .eq("id", id);
    if (updateError) setError("This notification could not be updated.");
    else setItems(current => current.map(item => item.id === id ? { ...item, read_at: now } : item));
    setBusy(null);
  }

  async function markAllRead() {
    setBusy("all");
    setError("");
    const now = new Date().toISOString();
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) {
      window.location.assign("/account");
      return;
    }
    const { error: updateError } = await createClient()
      .from("academy_notifications")
      .update({ read_at: now })
      .eq("recipient_id", user.id)
      .is("read_at", null);
    if (updateError) setError("Unread notifications could not be updated.");
    else setItems(current => current.map(item => item.read_at ? item : { ...item, read_at: now }));
    setBusy(null);
  }

  const unread = items.filter(item => !item.read_at).length;
  const visible = useMemo(() => items.filter(item =>
    filter === "all" || (filter === "unread" ? !item.read_at : !!item.read_at)
  ), [items, filter]);

  return <main className="min-h-screen bg-mist">
    <header className="border-b border-slate-100 bg-white">
      <div className="container flex h-20 items-center justify-between">
        <Link href="/" className="font-extrabold tracking-tight text-ink">NBJCreative <span className="text-teal">Hub</span></Link>
        <Link href="/account" className="text-sm font-semibold text-slate-600 hover:text-teal"><ArrowLeft size={15} className="mr-2 inline" />Account</Link>
      </div>
    </header>
    <div className="container max-w-4xl py-12 md:py-16">
      <p className="eyebrow mb-3">NBJ Academy</p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink">Learning notifications</h1>
          <p className="mt-2 text-sm text-slate-500">Course enrolments, assessment results, certificates and instructor updates.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-teal disabled:opacity-50"><RefreshCw size={15} />Refresh</button>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-5">
        <p className="text-sm font-semibold text-slate-700"><Bell size={16} className="mr-2 inline text-teal" />{unread} unread</p>
        <button onClick={markAllRead} disabled={busy !== null || unread === 0} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:border-teal disabled:opacity-40"><CheckCheck size={15} />Mark all read</button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {(["all", "unread", "read"] as const).map(value => (
          <button key={value} onClick={() => setFilter(value)} className={"rounded-full px-4 py-2 text-xs font-bold capitalize " + (filter === value ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-teal")}>{value}</button>
        ))}
      </div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {loading ? <p className="mt-6 rounded-2xl bg-white p-8 text-sm text-slate-500">Loading notifications...</p> :
        visible.length === 0 ? <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-10 text-center">
          <Bell size={32} className="mx-auto text-teal" />
          <h2 className="mt-4 text-lg font-bold text-ink">No {filter === "all" ? "" : filter + " "}notifications yet</h2>
          <p className="mt-2 text-sm text-slate-500">Updates from your courses and instructors will appear here.</p>
          <Link href="/academy" className="mt-5 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-bold text-white">Explore Academy</Link>
        </section> :
        <div className="mt-6 space-y-3">
          {visible.map(item => <article key={item.id} className={"rounded-2xl border bg-white p-5 " + (item.read_at ? "border-slate-100" : "border-teal-200")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-ink">{item.title}</h2>
                  {!item.read_at && <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-700">NEW</span>}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.message}</p>
                <p className="mt-2 text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3">
                {!item.read_at && <button disabled={busy !== null} onClick={() => markRead(item.id)} className="text-xs font-bold text-teal-700 hover:underline disabled:opacity-50">{busy === item.id ? "Saving..." : "Mark read"}</button>}
                {item.action_url && <Link href={item.action_url} className="text-xs font-bold text-slate-600 hover:text-teal">Open →</Link>}
              </div>
            </div>
          </article>)}
        </div>
      }
    </div>
  </main>;
}
