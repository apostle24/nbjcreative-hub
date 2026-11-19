"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, ShoppingBag, Store, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type StoreItem = {
  store_name: string;
  store_slug: string;
  description: string | null;
  website_url: string | null;
  product_count: number;
};
type ProductItem = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  price: number | string;
  currency: string;
  cover_image_path: string | null;
  category: { name: string } | null;
};

export default function MarketplacePage() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const [storeResult, productResult] = await Promise.all([
        supabase.rpc("get_public_marketplace_stores"),
        supabase.from("products")
          .select("id,title,slug,summary,description,price,currency,cover_image_path,category:categories(name)")
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(48)
      ]);
      if (!active) return;
      if (storeResult.error || productResult.error) {
        setError("We couldn't load the marketplace right now. Please refresh and try again.");
      } else {
        setStores((storeResult.data ?? []) as StoreItem[]);
        setProducts((productResult.data ?? []) as unknown as ProductItem[]);
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const term = query.trim().toLowerCase();
  const filteredStores = useMemo(() => stores.filter(s =>
    (s.store_name + " " + (s.description ?? "")).toLowerCase().includes(term)
  ), [stores, term]);
  const filteredProducts = useMemo(() => products.filter(p =>
    (p.title + " " + (p.summary ?? "") + " " + (p.description ?? "") + " " + (p.category?.name ?? "")).toLowerCase().includes(term)
  ), [products, term]);
  const formatPrice = (price: number | string, currency: string) => {
    try { return new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(price)); }
    catch { return currency + " " + Number(price).toFixed(2); }
  };
  const coverUrl = (path: string | null) => path
    ? createClient().storage.from("product-covers").getPublicUrl(path).data.publicUrl
    : null;

  return (
    <main className="min-h-screen bg-[#F5F7F8]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="hidden text-sm font-semibold text-slate-600 sm:inline">Home</Link>
            <Link href="/cart" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-700"><ShoppingBag size={17}/> Cart</Link>
          </div>
        </div>
      </header>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-teal-700">Discover NBJCreative Hub</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">Explore the marketplace.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Discover useful digital products and browse independent seller stores, all in one place.</p>
          <div className="relative mt-8 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products and stores..." className="w-full rounded-full border border-slate-200 bg-white py-4 pl-12 pr-5 text-sm outline-none focus:border-teal-700"/>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-5 py-12 md:py-16">
        {error && <div className="rounded-2xl bg-white p-8 text-center text-sm text-rose-600">{error}</div>}
        {loading && <div className="rounded-2xl bg-white p-12 text-center text-sm text-slate-500">Loading marketplace...</div>}

        {!loading && !error && (
          <>
            <section>
              <div className="mb-7 flex items-end justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Seller community</p><h2 className="mt-2 text-2xl font-extrabold text-slate-900 md:text-3xl">Discover stores</h2></div>
                <span className="text-sm text-slate-500">{filteredStores.length} {filteredStores.length === 1 ? "store" : "stores"}</span>
              </div>
              {filteredStores.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <Store className="mx-auto text-slate-300" size={30}/>
                  <p className="mt-3 font-bold text-slate-800">{stores.length === 0 ? "Seller stores are coming soon" : "No stores match your search"}</p>
                  <p className="mt-2 text-sm text-slate-500">{stores.length === 0 ? "Approved seller stores will appear here as they join the marketplace." : "Try another store name or keyword."}</p>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredStores.map(store => (
                    <article key={store.store_slug} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E5F1EF] text-teal-800"><Store size={23}/></div>
                      <h3 className="mt-5 text-xl font-extrabold text-slate-900">{store.store_name}</h3>
                      <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{store.description || "Explore products from this independent seller."}</p>
                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                        <span className="text-xs font-semibold text-slate-500">{store.product_count} published {store.product_count === 1 ? "product" : "products"}</span>
                        <Link href={"/stores/" + store.store_slug} className="inline-flex items-center gap-1 text-sm font-bold text-teal-700 hover:underline">Visit store <ArrowUpRight size={15}/></Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-7 flex items-end justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">The catalogue</p><h2 className="mt-2 text-2xl font-extrabold text-slate-900 md:text-3xl">Browse products</h2></div>
                <span className="text-sm text-slate-500">{filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}</span>
              </div>
              {filteredProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No published products match your search yet.</div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {filteredProducts.map(product => {
                    const cover = coverUrl(product.cover_image_path);
                    return (
                      <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <Link href={"/products/" + product.slug} className="block">
                          <div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#DDECE9] to-white">
                            {cover ? <img src={cover} alt={product.title} className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center text-6xl text-teal-900/40">▤</div>}
                          </div>
                          <div className="p-5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">{product.category?.name ?? "Digital product"}</p>
                            <h3 className="mt-2 min-h-12 font-bold leading-6 text-slate-900">{product.title}</h3>
                            <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{product.summary || product.description || "A useful digital resource."}</p>
                            <p className="mt-4 text-lg font-extrabold text-slate-900">{formatPrice(product.price, product.currency)}</p>
                          </div>
                        </Link>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
        <div className="border-t border-slate-200 pt-6"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:underline"><ArrowLeft size={16}/> Back to home</Link></div>
      </div>
    </main>
  );
}
