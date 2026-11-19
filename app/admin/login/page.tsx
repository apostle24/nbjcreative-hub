"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError("Login failed. Check your email and password, then try again.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-16">
    <div className="mx-auto max-w-md">
      <Link href="/" className="text-xl font-extrabold tracking-tight text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
      <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Administrator access</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Sign in with the administrator account assigned to NBJCreative Hub.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block"><span className="text-sm font-semibold text-slate-700">Email address</span><input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600" placeholder="admin@example.com"/></label>
          <label className="block"><span className="text-sm font-semibold text-slate-700">Password</span><input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600" placeholder="Your password"/></label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-60">{busy ? "Signing in..." : "Sign in to dashboard"}</button>
        </form>
      </section>
      <p className="mt-6 text-center text-xs text-slate-400">Authorised administrators only · <Link href="/" className="text-teal-700 hover:underline">Return to shop</Link></p>
    </div>
  </main>;
}
