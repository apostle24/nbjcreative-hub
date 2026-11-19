"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { readCart } from "@/lib/cart";

type Order = { order_id: string; order_reference: string; order_amount: number | string; order_currency: string };

export default function CheckoutPage() {
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<{productId:string;quantity:number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const [{ data: { user } }, cart] = await Promise.all([supabase.auth.getUser(), Promise.resolve(readCart())]);
      if (!active) return;
      setEmail(user?.email ?? "");
      setItems(cart);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  async function createOrder() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Order could not be created.");
      setOrder(result.order as Order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-mist">
    <header className="bg-white border-b border-slate-100"><div className="container h-20 flex items-center justify-between"><Link href="/" className="font-extrabold tracking-tight text-ink">NBJCreative <span className="text-teal">Hub</span></Link><Link href="/cart" className="text-sm font-semibold text-slate-600 hover:text-teal"><ArrowLeft size={15} className="inline mr-2"/>Back to cart</Link></div></header>
    <div className="container max-w-2xl py-12 md:py-16">
      <p className="eyebrow mb-3">Secure order setup</p><h1 className="text-4xl font-extrabold tracking-tight text-ink">Checkout</h1>
      {loading && <p className="mt-8 rounded-2xl bg-white p-8 text-sm text-slate-500">Checking your account and cart...</p>}
      {!loading && !email && <section className="mt-8 rounded-2xl bg-white p-8"><h2 className="text-xl font-bold text-ink">Sign in to continue</h2><p className="mt-2 text-sm leading-6 text-slate-500">You need a customer account before we can create an order.</p><Link href="/account?next=/checkout" className="mt-6 inline-flex rounded-full bg-teal px-7 py-3.5 text-sm font-bold text-white">Sign in or create account</Link></section>}
      {!loading && email && !order && <section className="mt-8 rounded-2xl bg-white p-8">
        <div className="flex items-center gap-3"><LockKeyhole className="text-teal"/><div><h2 className="font-bold text-ink">Customer details</h2><p className="text-sm text-slate-500">{email}</p></div></div>
        <p className="mt-6 text-sm leading-6 text-slate-600">We will create a pending order using the current published product prices stored in NBJCreative Hub. No payment will be taken at this step.</p>
        {items.length === 0 && <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Your cart is empty. Return to the cart and add a product first.</p>}
        {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button disabled={busy || items.length === 0} onClick={createOrder} className="mt-6 w-full rounded-full bg-ink px-7 py-4 text-sm font-bold text-white hover:bg-teal disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Creating order..." : "Create pending order"}</button>
      </section>}
      {!loading && order && <section className="mt-8 rounded-2xl bg-white p-8">
        <div className="text-sm font-bold text-teal">Pending order created</div><h2 className="mt-2 text-2xl font-extrabold text-ink">Order {order.order_reference}</h2>
        <p className="mt-3 text-sm text-slate-500">Amount recorded: <strong className="text-ink">{new Intl.NumberFormat("en", {style:"currency",currency:order.order_currency}).format(Number(order.order_amount))}</strong></p>
        <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">This is an order record only. Paystack checkout has not been connected, so no payment has been collected and no downloads are available yet.</p>
        <Link href="/#shop" className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">Continue shopping</Link>
      </section>}
    </div>
  </main>;
}
