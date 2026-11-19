"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { readCart, removeFromCart, updateCartQuantity, type CartEntry } from "@/lib/cart";

type CartProduct = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  price: number | string;
  currency: string;
  cover_image_path: string | null;
};

type CartLine = CartProduct & { quantity: number };

export default function CartPage() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadCart() {
      const entries: CartEntry[] = readCart();
      if (!entries.length) {
        if (mounted) { setLines([]); setLoading(false); }
        return;
      }
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("products")
        .select("id,title,slug,summary,price,currency,cover_image_path")
        .in("id", entries.map(item => item.productId))
        .eq("status", "published");
      if (!mounted) return;
      if (queryError) {
        setError("We couldn't load your cart. Please refresh the page.");
        setLoading(false);
        return;
      }
      const products = (data ?? []) as CartProduct[];
      const validIds = new Set(products.map(item => item.id));
      const validEntries = entries.filter(item => validIds.has(item.productId));
      if (validEntries.length !== entries.length) {
        window.localStorage.setItem("nbjcreative_cart_v1", JSON.stringify(validEntries));
      }
      setLines(products.map(product => ({
        ...product,
        quantity: validEntries.find(item => item.productId === product.id)?.quantity ?? 1
      })));
      setLoading(false);
    }
    loadCart();
    return () => { mounted = false; };
  }, []);

  const totals = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const line of lines) grouped[line.currency] = (grouped[line.currency] ?? 0) + Number(line.price) * line.quantity;
    return Object.entries(grouped);
  }, [lines]);

  const coverUrl = (path: string | null) => path
    ? createClient().storage.from("product-covers").getPublicUrl(path).data.publicUrl
    : null;

  function changeQuantity(productId: string, quantity: number) {
    updateCartQuantity(productId, quantity);
    setLines(current => current
      .map(line => line.id === productId ? { ...line, quantity } : line)
      .filter(line => line.quantity > 0));
  }

  function removeItem(productId: string) {
    removeFromCart(productId);
    setLines(current => current.filter(line => line.id !== productId));
  }

  return <main className="min-h-screen bg-mist">
    <header className="bg-white border-b border-slate-100">
      <div className="container h-20 flex items-center justify-between">
        <Link href="/" className="font-extrabold tracking-tight text-ink">NBJCreative <span className="text-teal">Hub</span></Link>
        <Link href="/#shop" className="text-sm font-semibold text-slate-600 hover:text-teal"><ArrowLeft size={15} className="inline mr-2"/>Continue shopping</Link>
      </div>
    </header>
    <div className="container py-12 md:py-16">
      <p className="eyebrow mb-3">Your selection</p>
      <h1 className="text-4xl font-extrabold tracking-tight text-ink">Shopping cart</h1>
      <p className="mt-3 text-sm text-slate-500">Review your digital products before checkout.</p>

      {loading && <div className="mt-8 rounded-2xl bg-white p-10 text-center text-sm text-slate-500">Loading your cart...</div>}
      {!loading && error && <div className="mt-8 rounded-2xl bg-white p-10 text-center text-sm text-rose-600">{error}</div>}
      {!loading && !error && lines.length === 0 && <div className="mt-8 rounded-2xl bg-white p-12 text-center">
        <ShoppingBag size={38} className="mx-auto text-teal"/>
        <h2 className="mt-4 text-xl font-bold text-ink">Your cart is empty</h2>
        <p className="mt-2 text-sm text-slate-500">Explore the shop and add a resource you'd like to use.</p>
        <Link href="/#shop" className="mt-6 inline-flex rounded-full bg-teal px-7 py-3.5 text-sm font-bold text-white">Explore products</Link>
      </div>}
      {!loading && !error && lines.length > 0 && <div className="mt-9 grid lg:grid-cols-[1fr_340px] gap-7 items-start">
        <section className="grid gap-4">
          {lines.map(line => <article key={line.id} className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 flex flex-col sm:flex-row gap-5">
            <div className="h-28 w-full sm:w-32 shrink-0 overflow-hidden rounded-xl bg-mist">
              {line.cover_image_path ? <img src={coverUrl(line.cover_image_path) ?? ""} alt={line.title} className="h-full w-full object-cover"/> : <div className="h-full grid place-items-center text-4xl text-ink/60">▤</div>}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/products/${line.slug}`} className="font-bold text-ink hover:text-teal">{line.title}</Link>
              {line.summary && <p className="mt-1 text-xs leading-5 text-slate-500">{line.summary}</p>}
              <p className="mt-3 font-extrabold text-ink">{new Intl.NumberFormat("en", { style: "currency", currency: line.currency }).format(Number(line.price))}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-full border border-slate-200">
                  <button aria-label={`Decrease quantity for ${line.title}`} onClick={() => changeQuantity(line.id, line.quantity - 1)} className="p-2.5 text-slate-600 hover:text-teal"><Minus size={14}/></button>
                  <span className="min-w-8 text-center text-sm font-bold">{line.quantity}</span>
                  <button aria-label={`Increase quantity for ${line.title}`} onClick={() => changeQuantity(line.id, line.quantity + 1)} className="p-2.5 text-slate-600 hover:text-teal"><Plus size={14}/></button>
                </div>
                <button onClick={() => removeItem(line.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600"><Trash2 size={14}/>Remove</button>
              </div>
            </div>
            <div className="sm:text-right font-bold text-ink">{new Intl.NumberFormat("en", { style: "currency", currency: line.currency }).format(Number(line.price) * line.quantity)}</div>
          </article>)}
        </section>
        <aside className="rounded-2xl border border-slate-100 bg-white p-6">
          <h2 className="text-lg font-bold text-ink">Order summary</h2>
          <div className="mt-5 flex justify-between text-sm text-slate-500"><span>Items</span><span>{lines.reduce((sum, line) => sum + line.quantity, 0)}</span></div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            {totals.map(([currency, amount]) => <div key={currency} className="mb-2 flex justify-between gap-3 text-sm"><span className="text-slate-500">Subtotal ({currency})</span><strong className="text-ink">{new Intl.NumberFormat("en", { style: "currency", currency }).format(amount)}</strong></div>)}
          </div>
          <button disabled className="mt-6 w-full cursor-not-allowed rounded-full bg-slate-200 px-6 py-4 text-sm font-bold text-slate-500">Checkout coming next</button>
          <p className="mt-3 text-xs leading-5 text-slate-400">Your cart is saved on this device. Payments are not being collected yet.</p>
        </aside>
      </div>}
    </div>
  </main>;
}
