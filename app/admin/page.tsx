"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string };
type Product = {
  id: string; title: string; slug: string; summary: string | null;
  description: string | null; price: number | string; currency: string;
  status: "draft" | "published" | "archived"; category_id: string | null;
  created_at: string;
};

const emptyForm = { title:"", slug:"", category_id:"", summary:"", description:"", price:"", currency:"GHS", status:"draft" as "draft"|"published" };

function makeSlug(value: string) {
  return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [file, setFile] = useState<File|null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [categoryResult, productResult] = await Promise.all([
      supabase.from("categories").select("id,name").eq("is_active",true).order("sort_order"),
      supabase.from("products").select("id,title,slug,summary,description,price,currency,status,category_id,created_at").order("created_at",{ascending:false})
    ]);
    if (categoryResult.error) throw categoryResult.error;
    if (productResult.error) throw productResult.error;
    setCategories(categoryResult.data ?? []);
    setProducts((productResult.data ?? []) as Product[]);
  }, []);

  useEffect(() => {
    let active = true;
    async function verifyAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/admin/login"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role,email").eq("id",user.id).maybeSingle();
      if (!active) return;
      if (profileError || profile?.role !== "admin") {
        setError("This account does not have administrator access. Ask the project owner to grant the admin role.");
        setChecking(false);
        return;
      }
      setEmail(profile.email || user.email || "");
      setAuthorized(true);
      try { await loadData(); } catch { setError("We couldn't load the admin data. Refresh the page and try again."); }
      if (active) setChecking(false);
    }
    verifyAdmin();
    return () => { active = false; };
  }, [loadData, router]);

  function updateField<K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) {
    setForm(current => ({...current,[key]:value}));
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const supabase = createClient();
    const payload = {
      title: form.title.trim(),
      slug: makeSlug(form.slug || form.title),
      category_id: form.category_id || null,
      summary: form.summary.trim() || null,
      description: form.description.trim() || null,
      price: Number(form.price),
      currency: form.currency,
      status: form.status
    };
    if (!payload.slug || !Number.isFinite(payload.price) || payload.price < 0) {
      setError("Enter a valid product name, URL slug and non-negative price."); setBusy(false); return;
    }
    let productId = editingId;
    if (editingId) {
      const { error: updateError } = await supabase.from("products").update(payload).eq("id",editingId);
      if (updateError) { setError(updateError.message); setBusy(false); return; }
    } else {
      const { data, error: insertError } = await supabase.from("products").insert(payload).select("id").single();
      if (insertError || !data) { setError(insertError?.message || "Product could not be created."); setBusy(false); return; }
      productId = data.id;
    }
    if (file && productId) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,"-");
      const path = productId + "/" + crypto.randomUUID() + "-" + safeName;
      const { error: uploadError } = await supabase.storage.from("product-downloads").upload(path,file,{upsert:false,contentType:file.type || "application/octet-stream"});
      if (uploadError) { setError("Product saved, but the file upload failed: " + uploadError.message); setBusy(false); await loadData(); return; }
      const { error: fileRowError } = await supabase.from("product_files").insert({product_id:productId,storage_path:path,file_name:file.name,content_type:file.type || null,size_bytes:file.size});
      if (fileRowError) { setError("File uploaded, but its product record could not be saved. Contact support before re-uploading."); setBusy(false); await loadData(); return; }
    }
    setForm(emptyForm); setEditingId(null); setFile(null);
    setNotice(editingId ? "Product updated successfully." : "Product created successfully.");
    await loadData();
    setBusy(false);
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({title:product.title,slug:product.slug,category_id:product.category_id || "",summary:product.summary || "",description:product.description || "",price:String(product.price),currency:product.currency,status:product.status === "archived" ? "draft" : product.status});
    setFile(null); setNotice(""); setError("");
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm('Delete "' + product.title + '"? Its attached files will also be deleted from the product records.')) return;
    setBusy(true); setError(""); setNotice("");
    const supabase = createClient();
    const { data: files } = await supabase.from("product_files").select("storage_path").eq("product_id",product.id);
    if (files?.length) {
      const { error: storageError } = await supabase.storage.from("product-downloads").remove(files.map(item=>item.storage_path));
      if (storageError) { setError("Could not remove product files. Product was not deleted."); setBusy(false); return; }
    }
    const { error: deleteError } = await supabase.from("products").delete().eq("id",product.id);
    if (deleteError) setError(deleteError.message);
    else { setNotice("Product deleted."); if (editingId===product.id) {setEditingId(null);setForm(emptyForm);} }
    await loadData(); setBusy(false);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  if (checking) return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Checking administrator access...</main>;
  if (!authorized) return <main className="min-h-screen bg-[#F5F7F8] grid place-items-center p-6"><div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-bold text-slate-900">Administrator access required</h1><p className="mt-3 text-sm leading-6 text-slate-600">{error || "This page is restricted."}</p><Link href="/admin/login" className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">Go to admin login</Link></div></main>;

  return <main className="min-h-screen bg-[#F5F7F8]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5"><div><Link href="/" className="text-lg font-extrabold text-slate-900">NBJCreative <span className="text-teal-700">Hub</span></Link><p className="mt-1 text-xs text-slate-500">Store administration</p></div><div className="flex items-center gap-4"><span className="hidden text-xs text-slate-500 sm:inline">{email}</span><button onClick={signOut} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Sign out</button></div></div></header>
    <div className="mx-auto max-w-7xl px-5 py-9">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Control centre</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Product management</h1><p className="mt-2 text-sm text-slate-500">Create products, manage prices and control what appears in your shop.</p></div><Link href="/#shop" className="text-sm font-semibold text-teal-700 hover:underline">View live shop ↗</Link></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">Total products</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{products.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">Published</p><p className="mt-2 text-3xl font-extrabold text-teal-700">{products.filter(p=>p.status==="published").length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">Drafts</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{products.filter(p=>p.status==="draft").length}</p></div></div>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">{editingId ? "Edit product" : "Add a product"}</h2><p className="mt-1 text-xs text-slate-500">Fields marked * are required. Products start as drafts unless you publish them.</p></div>{editingId && <button type="button" onClick={()=>{setEditingId(null);setForm(emptyForm);setFile(null);}} className="text-xs font-bold text-slate-500 hover:text-slate-900">Cancel editing</button>}</div>
        <form onSubmit={saveProduct} className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold text-slate-700">Product title *</span><input required value={form.title} onChange={e=>{updateField("title",e.target.value);if(!editingId)updateField("slug",makeSlug(e.target.value));}} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-600" placeholder="e.g. Freelancer Business Starter Guide"/></label>
          <label className="block"><span className="text-sm font-semibold text-slate-700">URL slug *</span><input required value={form.slug} onChange={e=>updateField("slug",makeSlug(e.target.value))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-600" placeholder="freelancer-business-starter"/></label>
          <label className="block"><span className="text-sm font-semibold text-slate-700">Category</span><select value={form.category_id} onChange={e=>updateField("category_id",e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="">Choose a category</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <div className="grid grid-cols-[1fr_110px] gap-3"><label className="block"><span className="text-sm font-semibold text-slate-700">Price *</span><input required type="number" min="0" step="0.01" value={form.price} onChange={e=>updateField("price",e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="49.00"/></label><label className="block"><span className="text-sm font-semibold text-slate-700">Currency</span><select value={form.currency} onChange={e=>updateField("currency",e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="GHS">GHS</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option></select></label></div>
          <label className="block md:col-span-2"><span className="text-sm font-semibold text-slate-700">Short summary</span><input maxLength={220} value={form.summary} onChange={e=>updateField("summary",e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="A short description shown on product cards"/></label>
          <label className="block md:col-span-2"><span className="text-sm font-semibold text-slate-700">Full description</span><textarea rows={5} value={form.description} onChange={e=>updateField("description",e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Explain what the customer receives and how it helps."/></label>
          <label className="block"><span className="text-sm font-semibold text-slate-700">Digital file (optional)</span><input type="file" onChange={chooseFile} className="mt-2 block w-full rounded-xl border border-slate-200 p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-bold"/><span className="mt-1 block text-xs text-slate-400">Stored in a private bucket. Download delivery will be enabled in a later stage.</span></label>
          <label className="block"><span className="text-sm font-semibold text-slate-700">Publication status</span><select value={form.status} onChange={e=>updateField("status",e.target.value as "draft"|"published")} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="draft">Save as draft</option><option value="published">Publish in shop</option></select></label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 md:col-span-2">{error}</p>}
          {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 md:col-span-2">{notice}</p>}
          <div className="md:col-span-2"><button disabled={busy} className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">{busy ? "Saving..." : editingId ? "Save product changes" : "Create product"}</button></div>
        </form>
      </section>
      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-5"><h2 className="text-lg font-bold text-slate-900">Your products</h2><p className="mt-1 text-xs text-slate-500">Manage drafts and published items from one place.</p></div>
        {products.length===0 ? <div className="p-12 text-center"><p className="font-semibold text-slate-800">No products added yet</p><p className="mt-2 text-sm text-slate-500">Use the form above to add your first product.</p></div> : <div className="divide-y divide-slate-100">{products.map(product=><div key={product.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{product.title}</p><p className="mt-1 text-xs text-slate-500">/{product.slug} · {product.currency} {Number(product.price).toFixed(2)}</p></div><div className="flex items-center gap-3"><span className={"rounded-full px-3 py-1 text-[11px] font-bold "+(product.status==="published"?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-600")}>{product.status}</span><button onClick={()=>startEdit(product)} className="text-xs font-bold text-teal-700 hover:underline">Edit</button><button onClick={()=>deleteProduct(product)} disabled={busy} className="text-xs font-bold text-rose-600 hover:underline disabled:opacity-50">Delete</button></div></div>)}</div>}
      </section>
      <p className="mt-8 text-center text-xs leading-5 text-slate-400">This dashboard manages catalogue records and stores uploaded files privately. Customer checkout and secure download links are not active yet.</p>
    </div>
  </main>;
}
