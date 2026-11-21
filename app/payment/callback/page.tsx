"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clearCart } from "@/lib/cart";

export default function PaymentCallbackPage() {
  const [state, setState] = useState("checking");
  const [message, setMessage] = useState("Verifying your payment securely with Paystack...");
  const [successHref, setSuccessHref] = useState("/account");
  const [successLabel, setSuccessLabel] = useState("Go to my account");
  useEffect(() => {
    let active = true;
    async function verify() {
      const reference = new URLSearchParams(window.location.search).get("reference") || "";
      if (!reference) { setState("error"); setMessage("No payment reference was provided."); return; }
      try {
        const response = await fetch("/api/payments/paystack/verify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Payment verification failed.");
        if (active) {
          setState("success");
          if (result.type === "academy" && result.courseSlug) {
            setSuccessHref("/academy/course/" + result.courseSlug);
            setSuccessLabel("Start learning");
            setMessage("Your course payment is confirmed. You are now enrolled and can access all course lessons.");
          } else {
            if (result.orderReference) clearCart();
            setMessage("Payment confirmed for order " + result.orderReference + ". Your order is now marked as paid.");
          }
        }
      } catch (error) {
        if (active) { setState("error"); setMessage(error instanceof Error ? error.message : "Payment verification failed."); }
      }
    }
    verify();
    return () => { active = false; };
  }, []);
  return <main className="min-h-screen bg-mist"><div className="container max-w-xl py-20"><section className="rounded-3xl bg-white p-8 shadow-sm">
    <p className="eyebrow">NBJCreative Hub · Payment</p>
    <h1 className="mt-3 text-3xl font-extrabold text-ink">{state === "checking" ? "Checking payment" : state === "success" ? "Payment successful" : "Payment not confirmed"}</h1>
    <p className="mt-4 text-sm leading-7 text-slate-600">{message}</p>
    {state === "error" && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">If you completed payment, contact support with your Paystack reference. Do not pay again until it is checked.</p>}
    <Link href={successHref} className="mt-7 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">{state === "success" ? successLabel : "Go to my account"}</Link>
  </section></div></main>;
}
