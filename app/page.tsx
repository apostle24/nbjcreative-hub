"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowRight, Search, ShoppingBag, Menu, X, Sparkles, Download, ShieldCheck, Globe2, ChevronRight, BriefcaseBusiness, GraduationCap, Store, Building2, LayoutDashboard } from "lucide-react";

const categoryPresentation = [
  { name: "Business", detail: "Build and grow with confidence", icon: "↗", color: "bg-[#E9F3EF]", count: "Business plans, finance tools & templates" },
  { name: "Design & Creative", detail: "Make your ideas stand out", icon: "✳", color: "bg-[#F3ECFA]", count: "Brand kits, graphics & presentation assets" },
  { name: "Technology", detail: "Tools for builders and creators", icon: "⌘", color: "bg-[#EAF1FA]", count: "Code, website templates & developer resources" },
  { name: "Education", detail: "Learn something that moves you forward", icon: "▤", color: "bg-[#FFF3E7]", count: "Guides, workbooks & learning resources" },
  { name: "Career", detail: "Take your next professional step", icon: "◎", color: "bg-[#E8F4F5]", count: "CVs, portfolios & interview resources" },
  { name: "Lifestyle", detail: "Make everyday life work better", icon: "♡", color: "bg-[#FCEEF0]", count: "Planners, journals & trackers" },
  { name: "Media & Assets", detail: "Creative assets for your projects", icon: "▶", color: "bg-[#F0F1F5]", count: "Photos, video, audio & digital art" },
  { name: "Faith", detail: "Resources for spiritual growth", icon: "✧", color: "bg-[#F8F1E6]", count: "Devotionals, journals & ministry resources" }
];

type Category = { id: string; name: string; slug: string; description: string | null; sort_order: number };
type SpotlightBusiness = { business_name: string; business_slug: string; description: string | null; industry: string | null; country: string | null; city: string | null; offerings_count: number };
type CatalogueProduct = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  price: number | string;
  currency: string;
  category: { name: string } | null;
  cover_image_path: string | null;
  product_type: "physical" | "digital" | "online_service";
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("All");
  const [menuOpen, setMenuOpen] = useState(false);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [spotlightBusinesses, setSpotlightBusinesses] = useState<SpotlightBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadCatalogue() {
      try {
        const supabase = createClient();
        const [categoryResult, productResult, businessResult] = await Promise.all([
          supabase.from("categories").select("id,name,slug,description,sort_order").eq("is_active", true).order("sort_order"),
          supabase.from("products").select("id,title,slug,summary,description,price,currency,featured,cover_image_path,product_type,category:categories(name)").eq("status", "published").order("created_at", { ascending: false }),
          supabase.rpc("get_public_business_directory")
        ]);
        if (categoryResult.error) throw categoryResult.error;
        if (productResult.error) throw productResult.error;
        if (mounted) {
          setCategories((categoryResult.data ?? []) as Category[]);
          setProducts((productResult.data ?? []) as unknown as CatalogueProduct[]);
          if (!businessResult.error) {
            const ranked = ((businessResult.data ?? []) as SpotlightBusiness[]).filter(b => Number(b.offerings_count) > 0);
            setSpotlightBusinesses(ranked.slice(0, 3));
          }
        }
      } catch {
        if (mounted) setCatalogueError("We couldn't load the shop right now. Please refresh the page.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadCatalogue();
    return () => { mounted = false; };
  }, []);

  const visibleCategories = (categories.length ? categories : categoryPresentation.map((item, index) => ({ id: item.name, name: item.name, slug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), description: item.detail, sort_order: index }))).map(category => {
    const presentation = categoryPresentation.find(item => item.name === category.name);
    return {
      ...presentation,
      ...category,
      detail: presentation?.detail ?? category.description ?? "",
      icon: presentation?.icon ?? "◇",
      color: presentation?.color ?? "bg-[#F0F1F5]",
      count: presentation?.count ?? "Explore digital resources"
    };
  });
  const visibleProducts = useMemo(() => products.filter(p => {
    const categoryName = p.category?.name ?? "";
    return (active === "All" || categoryName === active) &&
      (p.title + categoryName + (p.summary ?? "") + (p.description ?? "")).toLowerCase().includes(query.toLowerCase());
  }), [products, active, query]);
  const getCoverUrl = (path: string | null) => path ? createClient().storage.from("product-covers").getPublicUrl(path).data.publicUrl : null;
  const formatPrice = (price: number | string, currency: string) =>
    new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(price));

  return <main>
    <div className="bg-ink text-white text-center text-xs py-2.5 px-4">A global platform to create, learn, earn, work and grow. <span className="text-teal-200 font-semibold">Discover NBJCreative Hub →</span></div>
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="container h-[76px] flex items-center justify-between gap-6">
        <a href="#" className="flex items-center gap-2.5 shrink-0">
          <span className="w-9 h-9 rounded-xl bg-ink text-white grid place-items-center font-black text-lg">N</span>
          <span className="leading-tight"><strong className="block tracking-[-.04em] text-[17px]">NBJCreative <span className="text-teal">Hub</span></strong><small className="text-[9px] tracking-[.18em] text-slate-400 font-bold">CREATE · LEARN · EARN · WORK · GROW</small></span>
        </a>
        <nav className="hidden lg:flex items-center gap-7 text-[13px] font-semibold text-slate-600">
          <Link className="text-ink" href="/marketplace">Marketplace</Link><Link href="/work" className="hover:text-teal">Work</Link><Link href="/academy" className="hover:text-teal">Academy</Link><Link href="/business" className="hover:text-teal">Business</Link><Link href="/businesses" className="hover:text-teal">Discover businesses</Link><Link href="/vendor" className="hover:text-teal">Sell with us</Link>
        </nav>
        <div className="hidden md:flex items-center gap-4"><Link href="/cart" aria-label="Shopping cart" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal"><ShoppingBag size={17}/> Cart</Link><Link href="/dashboard" className="rounded-full bg-ink px-5 py-3 text-white text-sm font-bold hover:bg-teal">My Dashboard <ArrowRight size={15} className="inline ml-1"/></Link></div>
        <button className="lg:hidden p-2" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
      </div>
      {menuOpen && <div className="lg:hidden border-t px-5 py-4 grid gap-4 text-sm font-semibold"><Link href="/marketplace" onClick={()=>setMenuOpen(false)}>Marketplace</Link><Link href="/work" onClick={()=>setMenuOpen(false)}>NBJ Work</Link><Link href="/academy" onClick={()=>setMenuOpen(false)}>NBJ Academy</Link><Link href="/vendor" onClick={()=>setMenuOpen(false)}>Vendor Centre</Link><Link href="/business" onClick={()=>setMenuOpen(false)}>NBJ Business workspace</Link><Link href="/businesses" onClick={()=>setMenuOpen(false)}>Discover businesses</Link><Link href="/dashboard" onClick={()=>setMenuOpen(false)}>My Dashboard</Link><Link href="/help" onClick={()=>setMenuOpen(false)}>Help Centre</Link></div>}
    </header>

    <section className="home-hero relative overflow-hidden">
      <div className="hero-orbit absolute -right-24 -top-36 w-[520px] h-[520px] rounded-full border border-violet-200/60 hidden md:block"/>
      <div className="hero-glow absolute right-20 top-16 w-72 h-72 rounded-full bg-fuchsia-300/40 blur-3xl"/>
      <div className="container relative grid lg:grid-cols-[1.05fr_.95fr] gap-12 items-center py-20 md:py-28">
        <div className="max-w-[620px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cfe3e1] bg-white px-3 py-2 text-[11px] font-bold tracking-wide text-teal mb-7"><Sparkles size={14}/> A GLOBAL DIGITAL BUSINESS & OPPORTUNITY ECOSYSTEM</div>
          <h1 className="hero-heading text-[43px] sm:text-[55px] lg:text-[65px] leading-[1.04] tracking-[-.055em] font-extrabold text-ink">Create. Learn. Earn. <span className="hero-gradient-text">Work. Grow.</span></h1>
          <p className="mt-6 max-w-[510px] text-[16px] leading-7 text-slate-600">One connected platform where people discover products, build skills, find work, launch businesses, sell services and connect with opportunities around the world.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a href="#shop" className="rounded-full bg-ink px-7 py-4 text-white text-sm font-bold hover:bg-teal">Explore the platform <ArrowRight size={16} className="inline ml-2"/></a><a href="#categories" className="rounded-full border border-slate-300 bg-white px-7 py-4 text-ink text-sm font-bold hover:border-teal">Browse categories</a></div>
          <div className="mt-10 flex items-center gap-5 text-xs font-semibold text-slate-500"><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-teal"/> Practical resources</span><span className="flex items-center gap-2"><Download size={16} className="text-teal"/> Digital delivery</span><span className="hidden sm:flex items-center gap-2"><Globe2 size={16} className="text-teal"/> Made for everywhere</span></div>
        </div>
        <div className="relative min-h-[360px] flex items-center justify-center">
          <div className="absolute w-[330px] h-[330px] rounded-full bg-[#d9eae7]"/>
          <div className="hero-showcase relative w-[min(100%,440px)] rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-soft rotate-[2deg] backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4"><div><p className="text-[10px] font-bold tracking-[.15em] text-teal">THE CREATOR TOOLBOX</p><p className="font-extrabold text-ink text-xl mt-1">Ideas into action.</p></div><span className="rounded-xl bg-mist p-3 text-teal"><Sparkles/></span></div>
            <div className="grid grid-cols-2 gap-3 py-4">
              <div className="rounded-2xl bg-[#E8F2EF] p-4 h-32 flex flex-col justify-between"><span className="text-3xl">▤</span><span className="text-xs font-bold">Business systems</span></div>
              <div className="rounded-2xl bg-[#F1EAF7] p-4 h-32 flex flex-col justify-between"><span className="text-3xl">✳</span><span className="text-xs font-bold">Creative assets</span></div>
              <div className="rounded-2xl bg-[#EAF0F8] p-4 h-32 flex flex-col justify-between"><span className="text-3xl">⌘</span><span className="text-xs font-bold">Digital tools</span></div>
              <div className="rounded-2xl bg-[#FBF0E5] p-4 h-32 flex flex-col justify-between"><span className="text-3xl">✧</span><span className="text-xs font-bold">Learning resources</span></div>
            </div>
            <div className="rounded-xl bg-ink p-4 text-white flex items-center justify-between"><div><p className="text-[10px] text-slate-300">FIND YOUR NEXT RESOURCE</p><p className="font-bold text-sm mt-1">Explore. Download. Create.</p></div><ArrowRight size={20}/></div>
          </div>
          <div className="absolute -bottom-2 left-0 md:left-2 rounded-2xl bg-white px-4 py-3 shadow-soft text-xs font-bold text-ink"><span className="text-teal mr-2">✦</span>Useful by design</div>
        </div>
      </div>
    </section>

    <section id="ecosystem" className="container py-16">
      <div className="mb-8">
        <p className="eyebrow mb-3">Explore the NBJ ecosystem</p>
        <h2 className="section-title">Five connected ways to create opportunity.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">One account gives you access to the services that help you buy and sell, build skills, find work, grow a business and manage your store.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {title:"Marketplace",description:"Discover physical products, digital resources and professional services.",href:"/marketplace",icon:<ShoppingBag/>},
          {title:"NBJ Work",description:"Find jobs and projects, build your profile and connect with employers.",href:"/work",icon:<BriefcaseBusiness/>},
          {title:"NBJ Academy",description:"Teach, learn new skills, access courses and earn certificates.",href:"/academy",icon:<GraduationCap/>},
          {title:"NBJ Business",description:"Establish your business presence and grow customer connections.",href:"/business",icon:<Building2/>},
          {title:"Vendor Centre",description:"Set up your store and manage products, orders and sales.",href:"/vendor",icon:<Store/>}
        ].map(item=><Link key={item.href} href={item.href} className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-teal-300 hover:shadow-soft"><span className="inline-flex rounded-xl bg-[#E8F2F0] p-3 text-teal">{item.icon}</span><h3 className="mt-4 font-bold text-ink">{item.title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p><span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-teal">Explore service <ArrowRight size={14}/></span></Link>)}
      </div>
      <div className="mt-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-bold text-white hover:bg-teal"><LayoutDashboard size={16}/> Open central dashboard <ArrowRight size={15}/></Link>
      </div>
    </section>

    {spotlightBusinesses.length > 0 && <section className="container py-14">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div><p className="eyebrow mb-3">Discover the business community</p><h2 className="section-title">Businesses with something to offer.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Explore public businesses already showcasing published products and services on NBJ Marketplace.</p></div>
        <Link href="/businesses" className="inline-flex items-center gap-2 text-sm font-bold text-teal hover:underline">Explore all businesses <ArrowRight size={15}/></Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {spotlightBusinesses.map(b => <article key={b.business_slug} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-soft">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F2F0] text-teal"><Building2 size={22}/></div>
          <p className="mt-4 text-[10px] font-extrabold uppercase tracking-widest text-teal">{b.industry || "Business"}</p>
          <h3 className="mt-2 text-lg font-bold text-ink">{b.business_name}</h3>
          <p className="mt-2 min-h-[44px] text-xs leading-5 text-slate-500">{b.description || "Discover this business on NBJCreative Hub."}</p>
          <p className="mt-3 text-[11px] font-semibold text-slate-500">{[b.city,b.country].filter(Boolean).join(", ") || "Location not specified"} · {b.offerings_count} published {b.offerings_count === 1 ? "offering" : "offerings"}</p>
          <Link href={"/business/"+b.business_slug} className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-teal hover:underline">Explore business <ArrowRight size={14}/></Link>
        </article>)}
      </div>
    </section>}

    <section id="categories" className="container py-20">
      <div className="flex flex-wrap justify-between items-end gap-5 mb-9"><div><p className="eyebrow mb-3">Explore the collection</p><h2 className="section-title">Find the right tools for<br className="hidden sm:block"/> your next step.</h2></div><a href="#shop" className="text-sm font-bold text-teal">View all products <ArrowRight size={15} className="inline ml-1"/></a></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleCategories.map((c) => <Link key={c.name} href={`/marketplace?category=${encodeURIComponent(c.slug)}`} className="category-tile group rounded-2xl border border-violet-100 bg-white p-5 text-left hover:border-violet-300 hover:shadow-soft transition-all">
          <div className={`w-12 h-12 rounded-xl ${c.color} grid place-items-center text-2xl text-ink mb-5`}>{c.icon}</div><h3 className="font-bold text-ink">{c.name}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{c.count}</p><div className="mt-5 flex items-center justify-between text-[11px] font-bold text-teal"><span>Explore department</span><ChevronRight size={15} className="group-hover:translate-x-1 transition-transform"/></div>
        </Link>)}
      </div>
    </section>

    <section id="shop" className="bg-mist py-20">
      <div className="container">
        <div className="flex flex-wrap justify-between items-end gap-5 mb-8"><div><p className="eyebrow mb-3">The marketplace</p><h2 className="section-title">Products, services and solutions.</h2><p className="mt-3 text-sm text-slate-500">Discover physical products, digital resources and professional services from sellers on our platform.</p></div><div className="relative w-full sm:w-[280px]"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search marketplace products..." className="w-full rounded-full border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm outline-none focus:border-teal"/></div></div>
        <div className="flex gap-2 overflow-x-auto pb-4 mb-5">{["All",...visibleCategories.map(c=>c.name)].map(c=><button key={c} onClick={()=>setActive(c)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${active===c?"bg-ink text-white":"bg-white text-slate-600 border border-slate-200 hover:border-teal"}`}>{c}</button>)}</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {visibleProducts.map(p=><article key={p.id} className="product-card overflow-hidden rounded-2xl border border-violet-100 bg-white">
            <div className="relative h-48 bg-gradient-to-br from-[#DDECE9] to-[#F3F7F4] flex items-center justify-center overflow-hidden">{p.cover_image_path ? <img src={getCoverUrl(p.cover_image_path) ?? ""} alt={p.title} className="h-full w-full object-cover"/> : <span className="text-[76px] text-ink/80">▤</span>}<span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-[9px] font-extrabold tracking-wider text-teal">{p.product_type === "physical" ? "PHYSICAL PRODUCT" : p.product_type === "online_service" ? "ONLINE SERVICE" : "DIGITAL DOWNLOAD"}</span></div>
            <div className="p-5"><p className="text-[10px] uppercase tracking-widest font-bold text-teal">{p.category?.name ?? "Digital product"}</p><h3 className="mt-2 min-h-[48px] font-bold leading-6 text-ink">{p.title}</h3><p className="mt-2 min-h-[58px] text-xs leading-5 text-slate-500">{p.summary || p.description || "A practical digital resource designed to help you move forward."}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><strong className="text-lg text-ink">{formatPrice(p.price, p.currency)}</strong><Link href={`/products/${p.slug}`} className="rounded-full bg-ink px-4 py-2.5 text-[11px] font-bold text-white hover:bg-teal">View product</Link></div></div>
          </article>)}
        </div>
        {loading && <div className="rounded-2xl bg-white p-12 text-center text-sm text-slate-500">Loading products...</div>}
        {!loading && catalogueError && <div className="rounded-2xl bg-white p-12 text-center text-sm text-rose-600">{catalogueError}</div>}
        {!loading && !catalogueError && visibleProducts.length===0 && <div className="rounded-2xl bg-white p-12 text-center text-sm text-slate-500">{products.length === 0 ? "Our digital collection is being prepared. Please check back soon." : "No products match that search yet. Try another category or keyword."}</div>}
        <p className="mt-6 text-center text-[11px] text-slate-400">Browse published products, open their details and review the available purchase options.</p>
      </div>
    </section>


    <section id="about" className="container py-20 grid md:grid-cols-2 gap-12 items-center">
      <div className="rounded-[28px] bg-ink p-9 md:p-12 text-white"><p className="text-teal-200 text-xs font-extrabold tracking-[.16em]">OUR POINT OF VIEW</p><h2 className="mt-5 text-3xl md:text-4xl font-extrabold tracking-[-.04em] leading-tight">One connected platform. More ways to move forward.</h2><p className="mt-5 text-sm leading-7 text-slate-300">NBJCreative Hub brings commerce, education, work and business growth together in one connected global ecosystem.</p><a href="#categories" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-teal-200">Explore our departments <ArrowRight size={16}/></a></div>
      <div><p className="eyebrow mb-3">Why NBJCreative Hub</p><h2 className="section-title">Useful resources.<br/>Clear value. No clutter.</h2><div className="mt-8 grid gap-6">{[{icon:<Sparkles/>,title:"Curated with purpose",body:"Connected services that help people turn ideas, skills and ambition into opportunity."},{icon:<Download/>,title:"Made for digital delivery",body:"Access products, services, learning and professional opportunities through one account."},{icon:<Globe2/>,title:"A worldwide outlook",body:"Built with a global outlook, connecting people and opportunities across markets."}].map((x,i)=><div className="flex gap-4" key={i}><div className="w-11 h-11 shrink-0 rounded-xl bg-[#E8F2F0] text-teal grid place-items-center">{x.icon}</div><div><h3 className="font-bold text-ink">{x.title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{x.body}</p></div></div>)}</div></div>
    </section>

    <section id="newsletter" className="newsletter-band py-16"><div className="container flex flex-col md:flex-row md:items-center justify-between gap-8"><div><p className="eyebrow mb-2">Stay in the loop</p><h2 className="text-2xl font-extrabold tracking-tight text-ink">New opportunities. Shared progress.</h2><p className="mt-2 text-sm text-slate-600">Stay informed about new services, opportunities and platform updates.</p></div><form className="flex w-full md:w-[420px] gap-2" onSubmit={e=>{e.preventDefault();alert("Thanks for your interest. Newsletter signup will be connected before launch.");}}><input type="email" required placeholder="Your email address" className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-5 py-3.5 text-sm outline-none focus:border-teal"/><button className="rounded-full bg-teal px-6 text-sm font-bold text-white hover:bg-[#11696d]">Notify me</button></form></div></section>

    <footer className="bg-ink text-white"><div className="container py-12"><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10"><div className="lg:col-span-2"><div className="flex items-center gap-2"><span className="w-9 h-9 rounded-xl bg-white text-ink grid place-items-center font-black">N</span><strong>NBJCreative <span className="text-teal-200">Hub</span></strong></div><p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">A connected global platform for commerce, learning, work and business growth.</p></div><div><h4 className="font-bold text-sm">Explore</h4><div className="mt-4 grid gap-3 text-xs text-slate-300"><a href="#shop">Shop all</a><a href="#categories">Categories</a><a href="#about">About us</a></div></div><div><h4 className="font-bold text-sm">Help</h4><div className="mt-4 grid gap-3 text-xs text-slate-300"><Link href="/help">Help Centre & FAQs</Link><Link href="/support">Contact support</Link><a href="#newsletter">Product updates</a><span>Privacy & terms — coming soon</span></div></div></div><div className="mt-12 border-t border-white/10 pt-6 flex flex-wrap justify-between gap-3 text-[11px] text-slate-400"><span>© {new Date().getFullYear()} NBJCreative Hub. All rights reserved.</span><span>Built with purpose. Based in Ghana, made for everywhere.</span></div></div></footer>
  </main>;
}