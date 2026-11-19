"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Ticket = { id:string; customer_id:string|null; customer_email:string; subject:string; message:string; status:"open"|"in_progress"|"closed"; created_at:string; updated_at:string };

export default function AdminSupportPage() {
  const [tickets,setTickets] = useState<Ticket[]>([]);
  const [filter,setFilter] = useState("open");
  const [loading,setLoading] = useState(true);
  const [authorized,setAuthorized] = useState(false);
  const [busyId,setBusyId] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const {data,error:queryError} = await supabase.from("support_messages")
      .select("id,customer_id,customer_email,subject,message,status,created_at,updated_at")
      .order("created_at",{ascending:false});
    if(queryError) throw queryError;
    setTickets((data ?? []) as Ticket[]);
  },[]);

  useEffect(() => {
    let active = true;
    async function init() {
      const supabase = createClient();
      const {data:{user}} = await supabase.auth.getUser();
      if(!user){window.location.assign("/admin/login");return;}
      const {data:profile,error:profileError} = await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
      if(!active)return;
      if(profileError || profile?.role!=="admin"){setError("Administrator access is required.");setLoading(false);return;}
      setAuthorized(true);
      try{await load();}catch(e){setError(e instanceof Error?e.message:"Could not load support requests.");}
      if(active)setLoading(false);
    }
    init();
    return()=>{active=false;};
  },[load]);

  async function changeStatus(ticket:Ticket,status:Ticket["status"]) {
    setBusyId(ticket.id);setError("");setNotice("");
    const supabase=createClient();
    const {data,error:updateError}=await supabase.from("support_messages")
      .update({status}).eq("id",ticket.id)
      .select("id,status").maybeSingle();
    if(updateError || !data || data.status!==status) {
      setError(updateError?.message || "The status change was not confirmed.");
    } else {
      setTickets(current=>current.map(item=>item.id===ticket.id?{...item,status}:item));
      setNotice("Request updated to "+status+".");
    }
    setBusyId("");
  }

  const visible=useMemo(()=>filter==="all"?tickets:tickets.filter(t=>t.status===filter),[tickets,filter]);
  if(loading)return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Checking administrator access...</main>;
  if(!authorized)return <main className="min-h-screen grid place-items-center p-6"><div className="rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-xl font-bold">Administrator access required</h1><p className="mt-3 text-sm text-slate-600">{error}</p><Link href="/admin/login" className="mt-5 inline-block text-sm font-bold text-teal-700">Admin login</Link></div></main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><div><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><p className="mt-1 text-xs text-slate-500">Customer support</p></div><Link href="/admin" className="text-sm font-semibold text-teal-700">← Admin dashboard</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-9">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Customer care</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Support inbox</h1><p className="mt-2 text-sm text-slate-500">Review customer requests and track their progress.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">{(["open","in_progress","closed"] as const).map(s=><div key={s} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs capitalize text-slate-500">{s.replace("_"," ")}</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{tickets.filter(t=>t.status===s).length}</p></div>)}</div>
      <div className="mt-7 flex flex-wrap gap-2">{["open","in_progress","closed","all"].map(s=><button key={s} onClick={()=>setFilter(s)} className={"rounded-full px-4 py-2 text-xs font-bold capitalize "+(filter===s?"bg-slate-900 text-white":"border border-slate-200 bg-white text-slate-600")}>{s.replace("_"," ")}</button>)}<button onClick={()=>load().catch(e=>setError(e.message))} className="ml-auto rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold">Refresh</button></div>
      {error&&<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice&&<p role="status" className="mt-5 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{notice}</p>}
      <section className="mt-5 space-y-4">{visible.length===0?<div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">No {filter==="all"?"":filter.replace("_"," ")+" "}support requests.</div>:visible.map(ticket=><article key={ticket.id} className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{ticket.subject}</h2><p className="mt-1 text-xs text-slate-500">{ticket.customer_email} · {new Date(ticket.created_at).toLocaleString()}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{ticket.status.replace("_"," ")}</span></div>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.message}</p>
        <div className="mt-5 flex flex-wrap gap-2">{ticket.status!=="open"&&<button disabled={!!busyId} onClick={()=>changeStatus(ticket,"open")} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Mark open</button>}{ticket.status!=="in_progress"&&<button disabled={!!busyId} onClick={()=>changeStatus(ticket,"in_progress")} className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Mark in progress</button>}{ticket.status!=="closed"&&<button disabled={!!busyId} onClick={()=>changeStatus(ticket,"closed")} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Close request</button>}</div>
      </article>)}</section>
    </div>
  </main>;
}
