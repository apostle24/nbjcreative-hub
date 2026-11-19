"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Course = { id: string; title: string; currency: string };
type Payment = {
  id: string; reference: string; course_id: string; amount: number | string;
  currency: string; status: "pending" | "paid" | "failed"; created_at: string; paid_at: string | null;
};

export default function AcademyInstructorRevenuePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const db = createClient();
      const { data: { user } } = await db.auth.getUser();
      if (!user) {
        window.location.assign("/account?next=/academy/instructor/revenue");
        return;
      }
      const { data: owned, error: courseError } = await db
        .from("academy_courses").select("id,title,currency")
        .eq("instructor_id", user.id).order("created_at", { ascending: false });
      if (courseError) {
        if (active) { setError("We couldn't load your courses. Please refresh and try again."); setLoading(false); }
        return;
      }
      const ownCourses = (owned ?? []) as Course[];
      let paymentRows: Payment[] = [];
      if (ownCourses.length) {
        const { data, error: paymentError } = await db
          .from("academy_payment_transactions")
          .select("id,reference,course_id,amount,currency,status,created_at,paid_at")
          .in("course_id", ownCourses.map(course => course.id))
          .order("created_at", { ascending: false }).limit(500);
        if (paymentError) {
          if (active) { setError("We couldn't load course payment records. Please refresh and try again."); setLoading(false); }
          return;
        }
        paymentRows = (data ?? []) as Payment[];
      }
      if (active) { setCourses(ownCourses); setPayments(paymentRows); setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, []);

  const paid = payments.filter(payment => payment.status === "paid");
  const pending = payments.filter(payment => payment.status === "pending");
  const totals = useMemo(() => {
    const values: Record<string, number> = {};
    for (const payment of paid) values[payment.currency] = (values[payment.currency] ?? 0) + Number(payment.amount);
    return Object.entries(values).sort(([a], [b]) => a.localeCompare(b));
  }, [paid]);
  const courseNames = useMemo(() => Object.fromEntries(courses.map(course => [course.id, course.title])), [courses]);

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading revenue report...</main>;

  return <main className="min-h-screen bg-[#F5F7F8] px-5 py-10"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><Link href="/academy/instructor" className="text-sm font-bold text-teal-700">← Instructor Centre</Link><p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-teal-700">NBJ Academy · Instructor finance</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Course revenue</h1><p className="mt-2 text-sm text-slate-600">Review paid enrolments and payment activity across your courses.</p></div>
      <Link href="/academy/instructor" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">Manage courses</Link>
    </header>
    {error && <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    <section className="mt-7 grid gap-4 sm:grid-cols-3">
      <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Paid enrolments</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{paid.length}</p><p className="mt-1 text-xs text-slate-500">Confirmed course payments</p></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Pending payments</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{pending.length}</p><p className="mt-1 text-xs text-slate-500">Awaiting payment confirmation</p></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Courses created</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{courses.length}</p><p className="mt-1 text-xs text-slate-500">Including drafts and published courses</p></article>
    </section>
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-extrabold text-slate-900">Gross paid revenue</h2>
      <p className="mt-1 text-sm text-slate-500">Totals are grouped by currency. These are gross course payments, not instructor payouts.</p>
      {totals.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{totals.map(([currency, amount]) => <div key={currency} className="rounded-xl bg-slate-50 p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{currency}</p><p className="mt-2 text-2xl font-extrabold text-slate-900">{new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}</p></div>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No confirmed course payments yet.</p>}
    </section>
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-extrabold text-slate-900">Payment activity</h2><p className="mt-1 text-sm text-slate-500">Most recent payment records across your courses.</p></div><span className="text-xs text-slate-500">{payments.length} records · latest 500</span></div>
      {payments.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Payment records will appear here when students purchase your courses.</p> :
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Course</th><th className="px-3 py-3">Reference</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{payments.map(payment=><tr key={payment.id} className="border-b border-slate-100"><td className="px-3 py-4 font-semibold text-slate-800">{courseNames[payment.course_id] ?? "Course"}</td><td className="px-3 py-4 font-mono text-xs text-slate-500">{payment.reference}</td><td className="px-3 py-4 font-semibold text-slate-800">{payment.currency} {Number(payment.amount).toFixed(2)}</td><td className="px-3 py-4 text-slate-500">{new Date(payment.created_at).toLocaleDateString()}</td><td className="px-3 py-4"><span className={"rounded-full px-3 py-1.5 text-xs font-bold capitalize "+(payment.status==="paid"?"bg-emerald-50 text-emerald-700":payment.status==="pending"?"bg-amber-50 text-amber-800":"bg-rose-50 text-rose-700")}>{payment.status}</span></td></tr>)}</tbody></table></div>}
    </section>
    <p className="mt-5 text-xs leading-5 text-slate-500">This report displays gross paid transactions only. Platform fees, instructor balances, withdrawals and actual bank or mobile-money payouts will be added in a separate finance phase.</p>
  </div></main>;
}
