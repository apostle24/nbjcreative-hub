"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowRight, BookOpen, BriefcaseBusiness, Building2, CircleUserRound,
  GraduationCap, LayoutDashboard, LifeBuoy, Search, ShieldCheck,
  ShoppingBag, Sparkles, Store, Users
} from "lucide-react";

type Profile = { full_name?: string | null; role?: string | null; email?: string | null };

const modules = [
  { title: "Shop & Marketplace", description: "Discover digital products, browse categories and manage your purchases.", href: "/marketplace", icon: ShoppingBag, group: "Explore" },
  { title: "NBJ Work", description: "Find jobs and freelance projects, apply and manage your professional profile.", href: "/work", icon: BriefcaseBusiness, group: "Explore" },
  { title: "NBJ Academy", description: "Discover courses, continue learning and access your certificates.", href: "/academy", icon: GraduationCap, group: "Explore" },
  { title: "Vendor Centre", description: "Manage your seller application, products, orders, sales and payouts.", href: "/vendor", icon: Store, group: "Your workspaces" },
  { title: "NBJ Business", description: "Set up your business workspace and manage business operations.", href: "/business", icon: Building2, group: "Your workspaces" },
  { title: "My Account", description: "Manage your profile, orders, wishlist, notifications and support.", href: "/account/profile", icon: CircleUserRound, group: "Your account" },
  { title: "Help & Support", description: "Find guidance or contact the NBJCreative Hub support team.", href: "/help", icon: LifeBuoy, group: "Your account" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [isApprovedVendor, setIsApprovedVendor] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/account?next=/dashboard");
        return;
      }
      setUserEmail(user.email ?? "");
      const [{ data }, { data: vendor }] = await Promise.all([
        supabase.from("profiles").select("full_name,role,email").eq("id", user.id).maybeSingle(),
        supabase.from("vendor_profiles").select("status").eq("owner_id", user.id).maybeSingle()
      ]);
      if (!active) return;
      setProfile(data ?? { email: user.email });
      setIsApprovedVendor(vendor?.status === "approved");
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [router]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#F5F7F8] text-sm text-slate-500">Loading your NBJ dashboard...</main>;

  const isAdmin = profile?.role === "admin" && userEmail.toLowerCase() === "nbjoshua8@gmail.com";
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || userEmail.split("@")[0] || "there";

  return <main className="min-h-screen bg-[#F5F7F8] text-slate-900">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-lg font-black text-white">N</span><span className="text-lg font-extrabold tracking-tight">NBJCreative <span className="text-teal-700">Hub</span><small className="block text-[9px] font-bold tracking-[.18em] text-slate-400">CREATE · LEARN · EARN · WORK · GROW</small></span></Link>
        <nav className="hidden items-center gap-5 text-sm font-semibold text-slate-600 md:flex"><Link href="/marketplace" className="hover:text-teal-700">Marketplace</Link><Link href="/work" className="hover:text-teal-700">Work</Link><Link href="/academy" className="hover:text-teal-700">Academy</Link><Link href="/help" className="hover:text-teal-700">Help</Link></nav>
        <div className="flex items-center gap-3"><span className="hidden max-w-48 truncate text-xs text-slate-500 sm:inline">{userEmail}</span><button onClick={signOut} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold hover:bg-slate-50">Sign out</button></div>
      </div>
    </header>
    <div className="mx-auto max-w-7xl px-5 py-10 md:py-14">
      <section className="overflow-hidden rounded-3xl bg-slate-950 p-7 text-white md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.22em] text-teal-300">Your central workspace</p><h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">Welcome, {firstName}.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Everything you do on NBJCreative Hub starts here. Choose a workspace or explore the platform.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><LayoutDashboard size={28} className="text-teal-300"/><p className="mt-2 text-xs font-semibold text-slate-300">One account. One hub.</p></div>
        </div>
        <div className="mt-7 flex flex-wrap gap-3"><Link href="/marketplace" className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-teal-300">Explore marketplace <ArrowRight size={16}/></Link><Link href="/account/profile" className="rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Manage my profile</Link></div>
      </section>

      {isAdmin && <section className="mt-7 rounded-2xl border border-violet-200 bg-violet-50 p-5 md:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-white p-3 text-violet-700"><ShieldCheck size={24}/></span><div><h2 className="font-extrabold text-violet-950">Admin Centre</h2><p className="mt-1 text-sm text-violet-800">Manage platform operations, users, products, vendors, employers and finance.</p></div></div><Link href="/admin" className="inline-flex items-center gap-2 rounded-xl bg-violet-800 px-5 py-3 text-sm font-bold text-white hover:bg-violet-700">Open Admin Centre <ArrowRight size={16}/></Link></div></section>}

      <section className="mt-10"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-teal-700">Platform directory</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight">Your NBJ workspaces</h2><p className="mt-2 text-sm text-slate-500">Choose a section to continue. Access to individual tools depends on your account and permissions.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{modules.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg"><div className="flex items-start justify-between"><span className="rounded-xl bg-teal-50 p-3 text-teal-800"><Icon size={23}/></span><ArrowRight size={18} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-teal-700"/></div><p className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">{item.group}</p><h3 className="mt-1 text-lg font-extrabold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p></Link>; })}</div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2"><Link href="/account/orders" className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-teal-300"><span className="rounded-xl bg-slate-100 p-3"><ShoppingBag/></span><span className="min-w-0 flex-1"><strong className="block">Customer: My Orders</strong><small className="mt-1 block text-slate-500">Track purchases, payments, downloads and service delivery</small></span><ArrowRight size={18}/></Link>{isApprovedVendor && <Link href="/vendor/orders" className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-teal-300"><span className="rounded-xl bg-slate-100 p-3"><Store/></span><span className="min-w-0 flex-1"><strong className="block">Seller: Manage Orders</strong><small className="mt-1 block text-slate-500">View customer orders and manage shipping and online-service work</small></span><ArrowRight size={18}/></Link>}<Link href="/account/work-applications" className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-teal-300"><span className="rounded-xl bg-slate-100 p-3"><BriefcaseBusiness/></span><span className="min-w-0 flex-1"><strong className="block">My Work applications</strong><small className="mt-1 block text-slate-500">Track your job and project applications</small></span><ArrowRight size={18}/></Link></section>
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500"><span>NBJCreative Hub · One connected platform</span><div className="flex gap-4"><Link href="/help" className="hover:text-teal-700">Help Centre</Link><Link href="/" className="hover:text-teal-700">Public homepage</Link></div></footer>
    </div>
  </main>;
}
