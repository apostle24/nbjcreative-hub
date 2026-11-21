"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { readCart } from "@/lib/cart";

type Order = { order_id: string; order_reference: string; order_amount: number | string; order_currency: string };
type Shipping = { full_name: string; phone: string; address_line1: string; address_line2: string; city: string; region: string; postal_code: string; country: string; instructions: string };
const emptyShipping: Shipping = { full_name: "", phone: "", address_line1: "", address_line2: "", city: "", region: "", postal_code: "", country: "", instructions: "" };

export default function CheckoutPage() {
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<{productId:string;quantity:number}[]>([]);
  const [hasPhysical, setHasPhysical] = useState(false);
  const [shipping, setShipping] = useState<Shipping>(emptyShipping);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const [{ data: { user } }, cart] = await Promise.all([supabase.auth.getUser(), Promise.resolve(readCart())]);
      if (!active) return;
      setEmail(user?.email ?? "");
      setItems(cart);
      if (cart.length) {
        const { data, error: productError } = await supabase.from("products").select("id,product_type")
          .in("id", cart.map(item => item.productId)).eq("status", "published");
        if (active && productError) setError("We couldn't verify the products in your cart. Please return to your cart and try again.");
        if (active && !productError) setHasPhysical((data ?? []).some(product => product.product_type === "physical"));
      }
      if (active) setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  function updateShipping(key: keyof Shipping, value: string) {
    setShipping(current => ({ ...current, [key]: value }));
  }

  async function startPayment() {
    if (!order) return;
    setPaying(true); setError("");
    try {
      const response = await fetch("/api/payments/paystack/initialize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderReference: order.order_reference })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not start payment.");
      window.location.assign(result.authorizationUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start payment.");
      setPaying(false);
    }
  }

  async function createOrder() {
    if (items.length === 0) {
      setError("Your cart is empty. Add a product before checkout.");
      return;
    }
    if (hasPhysical && (!shipping.full_name.trim() || !shipping.phone.trim() ||
      !shipping.address_line1.trim() || !shipping.city.trim() ||
      !shipping.region.trim() || !shipping.country.trim())) {
      setError("Please complete your name, phone, street address, city, region and country before continuing.");
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, shipping: hasPhysical ? shipping : {} })
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

  const fieldClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal";
  return <main className="min-h-screen bg-mist">
    <header className="bg-white border-b border-slate-100"><div className="container h-20 flex items-center justify-between"><Link href="/" className="font-extrabold tracking-tight text-ink">NBJCreative <span className="text-teal">Hub</span></Link><Link href="/cart" className="text-sm font-semibold text-slate-600 hover:text-teal"><ArrowLeft size={15} className="inline mr-2"/>Back to cart</Link></div></header>
    <div className="container max-w-2xl py-12 md:py-16">
      <p className="eyebrow mb-3">Secure order setup</p><h1 className="text-4xl font-extrabold tracking-tight text-ink">Checkout</h1>
      {loading && <p className="mt-8 rounded-2xl bg-white p-8 text-sm text-slate-500">Checking your account and cart...</p>}
      {!loading && !email && <section className="mt-8 rounded-2xl bg-white p-8"><h2 className="text-xl font-bold text-ink">Sign in to continue</h2><p className="mt-2 text-sm leading-6 text-slate-500">You need a customer account before we can create an order.</p><Link href="/account?next=/checkout" className="mt-6 inline-flex rounded-full bg-teal px-7 py-3.5 text-sm font-bold text-white">Sign in or create account</Link></section>}
      {!loading && email && error && !order && <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {!loading && email && !order && <section className="mt-8 rounded-2xl bg-white p-8">
        <div className="flex items-center gap-3"><LockKeyhole className="text-teal"/><div><h2 className="font-bold text-ink">Customer details</h2><p className="text-sm text-slate-500">{email}</p></div></div>
        <p className="mt-6 text-sm leading-6 text-slate-600">Your order will use current published prices stored securely by NBJCreative Hub. Payment is collected only through Paystack.</p>
        {hasPhysical && <div className="mt-7 border-t border-slate-100 pt-6">
          <div className="flex items-center gap-2"><Truck className="text-teal" size={19}/><h2 className="font-bold text-ink">Delivery address</h2></div>
          <p className="mt-1 text-xs leading-5 text-slate-500">Your cart contains a physical product. Provide where the seller should deliver it.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Full name<input required autoComplete="name" className={fieldClass} value={shipping.full_name} onChange={e=>updateShipping("full_name",e.target.value)}/></label>
            <label className="text-xs font-semibold text-slate-600">Phone number<input required autoComplete="tel" className={fieldClass} value={shipping.phone} onChange={e=>updateShipping("phone",e.target.value)}/></label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Street address<input required autoComplete="address-line1" className={fieldClass} value={shipping.address_line1} onChange={e=>updateShipping("address_line1",e.target.value)}/></label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Apartment, unit or landmark (optional)<input autoComplete="address-line2" className={fieldClass} value={shipping.address_line2} onChange={e=>updateShipping("address_line2",e.target.value)}/></label>
            <label className="text-xs font-semibold text-slate-600">City / town<input required autoComplete="address-level2" className={fieldClass} value={shipping.city} onChange={e=>updateShipping("city",e.target.value)}/></label>
            <label className="text-xs font-semibold text-slate-600">State / region<input required autoComplete="address-level1" className={fieldClass} value={shipping.region} onChange={e=>updateShipping("region",e.target.value)}/></label>
            <label className="text-xs font-semibold text-slate-600">Postal code (optional)<input autoComplete="postal-code" className={fieldClass} value={shipping.postal_code} onChange={e=>updateShipping("postal_code",e.target.value)}/></label>
            <label className="text-xs font-semibold text-slate-600">Country<input required autoComplete="country-name" className={fieldClass} value={shipping.country} onChange={e=>updateShipping("country",e.target.value)}/></label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Delivery instructions (optional)<textarea rows={2} className={fieldClass} value={shipping.instructions} onChange={e=>updateShipping("instructions",e.target.value)}/></label>
          </div>
        </div>}
        {items.length === 0 && <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Your cart is empty. Return to the cart and add a product first.</p>}
        {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button disabled={busy || items.length === 0} onClick={createOrder} className="mt-6 w-full rounded-full bg-ink px-7 py-4 text-sm font-bold text-white hover:bg-teal disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Creating order..." : "Create order"}</button>
      </section>}
      {!loading && order && <section className="mt-8 rounded-2xl bg-white p-8">
        <div className="text-sm font-bold text-teal">Order created</div><h2 className="mt-2 text-2xl font-extrabold text-ink">Order {order.order_reference}</h2>
        <p className="mt-3 text-sm text-slate-500">Amount recorded: <strong className="text-ink">{new Intl.NumberFormat("en", {style:"currency",currency:order.order_currency}).format(Number(order.order_amount))}</strong></p>
        <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">Continue to Paystack's secure checkout. Your order is marked paid only after the server verifies the transaction amount and currency.</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button onClick={startPayment} disabled={paying} className="mt-6 w-full rounded-full bg-teal px-7 py-4 text-sm font-bold text-white hover:bg-ink disabled:opacity-50">{paying ? "Connecting to Paystack..." : "Pay now with Paystack"}</button>
        <Link href="/#shop" className="mt-4 inline-flex text-sm font-semibold text-slate-500 hover:text-teal">Continue shopping</Link>
      </section>}
    </div>
  </main>;
}
