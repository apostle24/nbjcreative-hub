"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronDown, LifeBuoy, ShoppingBag, CreditCard, Download, UserRound, Store, ShieldCheck } from "lucide-react";

const topics = [
  { category: "Accounts", icon: UserRound, questions: [
    { q: "How do I create an NBJCreative Hub account?", a: "Open the account page, choose Create account, enter your name, email and password, then follow any email confirmation instructions shown. You can sign in after your account is confirmed." },
    { q: "I cannot sign in. What should I do?", a: "Check that you are using the email address registered to your account and that your password is correct. If you still cannot access your account, contact support and describe the problem. Never send your password to anyone." },
    { q: "Where can I update my profile details?", a: "Sign in and open Profile & settings from your customer account. The available settings include your name, phone number, email-change request and password update." }
  ]},
  { category: "Payments & refunds", icon: CreditCard, questions: [
    { q: "How do I pay for an order?", a: "Add the product you want to your cart and continue to checkout. Follow the payment instructions displayed there. A payment is complete only when the platform confirms it; an order record by itself is not proof of payment." },
    { q: "My payment is pending. What does that mean?", a: "A pending status means the platform has not yet confirmed the payment. Check your payment provider for its transaction status, then refresh your order history. If the status remains unresolved, contact support with your order reference and payment transaction reference. Do not send card details or passwords." },
    { q: "How do I request a refund?", a: "Open My Orders and find the paid Marketplace order. For an eligible Paystack order, choose Request full refund and provide your reason. Refund requests are reviewed by an administrator; submitting a request does not mean the refund has been approved or paid. If the option is unavailable or you need help, contact support with your order reference." }
  ]},
  { category: "Orders & downloads", icon: Download, questions: [
    { q: "Where can I find my purchases?", a: "Sign in and open My orders and downloads. The page shows your order history, payment status, purchased items and any digital access currently available." },
    { q: "I paid but cannot download my product. What should I do?", a: "First check that the order shows as paid, then refresh My orders and downloads. If the download is still unavailable, contact support with your order reference and product name so the team can investigate." },
    { q: "Why does my download link expire or stop working?", a: "Download links are temporary for security. Return to your order history and request a fresh download link if access is still available. If the problem continues, contact support." },
    { q: "Can I download a product more than once?", a: "Download availability and limits may vary by product entitlement. Check the download information shown in your order history. Contact support if you believe your access is incorrect." }
  ]},
  { category: "Reviews & wishlist", icon: ShoppingBag, questions: [
    { q: "How do I leave a product review?", a: "Open the product page while signed in. Reviews are available to customers with a qualifying paid purchase. Submitted reviews may be checked by the moderation team before appearing publicly." },
    { q: "Where are my saved products?", a: "Open My Wishlist from your customer account to view saved products. You can remove items or add available products to your cart." }
  ]},
  { category: "Marketplace & vendors", icon: Store, questions: [
    { q: "How do I become a vendor?", a: "Sign in, open the Vendor Centre and complete your store details. Ordinary seller accounts are activated when the store is created, so you can continue to your product listings without waiting for routine account approval." },
    { q: "Why is my vendor product not visible in the marketplace?", a: "Seller accounts can create and publish their own ordinary product listings from Vendor Centre. Check the listing status in your product workspace if a product is not visible. The platform may still moderate listings under its marketplace rules." },
    { q: "How do vendor payouts work?", a: "Eligible vendors can add payout details and submit a payout request from the vendor workspace. Requests are reviewed by the platform team. A request marked paid should only be treated as paid after the external transfer has actually been completed." }
  ]},
  { category: "Privacy & safety", icon: ShieldCheck, questions: [
    { q: "How can I keep my account safe?", a: "Use a unique password, keep your sign-in details private, sign out on shared devices and contact support if you notice activity you do not recognise. NBJCreative Hub support will not need your password or full payment-card details." },
    { q: "What information should I include when contacting support?", a: "Include the email on your account, a clear description of the issue and the relevant order or product reference. Do not include passwords, one-time codes, full card numbers or other sensitive credentials." }
  ]}
];

export default function HelpCentrePage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All topics");
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const filtered = useMemo(() => topics.flatMap(topic => topic.questions
    .filter(item => (activeCategory === "All topics" || activeCategory === topic.category) &&
      (topic.category + item.q + item.a).toLowerCase().includes(query.trim().toLowerCase()))
    .map(item => ({ ...item, category: topic.category }))), [query, activeCategory]);

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
        <Link href="/" className="text-xl font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link>
        <div className="flex gap-4 text-sm font-semibold"><Link href="/account" className="text-slate-600 hover:text-teal-700">My account</Link><Link href="/support" className="text-teal-700 hover:underline">Contact support</Link></div>
      </div>
    </header>
    <section className="bg-[#102B35] px-5 py-14 text-white md:py-20">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><LifeBuoy size={24}/></div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[.22em] text-teal-200">NBJCreative Hub support</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">Help Centre</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">Find clear answers about your account, payments, orders, downloads and marketplace experience.</p>
        <div className="relative mx-auto mt-8 max-w-2xl">
          <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search help articles and questions..." className="w-full rounded-2xl border border-white/20 bg-white py-4 pl-12 pr-4 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-300"/>
        </div>
      </div>
    </section>
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[250px_1fr]">
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-900">Browse topics</h2>
        <div className="mt-4 grid gap-1">
          <button onClick={()=>setActiveCategory("All topics")} className={"rounded-xl px-3 py-2.5 text-left text-sm font-semibold "+(activeCategory==="All topics"?"bg-teal-50 text-teal-800":"text-slate-600 hover:bg-slate-50")}>All topics</button>
          {topics.map(topic => { const Icon = topic.icon; return <button key={topic.category} onClick={()=>setActiveCategory(topic.category)} className={"flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold "+(activeCategory===topic.category?"bg-teal-50 text-teal-800":"text-slate-600 hover:bg-slate-50")}><Icon size={16}/>{topic.category}</button>; })}
        </div>
      </aside>
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-teal-700">Knowledge base</p><h2 className="mt-1 text-2xl font-extrabold text-slate-900">{activeCategory === "All topics" ? "Popular help questions" : activeCategory}</h2></div><span className="text-xs text-slate-500">{filtered.length} {filtered.length===1?"answer":"answers"}</span></div>
        {filtered.length===0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><h3 className="font-bold text-slate-900">No matching answers</h3><p className="mt-2 text-sm text-slate-500">Try a different search term or choose another topic.</p><button onClick={()=>{setQuery("");setActiveCategory("All topics");}} className="mt-4 text-sm font-bold text-teal-700 hover:underline">Clear search and filters</button></div> :
          <div className="space-y-3">{filtered.map((item,index)=>{ const key=item.category+item.q; const isOpen=openQuestion===key; return <article key={key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><button aria-expanded={isOpen} onClick={()=>setOpenQuestion(isOpen?null:key)} className="flex w-full items-center justify-between gap-4 p-5 text-left"><span><span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-teal-700">{item.category}</span><span className="font-bold text-slate-900">{item.q}</span></span><ChevronDown size={18} className={"shrink-0 text-slate-400 transition-transform "+(isOpen?"rotate-180":"")}/></button>{isOpen && <div className="border-t border-slate-100 px-5 pb-5 pt-4 text-sm leading-7 text-slate-600">{item.a}</div>}</article>;})}</div>}
        <div className="mt-8 rounded-2xl border border-teal-100 bg-[#EAF3F1] p-6 md:flex md:items-center md:justify-between"><div><h3 className="font-bold text-slate-900">Still need a hand?</h3><p className="mt-1 text-sm text-slate-600">Send our support team a message or check the status of a request you have already submitted.</p></div><div className="mt-4 flex flex-wrap gap-3 md:mt-0"><Link href="/support" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700">Contact support</Link><Link href="/account/support" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:border-teal-600">My support tickets</Link></div></div>
      </section>
    </div>
    <footer className="border-t border-slate-200 bg-white px-5 py-7 text-center text-xs text-slate-500"><Link href="/" className="font-semibold text-teal-700 hover:underline">Return to NBJCreative Hub</Link><span className="mx-2">·</span><Link href="/account/orders" className="font-semibold text-teal-700 hover:underline">My orders and downloads</Link></footer>
  </main>;
}
