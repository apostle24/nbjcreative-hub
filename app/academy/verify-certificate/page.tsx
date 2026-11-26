"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Verification = {
  certificate_number: string;
  issued_at: string;
  course_title: string;
};

export default function VerifyAcademyCertificatePage() {
  const [number, setNumber] = useState("");
  const [result, setResult] = useState<Verification | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const certificateNumber = number.trim().toUpperCase();
    if (!certificateNumber) return;
    setBusy(true);
    setError("");
    setResult(null);
    setChecked(false);
    const { data, error: queryError } = await createClient().rpc(
      "verify_academy_certificate",
      { p_certificate_number: certificateNumber }
    );
    if (queryError) {
      setError("Verification is temporarily unavailable. Please try again later.");
    } else {
      const match = Array.isArray(data) ? data[0] : null;
      setResult(match ?? null);
      setChecked(true);
    }
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-[#F5F7F8] px-5 py-12">
      <div className="mx-auto max-w-xl">
        <Link href="/academy" className="text-sm font-bold text-teal-700">← NBJ Academy</Link>
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Academy</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Verify a certificate</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Enter the certificate number to confirm whether an NBJ Academy certificate is authentic.
          </p>
          <form onSubmit={verify} className="mt-7 space-y-3">
            <label htmlFor="certificate-number" className="block text-sm font-bold text-slate-800">Certificate number</label>
            <input
              id="certificate-number"
              value={number}
              onChange={event => setNumber(event.target.value)}
              placeholder="e.g. NBJ-XXXXXXXXXXXX"
              autoComplete="off"
              maxLength={40}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm uppercase outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
            <button type="submit" disabled={busy || !number.trim()} className="w-full rounded-xl bg-teal-700 px-5 py-3 font-bold text-white disabled:opacity-50">
              {busy ? "Checking certificate..." : "Verify certificate"}
            </button>
          </form>
          {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
          {checked && !result && <div role="status" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-5"><p className="font-bold text-rose-800">Certificate not found</p><p className="mt-1 text-sm text-rose-700">No matching NBJ Academy certificate was found. Check the number and try again.</p></div>}
          {result && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Authentic NBJ Academy certificate</p>
            <p className="mt-2 text-xl font-extrabold text-emerald-900">Certificate verified</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-emerald-700">Certificate number</dt><dd className="font-bold text-emerald-950">{result.certificate_number}</dd></div>
              <div><dt className="text-emerald-700">Course</dt><dd className="font-bold text-emerald-950">{result.course_title}</dd></div>
              <div><dt className="text-emerald-700">Date issued</dt><dd className="font-bold text-emerald-950">{new Date(result.issued_at).toLocaleDateString()}</dd></div>
            </dl>
          </div>}
        </section>
        <p className="mt-5 text-center text-xs text-slate-500">Verification confirms the certificate record only. Personal student information is not displayed.</p>
      </div>
    </main>
  );
}
