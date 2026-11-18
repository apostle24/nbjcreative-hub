"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, ShieldCheck } from "lucide-react";

const items: Record<string, {name:string;category:string;price:string;status:string;description:string;includes:string[];symbol:string}> = {
  "freelancer-client-to-payment-system": {
    name: "Freelancer Client-to-Payment System", category: "Business", price: "$19", status: "Founding edition in development",
    description: "A practical, coordinated toolkit to help independent web designers and developers manage the journey from first client enquiry through project approval, delivery and final payment.",
    includes: ["Client discovery and qualification templates", "Proposal and scope-of-work documents", "Scope-change and approval records", "Invoice and payment follow-up templates", "Project and payment tracking workbook", "Guided setup handbook"],
    symbol: "▤"
  },
  "complete-brand-starter-kit": {
    name: "The Complete Brand Starter Kit", category: "Design & Creative", price: "$15", status: "Coming soon",
    description: "A practical collection of brand planning and visual identity resources for founders and small businesses building a consistent presence.",
    includes: ["Brand discovery worksheet", "Visual direction planner", "Brand voice worksheet", "Launch checklist"], symbol: "✳"
  },
  "website-launch-checklist": {
    name: "Website Launch Checklist", category: "Technology", price: "$9", status: "Coming soon",
    description: "A structured guide to plan, review, test and launch a professional website with fewer last-minute surprises.",
    includes: ["Pre-build planning checklist", "Responsive and browser testing", "SEO and accessibility checks", "Launch and handover checklist"], symbol: "⌘"
  },
  "career-ready-cv-portfolio-pack": {
    name: "Career-Ready CV & Portfolio Pack", category: "Career", price: "$12", status: "Coming soon",
    description: "Professional starting points for presenting your experience, skills and work clearly to employers and clients.",
    includes: ["CV structure and editable template", "Portfolio planning worksheet", "Project case-study outline", "Interview preparation prompts"], symbol: "▤"
  }
};

export default function ProductPage() {
  const params = useParams<{slug:string}>();
  const product = items[params.slug];
  if (!product) return <main className="min-h-screen grid place-items-center p-8"><div className="text-center"><h1 className="text-3xl font-bold text-ink">Product not found</h1><Link className="mt-5 inline-block text-teal font-bold" href="/#shop">Return to the shop</Link></div></main>;
  return <main className="min-h-screen bg-mist">
    <header className="bg-white border-b border-slate-100"><div className="container h-20 flex items-center justify-between"><Link href="/" className="font-extrabold tracking-tight text-ink">NBJCreative <span className="text-teal">Hub</span></Link><Link href="/#shop" className="text-sm font-semibold text-slate-600"><ArrowLeft size={15} className="inline mr-2"/>Back to shop</Link></div></header>
    <div className="container py-12 md:py-20">
      <div className="grid lg:grid-cols-2 gap-12 items-start">
        <div className="rounded-[28px] bg-gradient-to-br from-[#DDECE9] to-white min-h-[380px] grid place-items-center shadow-soft"><span className="text-[130px] text-ink/70">{product.symbol}</span></div>
        <div className="pt-2"><p className="eyebrow">{product.category} · Digital product</p><h1 className="mt-4 text-4xl md:text-5xl font-extrabold tracking-[-.05em] leading-tight text-ink">{product.name}</h1><p className="mt-6 text-base leading-7 text-slate-600">{product.description}</p><div className="mt-7 flex items-center gap-4"><span className="text-3xl font-extrabold text-ink">{product.price}</span><span className="rounded-full bg-[#E2F1EE] px-3 py-1.5 text-xs font-bold text-teal">{product.status}</span></div>
          <button disabled className="mt-8 w-full sm:w-auto rounded-full bg-slate-300 px-8 py-4 text-sm font-bold text-slate-600 cursor-not-allowed">Purchases opening soon</button>
          <p className="mt-3 text-xs text-slate-400">Checkout is not active yet. No payment will be collected on this preview site.</p>
          <div className="mt-10 border-t border-slate-200 pt-7"><h2 className="text-lg font-bold text-ink">What you'll get</h2><ul className="mt-5 grid gap-3">{product.includes.map(x=><li key={x} className="flex items-start gap-3 text-sm text-slate-600"><CheckCircle2 size={17} className="mt-0.5 text-teal shrink-0"/>{x}</li>)}</ul></div>
          <div className="mt-8 grid sm:grid-cols-2 gap-3"><div className="rounded-xl bg-white p-4 flex gap-3"><Download className="text-teal shrink-0"/><div><p className="text-sm font-bold text-ink">Digital format</p><p className="text-xs text-slate-500 mt-1">Designed for convenient access.</p></div></div><div className="rounded-xl bg-white p-4 flex gap-3"><ShieldCheck className="text-teal shrink-0"/><div><p className="text-sm font-bold text-ink">Clear product details</p><p className="text-xs text-slate-500 mt-1">Know what's included before buying.</p></div></div></div>
        </div>
      </div>
    </div>
  </main>;
}