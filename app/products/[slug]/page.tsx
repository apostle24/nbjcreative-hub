"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, ShieldCheck, ShoppingBag, Heart } from "lucide-react";
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
  const [isSaved, setIsSaved] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [wishlistMessage, setWishlistMessage] = useState("");
  const [reviews, setReviews] = useState<Array<{id:string;rating:number;title:string;body:string;created_at:string}>>([]);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

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
        if (!error && data) {
          setProduct(data as unknown as Product);
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: saved } = await supabase.from("wishlist_items").select("id").eq("customer_id", user.id).eq("product_id", data.id).maybeSingle();
            if (mounted) setIsSaved(Boolean(saved));
          }
          const { data: reviewRows } = await supabase.from("product_reviews").select("id,rating,title,body,created_at").eq("product_id", data.id).eq("status", "published").order("created_at", { ascending: false });
          if (mounted) setReviews((reviewRows ?? []) as typeof reviews);
        }
        setLoading(false);
      }
    }
    loadProduct();
    return () => { mounted = false; };
  }, [params.slug]);

  async function toggleWishlist() {
    if (!product || wishlistBusy) return;
    setWishlistBusy(true);
    setWishlistMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.assign("/account?next=" + encodeURIComponent("/products/" + params.slug));
      return;
    }
    if (isSaved) {
      const { error } = await supabase.from("wishlist_items").delete().eq("customer_id", user.id).eq("product_id", product.id);
      if (error) setWishlistMessage("We couldn't remove this product. Please try again.");
      else setIsSaved(false);
    } else {
      const { error } = await supabase.from("wishlist_items").insert({ customer_id: user.id, product_id: product.id });
      if (error && error.code !== "23505") setWishlistMessage("We couldn't save this product. Please try again.");
      else setIsSaved(true);
    }
    setWishlistBusy(false);
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewBusy(true); setReviewError(""); setReviewMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.assign("/account?next=" + encodeURIComponent("/products/" + params.slug));
      return;
    }
    const { error } = await supabase.rpc("submit_product_review", {
      p_product_id: product?.id, p_rating: rating, p_title: reviewTitle, p_body: reviewBody
    });
    if (error) setReviewError(error.message);
    else {
      setReviewMessage("Thank you. Your review has been submitted and is awaiting moderation.");
      setReviewTitle(""); setReviewBody(""); setRating(5);
    }
    setReviewBusy(false);
  }

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
          <div className="mt-8 flex flex-wrap gap-3"><button onClick={() => { addToCart(product.id); setAdded(true); }} className="inline-flex items-center justify-center gap-2 rounded-full bg-teal px-8 py-4 text-sm font-bold text-white hover:bg-[#11696d]"><ShoppingBag size={17}/>{added ? "Added to cart" : "Add to cart"}</button><Link href="/cart" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-4 text-sm font-bold text-ink hover:border-teal">View cart</Link><button type="button" onClick={toggleWishlist} disabled={wishlistBusy} className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-4 text-sm font-bold text-ink hover:border-teal disabled:opacity-50"><Heart size={17} className={isSaved ? "fill-rose-500 text-rose-500" : ""}/>{wishlistBusy ? "Saving..." : isSaved ? "Saved" : "Save for later"}</button></div>{wishlistMessage && <p role="status" className="mt-3 text-xs text-rose-600">{wishlistMessage}</p>}
          <p className="mt-3 text-xs text-slate-400">Your cart is ready. Secure checkout and payment will be activated in the next stage.</p>
          <div className="mt-10 border-t border-slate-200 pt-7"><h2 className="text-lg font-bold text-ink">Product details</h2><p className="mt-4 text-sm leading-7 text-slate-600">{product.description || product.summary || "More product information will be available soon."}</p></div>
          <section className="mt-10 border-t border-slate-200 pt-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-lg font-bold text-ink">Customer reviews</h2><p className="mt-1 text-xs text-slate-500">{reviews.length} published review{reviews.length === 1 ? "" : "s"}</p></div>
              {reviews.length > 0 && <p className="text-sm font-bold text-amber-600">★ {(reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1)} / 5</p>}
            </div>
            <div className="mt-4 space-y-3">
              {reviews.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No published reviews yet. Be the first eligible customer to share feedback.</p> : reviews.map(review => <article key={review.id} className="rounded-xl bg-white p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-ink">{review.title}</h3><span className="text-sm text-amber-600">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{review.body}</p><p className="mt-2 text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString()}</p></article>)}
            </div>
            <form onSubmit={submitReview} className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-ink">Write a review</h3>
              <p className="mt-1 text-xs text-slate-500">Only customers with a completed purchase can submit a review. Reviews appear after approval.</p>
              <label className="mt-4 block text-sm font-semibold text-slate-700">Your rating</label>
              <select value={rating} onChange={e=>setRating(Number(e.target.value))} className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} star{n===1?"":"s"}</option>)}</select>
              <label className="mt-4 block text-sm font-semibold text-slate-700">Review title</label>
              <input required minLength={3} maxLength={120} value={reviewTitle} onChange={e=>setReviewTitle(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Summarise your experience"/>
              <label className="mt-4 block text-sm font-semibold text-slate-700">Your review</label>
              <textarea required minLength={10} maxLength={3000} rows={4} value={reviewBody} onChange={e=>setReviewBody(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="What did you think of this product?"/>
              {reviewError && <p role="alert" className="mt-3 text-sm text-rose-600">{reviewError}</p>}
              {reviewMessage && <p role="status" className="mt-3 text-sm text-teal-700">{reviewMessage}</p>}
              <button disabled={reviewBusy} className="mt-4 rounded-full bg-teal px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{reviewBusy ? "Submitting..." : "Submit review"}</button>
            </form>
          </section>
          <div className="mt-8 grid sm:grid-cols-2 gap-3"><div className="rounded-xl bg-white p-4 flex gap-3"><Download className="text-teal shrink-0"/><div><p className="text-sm font-bold text-ink">Digital format</p><p className="text-xs text-slate-500 mt-1">Designed for convenient access.</p></div></div><div className="rounded-xl bg-white p-4 flex gap-3"><ShieldCheck className="text-teal shrink-0"/><div><p className="text-sm font-bold text-ink">Clear product details</p><p className="text-xs text-slate-500 mt-1">Know what's included before buying.</p></div></div></div>
        </div>
      </div>
    </div>
  </main>;
}
