"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Reply = { id: string; sender_id: string; sender_role: "customer" | "admin"; message: string; created_at: string };

export default function SupportConversation({ ticketId, isAdmin, ticketStatus }: { ticketId: string; isAdmin: boolean; ticketStatus: "open" | "in_progress" | "closed" }) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: queryError } = await supabase.from("support_replies")
      .select("id,sender_id,sender_role,message,created_at")
      .eq("ticket_id", ticketId).order("created_at", { ascending: true });
    if (queryError) setError("Unable to load this conversation.");
    else setReplies((data ?? []) as Reply[]);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => { void load(); }, [load]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = message.trim();
    if (!body || busy) return;
    setBusy(true); setError(""); setNotice("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Please sign in again."); setBusy(false); return; }
    const { data, error: insertError } = await supabase.from("support_replies").insert({
      ticket_id: ticketId, sender_id: user.id, sender_role: isAdmin ? "admin" : "customer", message: body
    }).select("id,sender_id,sender_role,message,created_at").single();
    if (insertError) setError(ticketStatus === "closed" && !isAdmin ? "This ticket is closed. Contact support to open a new request." : "Your reply could not be sent. Please try again.");
    else { setReplies(current => [...current, data as Reply]); setMessage(""); setNotice("Reply sent."); }
    setBusy(false);
  }

  return <div className="mt-5 border-t border-slate-100 pt-5">
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-900">Conversation</h3><button type="button" onClick={() => void load()} className="text-xs font-semibold text-teal-700 hover:underline">Refresh</button></div>
    {loading ? <p className="mt-3 text-sm text-slate-500">Loading conversation...</p> : replies.length === 0 ? <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No replies yet. Send a message to start the conversation.</p> : <div className="mt-3 space-y-3">{replies.map(reply => <div key={reply.id} className={"rounded-xl p-4 " + (reply.sender_role === (isAdmin ? "admin" : "customer") ? "bg-teal-50" : "bg-slate-50")}><div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-bold text-slate-700">{reply.sender_role === "admin" ? "NBJCreative Hub Support" : "Customer"}</p><time className="text-[11px] text-slate-400">{new Date(reply.created_at).toLocaleString()}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{reply.message}</p></div>)}</div>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-teal-700">{notice}</p>}
    {(isAdmin || ticketStatus !== "closed") ? <form onSubmit={send} className="mt-4 space-y-3"><label className="block text-xs font-semibold text-slate-600">Your reply<textarea required minLength={1} maxLength={5000} rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Write a reply..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal" /></label><button disabled={busy || !message.trim()} className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy ? "Sending..." : "Send reply"}</button></form> : <p className="mt-4 text-xs text-slate-500">This ticket is closed. You can still read the conversation.</p>}
  </div>;
}
