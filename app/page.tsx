"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Search, ShoppingBag, Menu, X, Sparkles, Download, ShieldCheck, Globe2, ChevronRight } from "lucide-react";

const categories = [
  { name: "Business", detail: "Build and grow with confidence", icon: "↗", color: "bg-[#E9F3EF]", count: "Business plans, finance tools & templates" },
  { name: "Design & Creative", detail: "Make your ideas stand out", icon: "✳", color: "bg-[#F3ECFA]", count: "Brand kits, graphics & presentation assets" },
  { name: "Technology", detail: "Tools for builders and creators", icon: "⌘", color: "bg-[#EAF1FA]", count: "Code, website templates & developer resources" },
  { name: "Education", detail: "Learn something that moves you forward", icon: "▤", color: "bg-[#FFF3E7]", count: "Guides, workbooks & learning resources" },
  { name: "Career", detail: "Take your next professional step", icon: "◎", color: "bg-[#E8F4F5]", count: "CVs, portfolios & interview resources" },
  { name: "Lifestyle", detail: "Make everyday life work better", icon: "♡", color: "bg-[#FCEEF0]", count: "Planners, journals & trackers" },
  { name: "Media & Assets", detail: "Creative assets for your projects", icon: "▶", color: "bg-[#F0F1F5]", count: "Photos, video, audio & digital art" },
  { name: "Faith", detail: "Resources for spiritual growth", icon: "✧", color: "bg-[#F8F1E6]", count: "Devotionals, journals & ministry resources" }
];

const products = [
  { id: 1, name: "Freelancer Client-to-Payment System", category: "Business", type: "Complete toolkit", price: "$19", old: "$29", tag: "FOUNDING EDITION", art: "🗂️", bg: "from-[#DDECE9] to-[#F3F7F4]", description: "A coordinated workflow for enquiries, proposals, project scope, approvals and getting paid." },
  { id: 2, name: "The Complete Brand Starter Kit", category: "Design & Creative", type: "Editable templates", price: "$15", old: "", tag: "COMING SOON", art: "✳", bg: "from-[#EAE2F4] to-[#F8F4FB]", description: "A practical set of brand planning and visual identity templates for small businesses." },
  { id: 3, name: "Website Launch Checklist", category: "Technology", type: "PDF + checklist", price: "$9", old: "", tag: "COMING SOON", art: "⌘", bg: "from-[#DCE8F5] to-[#F2F6FB]", description: "A structured checklist to plan, test and launch a professional website." },
  { id: 4, name: "Career-Ready CV & Portfolio Pack", category: "Career", type: "Editable documents", price: "$12", old: "", tag: "COMING SOON", art: "▤", bg: "from-[#F8EAD9] to-[#FCF7F0]", description: "Clear, professional templates for presenting your experience and work." }
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("All");
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleProducts = useMemo(() => products.filter(p => (active === "All" || p.category === active) && (p.name + p.category + p.description).toLowerCase().includes(query.toLowerCase())), [active, query]);

  return <main>
    <div className="bg-ink text-white text-center text-xs py-2.5 px-4">Thoughtful digital resources for the way you work, create and grow. <span className="text-teal-200 font-semibold">Explore the collection →</span></div>
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="container h-[76px] flex items-center justify-between gap-6">
        <a href="#" className="flex items-center gap-2.5 shrink-0">
          <span className="w-9 h-9 rounded-xl bg-ink text-white grid place-items-center font-black text-lg">N</span>
          <span className="leading-tight"><strong className="block tracking-[-.04em] text-[17px]">NBJCreative <span className="text-teal">Hub</span></strong><small className="text-[9px] tracking-[.18em] text-slate-400 font-bold">DIGITAL PRODUCTS & RESOURCES</small></span>
        </a>
        <nav className="hidden lg:flex items-center gap-7 text-[13px] font-semibold text-slate-600">
          <a className="text-ink" href="#shop">Shop</a><a href="#categories" className="hover:text-teal">Categories</a><a href="#about" className="hover:text-teal">About</a><a href="#newsletter" className="hover:text-teal">Updates</a>
        </nav>
        <div className="hidden md:flex items-center gap-3"><a href="#shop" className="text-sm font-semibold text-slate-600 hover:text-teal">Explore products</a><a href="#shop" className="rounded-full bg-teal px-5 py-3 text-white text-sm font-bold hover:bg-[#11696d]">Browse shop <ArrowRight size={15} className="inline ml-1"/></a></div>
        <button className="lg:hidden p-2" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
      </div>
      {menuOpen && <div className="lg:hidden border-t px-5 py-4 grid gap-4 text-sm font-semibold"><a href="#shop" onClick={()=>setMenuOpen(false)}>Shop</a><a href="#categories" onClick={()=>setMenuOpen(false)}>Categories</a><a href="#about" onClick={()=>setMenuOpen(false)}>About</a></div>}
    </header>

    <section className="relative overflow-hidden bg-mist">
      <div className="absolute -right-24 -top-36 w-[520px] h-[520px] rounded-full border border-[#dce8e8] hidden md:block"/>
      <div className="absolute right-20 top-16 w-72 h-72 rounded-full bg-[#dcecea]/60 blur-3xl"/>
      <div className="container relative grid lg:grid-cols-[1.05fr_.95fr] gap-12 items-center py-20 md:py-28">
        <div className="max-w-[620px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cfe3e1] bg-white px-3 py-2 text-[11px] font-bold tracking-wide text-teal mb-7"><Sparkles size={14}/> DIGITAL TOOLS FOR WHAT'S NEXT</div>
          <h1 className="text-[43px] sm:text-[55px] lg:text-[65px] leading-[1.04] tracking-[-.055em] font-extrabold text-ink">Make your next big idea <span className="text-teal">work.</span></h1>
          <p className="mt-6 max-w-[510px] text-[16px] leading-7 text-slate-600">Discover practical digital products, creative resources and smart tools designed to help you build, create, learn and move forward.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a href="#shop" className="rounded-full bg-ink px-7 py-4 text-white text-sm font-bold hover:bg-teal">Explore the shop <ArrowRight size={16} className="inline ml-2"/></a><a href="#categories" className="rounded-full border border-slate-300 bg-white px-7 py-4 text-ink text-sm font-bold hover:border-teal">Browse categories</a></div>
          <div className="mt-10 flex items-center gap-5 text-xs font-semibold text-slate-500"><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-teal"/> Practical resources</span><span className="flex items-center gap-2"><Download size={16} className="text-teal"/> Digital delivery</span><span className="hidden sm:flex items-center gap-2"><Globe2 size={16} className="text-teal"/> Made for everywhere</span></div>
        </div>
        <div className="relative min-h-[360px] flex items-center justify-center">
          <div className="absolute w-[330px] h-[330px] rounded-full bg-[#d9eae7]"/>
          <div className="relative w-[min(100%,440px)] rounded-[28px] border border-white bg-white p-5 shadow-soft rotate-[2deg]">
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

    <section id="categories" className="container py-20">
      <div className="flex flex-wrap justify-between items-end gap-5 mb-9"><div><p className="eyebrow mb-3">Explore the collection</p><h2 className="section-title">Find the right tools for<br className="hidden sm:block"/> your next step.</h2></div><a href="#shop" className="text-sm font-bold text-teal">View all products <ArrowRight size={15} className="inline ml-1"/></a></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((c) => <button key={c.name} onClick={()=>{setActive(c.name);document.getElementById("shop")?.scrollIntoView({behavior:"smooth"});}} className="group rounded-2xl border border-slate-100 bg-white p-5 text-left hover:border-teal/40 hover:shadow-soft transition-all">
          <div className={`w-12 h-12 rounded-xl ${c.color} grid place-items-center text-2xl text-ink mb-5`}>{c.icon}</div><h3 className="font-bold text-ink">{c.name}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{c.count}</p><div className="mt-5 flex items-center justify-between text-[11px] font-bold text-teal"><span>Explore department</span><ChevronRight size={15} className="group-hover:translate-x-1 transition-transform"/></div>
        </button>)}
      </div>
    </section>

    <section id="shop" className="bg-mist py-20">
      <div className="container">
        <div className="flex flex-wrap justify-between items-end gap-5 mb-8"><div><p className="eyebrow mb-3">The digital shop</p><h2 className="section-title">Resources worth keeping.</h2><p className="mt-3 text-sm text-slate-500">A growing collection of tools made to be useful.</p></div><div className="relative w-full sm:w-[280px]"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search digital products..." className="w-full rounded-full border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm outline-none focus:border-teal"/></div></div>
        <div className="flex gap-2 overflow-x-auto pb-4 mb-5">{["All",...categories.map(c=>c.name)].map(c=><button key={c} onClick={()=>setActive(c)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${active===c?"bg-ink text-white":"bg-white text-slate-600 border border-slate-200 hover:border-teal"}`}>{c}</button>)}</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {visibleProducts.map(p=><article key={p.id} className="product-card overflow-hidden rounded-2xl border border-slate-100 bg-white">
            <div className={`relative h-48 bg-gradient-to-br ${p.bg} flex items-center justify-center`}><span className="text-[76px] text-ink/80">{p.art}</span><span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-[9px] font-extrabold tracking-wider text-teal">{p.tag}</span></div>
            <div className="p-5"><p className="text-[10px] uppercase tracking-widest font-bold text-teal">{p.category} · {p.type}</p><h3 className="mt-2 min-h-[48px] font-bold leading-6 text-ink">{p.name}</h3><p className="mt-2 min-h-[58px] text-xs leading-5 text-slate-500">{p.description}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><div><strong className="text-lg text-ink">{p.price}</strong>{p.old && <span className="ml-2 text-xs text-slate-400 line-through">{p.old}</span>}</div><button onClick={()=>alert(p.tag==="COMING SOON"?"This product is being prepared for launch.":"The product is in development. Checkout will be enabled after launch.")} className="rounded-full bg-ink px-4 py-2.5 text-[11px] font-bold text-white hover:bg-teal">{p.tag==="COMING SOON"?"Coming soon":"View product"}</button></div></div>
          </article>)}
        </div>
        {visibleProducts.length===0 && <div className="rounded-2xl bg-white p-12 text-center text-sm text-slate-500">No products match that search yet. Try another category or keyword.</div>}
        <p className="mt-6 text-center text-[11px] text-slate-400">Product previews and launch pricing are illustrative. Checkout is not yet enabled.</p>
      </div>
    </section>

    <section id="about" className="container py-20 grid md:grid-cols-2 gap-12 items-center">
      <div className="rounded-[28px] bg-ink p-9 md:p-12 text-white"><p className="text-teal-200 text-xs font-extrabold tracking-[.16em]">OUR POINT OF VIEW</p><h2 className="mt-5 text-3xl md:text-4xl font-extrabold tracking-[-.04em] leading-tight">Good tools make good ideas easier to bring to life.</h2><p className="mt-5 text-sm leading-7 text-slate-300">We're building a thoughtful destination for practical digital products: resources that save time, sharpen skills and help people make progress.</p><a href="#categories" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-teal-200">Explore our departments <ArrowRight size={16}/></a></div>
      <div><p className="eyebrow mb-3">Why NBJCreative Hub</p><h2 className="section-title">Useful resources.<br/>Clear value. No clutter.</h2><div className="mt-8 grid gap-6">{[{icon:<Sparkles/>,title:"Curated with purpose",body:"A growing range of resources selected and developed around real needs."},{icon:<Download/>,title:"Made for digital delivery",body:"Convenient digital formats designed to fit into your workflow."},{icon:<Globe2/>,title:"A worldwide outlook",body:"Built in Ghana, with useful resources for customers around the world."}].map((x,i)=><div className="flex gap-4" key={i}><div className="w-11 h-11 shrink-0 rounded-xl bg-[#E8F2F0] text-teal grid place-items-center">{x.icon}</div><div><h3 className="font-bold text-ink">{x.title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{x.body}</p></div></div>)}</div></div>
    </section>

    <section id="newsletter" className="bg-[#EAF3F1] py-16"><div className="container flex flex-col md:flex-row md:items-center justify-between gap-8"><div><p className="eyebrow mb-2">Stay in the loop</p><h2 className="text-2xl font-extrabold tracking-tight text-ink">New resources. Fresh ideas.</h2><p className="mt-2 text-sm text-slate-600">Be among the first to hear when our collection grows.</p></div><form className="flex w-full md:w-[420px] gap-2" onSubmit={e=>{e.preventDefault();alert("Thanks for your interest. Newsletter signup will be connected before launch.");}}><input type="email" required placeholder="Your email address" className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-5 py-3.5 text-sm outline-none focus:border-teal"/><button className="rounded-full bg-teal px-6 text-sm font-bold text-white hover:bg-[#11696d]">Notify me</button></form></div></section>

    <footer className="bg-ink text-white"><div className="container py-12"><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10"><div className="lg:col-span-2"><div className="flex items-center gap-2"><span className="w-9 h-9 rounded-xl bg-white text-ink grid place-items-center font-black">N</span><strong>NBJCreative <span className="text-teal-200">Hub</span></strong></div><p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">Digital products, creative resources and practical tools for people building what's next.</p></div><div><h4 className="font-bold text-sm">Explore</h4><div className="mt-4 grid gap-3 text-xs text-slate-300"><a href="#shop">Shop all</a><a href="#categories">Categories</a><a href="#about">About us</a></div></div><div><h4 className="font-bold text-sm">Help</h4><div className="mt-4 grid gap-3 text-xs text-slate-300"><a href="mailto:hello@nbjcreative.com">Contact us</a><a href="#newsletter">Product updates</a><span>Privacy & terms — coming soon</span></div></div></div><div className="mt-12 border-t border-white/10 pt-6 flex flex-wrap justify-between gap-3 text-[11px] text-slate-400"><span>© {new Date().getFullYear()} NBJCreative Hub. All rights reserved.</span><span>Built with purpose. Based in Ghana, made for everywhere.</span></div></div></footer>
  </main>;
}