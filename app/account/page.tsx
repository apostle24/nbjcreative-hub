"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    const supabase = createClient();
    let destination = "/dashboard";

    if (typeof window !== "undefined") {
      const requested = new URLSearchParams(window.location.search).get("next");
      if (requested && requested.startsWith("/") && !requested.startsWith("//")) destination = requested;
    }

    if (mode === "signup") {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } }
      });
      if (authError) {
        setError(authError.message);
      } else if (data.session) {
        window.location.assign(destination);
        return;
      } else {
        setMessage("Your account has been created. Check your email for a confirmation link, then sign in to continue.");
      }
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        setError("We couldn't sign you in. Check your email and password.");
      } else {
        window.location.assign(destination);
        return;
      }
    }
    setBusy(false);
  }

  return <main className="min-h-screen bg-mist px-5 py-14">
    <div className="mx-auto max-w-md">
      <Link href="/" className="text-xl font-extrabold tracking-tight text-ink">NBJCreative <span className="text-teal">Hub</span></Link>
      <section className="mt-9 rounded-3xl border border-slate-100 bg-white p-8 shadow-soft">
        <p className="eyebrow">Customer account</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Sign in or create an account to continue with your order.</p>
        <div className="mt-6 grid grid-cols-2 rounded-full bg-mist p-1 text-sm font-bold">
          <button type="button" onClick={() => {setMode("signin");setError("");setMessage("");}} className={mode === "signin" ? "rounded-full bg-white py-2.5 text-ink shadow-sm" : "py-2.5 text-slate-500"}>Sign in</button>
          <button type="button" onClick={() => {setMode("signup");setError("");setMessage("");}} className={mode === "signup" ? "rounded-full bg-white py-2.5 text-ink shadow-sm" : "py-2.5 text-slate-500"}>Create account</button>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && <label className="block text-sm font-semibold text-slate-700">Full name<input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal" placeholder="Your full name"/></label>}
          <label className="block text-sm font-semibold text-slate-700">Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal" placeholder="you@example.com"/></label>
          <label className="block text-sm font-semibold text-slate-700">Password<input required type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal" placeholder="At least 8 characters"/></label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {message && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm leading-6 text-teal-800">{message}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-ink px-5 py-3.5 text-sm font-bold text-white hover:bg-teal disabled:opacity-60">{busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
      </section>
      <p className="mt-5 text-center text-sm"><Link href="/help" className="font-semibold text-teal hover:underline">Help Centre</Link><span className="mx-2 text-slate-300">·</span><Link href="/account/profile" className="font-semibold text-teal hover:underline">Profile & settings</Link><span className="mx-2 text-slate-300">·</span><Link href="/account/notifications" className="font-semibold text-teal hover:underline">Notifications</Link><span className="mx-2 text-slate-300">·</span><Link href="/account/support" className="font-semibold text-teal hover:underline">My support tickets</Link><span className="mx-2 text-slate-300">·</span><Link href="/account/wishlist" className="font-semibold text-teal hover:underline">View my wishlist</Link><span className="mx-2 text-slate-300">·</span><Link href="/account/work-applications" className="font-semibold text-teal hover:underline">My NBJ Work applications</Link><span className="mx-2 text-slate-300">·</span><Link href="/account/work-profile" className="font-semibold text-teal hover:underline">Professional profile & CV</Link><span className="mx-2 text-slate-300">·</span><Link href="/business" className="font-semibold text-teal hover:underline">NBJ Business workspace</Link><span className="mx-2 text-slate-300">·</span><Link href="/account/orders" className="font-semibold text-teal hover:underline">View my orders and downloads</Link></p><p className="mt-3 text-center text-xs text-slate-400"><Link href="/" className="text-teal hover:underline">Return to shop</Link></p>
    </div>
  </main>;
}
