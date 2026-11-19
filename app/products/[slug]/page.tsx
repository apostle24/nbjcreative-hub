"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, ShieldCheck, ShoppingBag, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addToCart } from "@/lib/cart";

type Product = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  price: number | string;
  currency: string;
  category: { name: string } | null;
  cover_image_path: string | null;
};

export default function ProductPage() {
  const params = useParams<{slug:string}>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadProduct() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id,title,slug,summary,description,price,currency,cover_image_path,category:categories(name)")
        .eq("slug", params.slug)
        .eq("status", "published")
        .maybeSingle();
      if (mounted) {
        if (!error && data) setProduct(data as unknown as Product);
        setLoading(false);
      }
    }
    loadProduct();
    return () => { mounted = false; };
  }, [params.slug]);

  const coverUrl = product?.cover_image_path ? createClient().storage.from("product-covers").getPublicUrl(product.cover_image_path).data.publicUrl : null;
  const formatPrice = (price: number | string, currency: string) =>
    new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(price));

  if (loading) return <main className="min-h-screen grid place-items-center p-8 text-sm text-slate-500">Loading product...</main>;
  if (!product) return <main className="min-h-screen grid place-items-center p-8"><div className="text-center"><h1 className="text-3xl font-bold text-ink">Product not found</h1><p className="mt-3 text-sm text-slate-500">This product may not be published yet.</p><Link className="mt-5 inline-block text-teal font-bold" href="/#shop">Return to the shop</Link></div></main>;

  return <main className="min-h-screen bg-mist">
    <header className="bg-white border-b border-slate-100"><div className="container h-20 flex items-center justify-between"><Link href="/" className="font-extrabold tracking-tight text-ink">NBJCreative <span className="text-teal">Hub</span></Link><Link href="/#shop" className="text-sm font-semibold text-slate-600"><ArrowLeft size={15} className="inline mr-2"/>Back to shop</Link></div></header>
    <div className="container py-12 md:py-20">
      <div className="grid lg:grid-cols-2 gap-12 items-start">
        <div className="rounded-[28px] bg-gradient-to-br from-[#DDECE9] to-white min-h-[380px] overflow-hidden grid place-items-center shadow-soft">{coverUrl ? <img src={coverUrl} alt={product.title} className="h-full min-h-[380px] w-full object-cover"/> : <span className="text-[130px] text-ink/70">▤</span>}</div>
        <div className="pt-2"><p className="eyebrow">{product.category?.name ?? "Digital product"} · Digital product</p><h1 className="mt-4 text-4xl md:text-5xl font-extrabold tracking-[-.05em] leading-tight text-ink">{product.title}</h1><p className="mt-6 text-base leading-7 text-slate-600">{product.description || product.summary}</p><div className="mt-7 flex items-center gap-4"><span className="text-3xl font-extrabold text-ink">{formatPrice(product.price, product.currency)}</span><span className="rounded-full bg-[#E2F1EE] px-3 py-1.5 text-xs font-bold text-teal">Available</span></div>
          <div className="mt-8 flex flex-wrap gap-3"><button onClick={() => { addToCart(product.id); setAdded(true); }} className="inline-flex items-center justify-center gap-2 rounded-full bg-teal px-8 py-4 text-sm font-bold text-white hover:bg-[#11696d]"><ShoppingBag size={17}/>{added ? "Added to cart" : "Add to cart"}</button><Link href="/cart" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-4 text-sm font-bold text-ink hover:border-teal">View cart</Link></div>
          <p className="mt-3 text-xs text-slate-400">Your cart is ready. Secure checkout and payment will be activated in the next stage.</p>
          <div className="mt-10 border-t border-slate-200 pt-7"><h2 className="text-lg font-bold text-ink">Product details</h2><p className="mt-4 text-sm leading-7 text-slate-600">{product.description || product.summary || "More product information will be available soon."}</p></div>
          <div className="mt-8 grid sm:grid-cols-2 gap-3"><div className="rounded-xl bg-white p-4 flex gap-3"><Download className="text-teal shrink-0"/><div><p className="text-sm font-bold text-ink">Digital format</p><p className="text-xs text-slate-500 mt-1">Designed for convenient access.</p></div></div><div className="rounded-xl bg-white p-4 flex gap-3"><ShieldCheck className="text-teal shrink-0"/><div><p className="text-sm font-bold text-ink">Clear product details</p><p className="text-xs text-slate-500 mt-1">Know what's included before buying.</p></div></div></div>
        </div>
      </div>
    </div>
  </main>;
}
