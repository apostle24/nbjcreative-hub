"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, Save, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function CustomerProfilePage() {
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !user) {
        window.location.assign("/account?next=/account/profile");
        return;
      }
      setUserId(user.id);
      setEmail(user.email || "");
      setNewEmail(user.email || "");
      const { data, error: profileError } = await supabase.from("profiles")
        .select("full_name, phone_number, email").eq("id", user.id).maybeSingle();
      if (!active) return;
      if (profileError) setError("We couldn't load your profile details.");
      else {
        setName(data?.full_name || String(user.user_metadata?.full_name || ""));
        setPhone(data?.phone_number || "");
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const supabase = createClient();
    const { error: saveError } = await supabase.from("profiles")
      .update({ full_name: name.trim(), phone_number: phone.trim() || null })
      .eq("id", userId);
    if (saveError) setError(saveError.message || "Your profile could not be saved.");
    else setMessage("Your profile details have been saved.");
    setBusy(false);
  }

  async function changeEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newEmail.trim() || newEmail.trim().toLowerCase() === email.toLowerCase()) {
      setError("Enter a different email address.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (updateError) setError(updateError.message);
    else setMessage("Check your new email inbox and follow the confirmation link. Your account email changes after confirmation.");
    setBusy(false);
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) { setError("Use a password with at least 8 characters."); return; }
    setBusy(true); setError(""); setMessage("");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else { setPassword(""); setMessage("Your password has been updated."); }
    setBusy(false);
  }

  async function signOut() {
    setBusy(true); setError("");
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) { setError(signOutError.message); setBusy(false); }
    else window.location.assign("/account");
  }

  return <main className="min-h-screen bg-mist">
    <header className="border-b border-slate-100 bg-white"><div className="container flex h-20 items-center justify-between">
      <Link href="/" className="font-extrabold tracking-tight text-ink">NBJCreative <span className="text-teal">Hub</span></Link>
      <Link href="/account" className="text-sm font-semibold text-slate-600 hover:text-teal"><ArrowLeft size={15} className="mr-2 inline"/>Account</Link>
    </div></header>
    <div className="container max-w-3xl py-12 md:py-16">
      <p className="eyebrow mb-3">Customer space</p>
      <h1 className="text-4xl font-extrabold tracking-tight text-ink">Profile & settings</h1>
      <p className="mt-2 text-sm text-slate-500">Manage your contact details and account security.</p>
      {error && <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="mt-6 rounded-xl bg-teal-50 p-4 text-sm text-teal-800">{message}</p>}
      {loading ? <p className="mt-8 rounded-2xl bg-white p-8 text-sm text-slate-500">Loading your profile...</p> : <>
        <section className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-extrabold text-ink">Personal details</h2>
          <form onSubmit={saveProfile} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">Full name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal"/></label>
            <label className="block text-sm font-semibold text-slate-700">Phone number<input type="tel" maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+233..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal"/></label>
            <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white hover:bg-teal disabled:opacity-50"><Save size={16}/>Save details</button>
          </form>
        </section>
        <section className="mt-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-extrabold text-ink">Email address</h2><p className="mt-1 text-sm text-slate-500">Current email: {email}</p>
          <form onSubmit={changeEmail} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">New email address<input required type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal"/></label>
            <button disabled={busy} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-ink hover:border-teal disabled:opacity-50">Request email change</button>
          </form>
          <p className="mt-3 text-xs text-slate-400">You'll need to confirm the change using the email confirmation message.</p>
        </section>
        <section className="mt-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-center gap-2"><ShieldCheck size={19} className="text-teal"/><h2 className="text-xl font-extrabold text-ink">Password & security</h2></div>
          <form onSubmit={changePassword} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">New password<input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal"/></label>
            <button disabled={busy} className="rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white hover:bg-teal disabled:opacity-50">Update password</button>
          </form>
        </section>
        <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div><h2 className="font-extrabold text-ink">Sign out</h2><p className="mt-1 text-sm text-slate-500">Securely end your current session on this device.</p></div>
          <button onClick={signOut} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-5 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><LogOut size={16}/>Sign out</button>
        </section>
      </>}
    </div>
  </main>;
}
