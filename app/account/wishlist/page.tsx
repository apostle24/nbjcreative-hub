"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Heart, ShoppingBag, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addToCart } from "@/lib/cart";

type SavedProduct = {
  id: string;
  created_at: string;
  product: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    price: number | string;
    currency: string;
    cover_image_path: string | null;
    status: string;
  } | null;
};

export default function WishlistPage() {
  const [items, setItems] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function loadWishlist() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.assign("/account?next=" + encodeURIComponent("/account/wishlist"));
      return;
    }
    const { data, error: queryError } = await supabase
      .from("wishlist_items")
      .select("id,created_at,product:products(id,title,slug,summary,price,currency,cover_image_path,status)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
    if (queryError) setError("We couldn't load your wishlist. Please refresh and try again.");
    else setItems(((data ?? []) as unknown as SavedProduct[]).filter(item => item.product?.status === "published"));
    setLoading(false);
  }

  useEffect(() => { void loadWishlist(); }, []);

  async function removeItem(item: SavedProduct) {
    setBusyId(item.id);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("wishlist_items").delete().eq("id", item.id);
    if (deleteError) setError("We couldn't remove that item. Please try again.");
    else setItems(current => current.filter(saved => saved.id !== item.id));
    setBusyId("");
  }

  function coverUrl(path: string | null) {
    return path ? createClient().storage.from("product-covers").getPublicUrl(path).data.publicUrl : null;
  }

  function price(value: number | string, currency: string) {
    try { return new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(value)); }
    catch { return currency + " " + Number(value).toFixed(2); }
  }

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
        <Link href="/account" className="text-sm font-semibold text-slate-600">My account</Link>
      </div>
    </header>
    <div className="mx-auto max-w-5xl px-5 py-12 md:py-16">
      <Link href="/account" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:underline"><ArrowLeft size={16}/> Back to account</Link>
      <div className="mt-7 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-500"><Heart size={23}/></div>
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Customer space</p><h1 className="text-3xl font-extrabold tracking-tight text-slate-900">My Wishlist</h1></div>
      </div>
      <p className="mt-3 text-sm text-slate-500">Products you save for later will be kept here.</p>
      {error && <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {loading ? <div className="mt-8 rounded-2xl bg-white p-10 text-center text-sm text-slate-500">Loading your wishlist...</div> : items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <Heart size={32} className="mx-auto text-slate-300"/>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Your wishlist is empty</h2>
          <p className="mt-2 text-sm text-slate-500">Explore the marketplace and save products you may want later.</p>
          <Link href="/marketplace" className="mt-6 inline-flex rounded-full bg-teal-700 px-6 py-3 text-sm font-bold text-white hover:bg-teal-800">Explore marketplace</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {items.map(item => {
            const product = item.product;
            if (!product) return null;
            const cover = coverUrl(product.cover_image_path);
            return <article key={item.id} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4">
              <Link href={"/products/" + product.slug} className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-[#E5F1EF]">
                {cover ? <img src={cover} alt={product.title} className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center text-4xl text-teal-900/40">▤</div>}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={"/products/" + product.slug} className="font-bold leading-5 text-slate-900 hover:text-teal-700">{product.title}</Link>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{product.summary || "Digital product"}</p>
                <p className="mt-2 font-extrabold text-slate-900">{price(product.price, product.currency)}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button onClick={() => addToCart(product.id)} className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:underline"><ShoppingBag size={14}/> Add to cart</button>
                  <button onClick={() => removeItem(item)} disabled={busyId === item.id} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-600 disabled:opacity-50"><Trash2 size={14}/>{busyId === item.id ? "Removing..." : "Remove"}</button>
                </div>
              </div>
            </article>;
          })}
        </div>
      )}
      <div className="mt-10 border-t border-slate-200 pt-6"><Link href="/account/orders" className="text-sm font-semibold text-teal-700 hover:underline">View orders and downloads</Link></div>
    </div>
  </main>;
}
