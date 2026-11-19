"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "closed";
  created_at: string;
  updated_at: string;
};

const filters = ["all", "open", "in_progress", "closed"] as const;

export default function MySupportTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadTickets = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      window.location.assign("/account?next=/account/support");
      return;
    }
    const { data, error: queryError } = await supabase
      .from("support_messages")
      .select("id,subject,message,status,created_at,updated_at")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
    if (queryError) setError("We couldn't load your support requests. Please refresh and try again.");
    else setTickets((data ?? []) as Ticket[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void loadTickets(); }, [loadTickets]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter(ticket => {
      const matchesStatus = filter === "all" || ticket.status === filter;
      const matchesSearch = !term || ticket.subject.toLowerCase().includes(term) || ticket.message.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [tickets, filter, search]);

  const counts = useMemo(() => ({
    open: tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    closed: tickets.filter(t => t.status === "closed").length
  }), [tickets]);

  if (loading) return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Loading your support requests...</main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5">
        <Link href="/" className="text-xl font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
        <Link href="/account" className="text-sm font-semibold text-teal-700 hover:underline">← My account</Link>
      </div>
    </header>
    <div className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Customer space</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-extrabold text-slate-900">My Support Tickets</h1><p className="mt-2 text-sm text-slate-500">Track requests you have sent to the NBJCreative Hub support team.</p></div>
        <Link href="/support" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700">New support request</Link>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {(["open", "in_progress", "closed"] as const).map(status => <div key={status} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs capitalize text-slate-500">{status.replace("_", " ")}</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{counts[status]}</p></div>)}
      </div>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your requests..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-600" />
        <button onClick={() => void loadTickets(true)} disabled={refreshing} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">{refreshing ? "Refreshing..." : "Refresh"}</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map(status => <button key={status} onClick={() => setFilter(status)} className={"rounded-full px-4 py-2 text-xs font-bold capitalize " + (filter === status ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600")}>{status.replace("_", " ")}</button>)}
      </div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <section className="mt-5 space-y-4">
        {visible.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><h2 className="font-bold text-slate-800">No support requests found</h2><p className="mt-2 text-sm text-slate-500">{tickets.length === 0 ? "Requests you submit will appear here, with their latest status." : "Try another filter or search term."}</p><Link href="/support" className="mt-5 inline-block text-sm font-bold text-teal-700 hover:underline">Contact support</Link></div> : visible.map(ticket => <article key={ticket.id} className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-bold text-slate-900">{ticket.subject}</h2><p className="mt-1 text-xs text-slate-500">Submitted {new Date(ticket.created_at).toLocaleString()}</p></div>
            <span className={"rounded-full px-3 py-1 text-xs font-bold capitalize " + (ticket.status === "closed" ? "bg-slate-100 text-slate-600" : ticket.status === "in_progress" ? "bg-amber-50 text-amber-800" : "bg-teal-50 text-teal-800")}>{ticket.status.replace("_", " ")}</span>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.message}</p>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">Last updated {new Date(ticket.updated_at).toLocaleString()}</p>
        </article>)}
      </section>
      <div className="mt-8 flex flex-wrap gap-5 text-sm"><Link href="/account/orders" className="font-semibold text-teal-700 hover:underline">My orders</Link><Link href="/account/notifications" className="font-semibold text-teal-700 hover:underline">Notifications</Link><Link href="/account" className="font-semibold text-teal-700 hover:underline">Account home</Link></div>
    </div>
  </main>;
}
