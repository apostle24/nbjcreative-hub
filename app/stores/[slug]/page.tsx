"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, ShoppingBag, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addToCart } from "@/lib/cart";

type StoreInfo = {
  store_name: string;
  store_slug: string;
  description: string | null;
  website_url: string | null;
};
type StoreProduct = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  price: number | string;
  currency: string;
  cover_image_path: string | null;
  category: string | null;
};
type StoreResponse = { store: StoreInfo; products: StoreProduct[] };

export default function PublicVendorStorePage() {
  const params = useParams<{ slug: string }>();
  const [data, setData] = useState<StoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addedId, setAddedId] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: result, error: rpcError } = await supabase.rpc(
        "get_public_vendor_store",
        { p_store_slug: params.slug }
      );
      if (!active) return;
      if (rpcError) setError("We couldn't load this store right now. Please try again later.");
      else if (result) setData(result as StoreResponse);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [params.slug]);

  const supabase = useMemo(() => createClient(), []);
  const formatPrice = (price: number | string, currency: string) => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(price));
    } catch {
      return currency + " " + Number(price).toFixed(2);
    }
  };

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading store...</main>;

  if (!data) return (
    <main className="min-h-screen grid place-items-center bg-[#F5F7F8] px-5">
      <div className="max-w-md rounded-3xl bg-white p-9 text-center shadow-sm">
        <Store className="mx-auto text-teal-700" size={34}/>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Store unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{error || "This store may not be approved or may not exist."}</p>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 font-bold text-teal-700"><ArrowLeft size={16}/> Back to NBJCreative Hub</Link>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#F5F7F8]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
          <Link href="/cart" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-700"><ShoppingBag size={17}/> Cart</Link>
        </div>
      </header>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14 md:py-20">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-teal-700">Independent seller store</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">{data.store.store_name}</h1>
              <p className="mt-4 text-base leading-7 text-slate-600">{data.store.description || "Explore products available from this NBJCreative Hub seller."}</p>
            </div>
            {data.store.website_url && <a href={data.store.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:border-teal-700 hover:text-teal-700">Visit seller website <ExternalLink size={15}/></a>}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Store catalogue</p><h2 className="mt-2 text-2xl font-extrabold text-slate-900">Available products</h2></div>
          <p className="text-sm text-slate-500">{data.products.length} {data.products.length === 1 ? "product" : "products"}</p>
        </div>
        {data.products.length === 0 ? (
          <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Store className="mx-auto text-slate-300" size={32}/>
            <h3 className="mt-4 font-bold text-slate-800">No published products yet</h3>
            <p className="mt-2 text-sm text-slate-500">This seller's products will appear here after they are approved and published.</p>
          </div>
        ) : (
          <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.products.map(product => {
              const cover = product.cover_image_path
                ? supabase.storage.from("product-covers").getPublicUrl(product.cover_image_path).data.publicUrl
                : null;
              return (
                <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-lg">
                  <Link href={"/products/" + product.slug} className="block">
                    <div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#DDECE9] to-white">
                      {cover ? <img src={cover} alt={product.title} className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center text-6xl text-teal-900/40">▤</div>}
                    </div>
                    <div className="p-5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">{product.category || "Digital product"}</p>
                      <h3 className="mt-2 text-lg font-bold text-slate-900">{product.title}</h3>
                      <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{product.summary || product.description || "View product details."}</p>
                      <p className="mt-4 text-xl font-extrabold text-slate-900">{formatPrice(product.price, product.currency)}</p>
                    </div>
                  </Link>
                  <div className="px-5 pb-5">
                    <button onClick={() => { addToCart(product.id); setAddedId(product.id); }} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700">
                      {addedId === product.id ? "Added to cart" : "Add to cart"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <div className="mt-12 border-t border-slate-200 pt-6"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:underline"><ArrowLeft size={16}/> Back to NBJCreative Hub marketplace</Link></div>
      </section>
    </main>
  );
}
