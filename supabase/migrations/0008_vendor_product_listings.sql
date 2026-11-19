-- NBJCreative Hub: secure vendor-owned product listings
alter table public.products
  add column if not exists vendor_id uuid references public.vendor_profiles(id) on delete set null;

create index if not exists products_vendor_created_idx
  on public.products(vendor_id, created_at desc);

-- Approved vendors may create draft listings only.
drop policy if exists "Products: approved vendors create drafts" on public.products;
create policy "Products: approved vendors create drafts"
on public.products for insert to authenticated
with check (
  vendor_id is not null
  and status = 'draft'
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.vendor_profiles v
    where v.id = vendor_id
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

drop policy if exists "Products: vendors manage own drafts" on public.products;
create policy "Products: vendors manage own drafts"
on public.products for update to authenticated
using (
  status = 'draft'
  and exists (
    select 1 from public.vendor_profiles v
    where v.id = vendor_id
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
)
with check (
  status = 'draft'
  and exists (
    select 1 from public.vendor_profiles v
    where v.id = vendor_id
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

drop policy if exists "Products: vendors delete own drafts" on public.products;
create policy "Products: vendors delete own drafts"
on public.products for delete to authenticated
using (
  status = 'draft'
  and exists (
    select 1 from public.vendor_profiles v
    where v.id = vendor_id
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

-- Sellers can read/manage file records only for their own draft products.
drop policy if exists "Product files: vendors read own" on public.product_files;
create policy "Product files: vendors read own"
on public.product_files for select to authenticated
using (
  exists (
    select 1 from public.products p
    join public.vendor_profiles v on v.id = p.vendor_id
    where p.id = product_id
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

drop policy if exists "Product files: vendors add to own drafts" on public.product_files;
create policy "Product files: vendors add to own drafts"
on public.product_files for insert to authenticated
with check (
  exists (
    select 1 from public.products p
    join public.vendor_profiles v on v.id = p.vendor_id
    where p.id = product_id
      and p.status = 'draft'
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

drop policy if exists "Product files: vendors delete own draft files" on public.product_files;
create policy "Product files: vendors delete own draft files"
on public.product_files for delete to authenticated
using (
  exists (
    select 1 from public.products p
    join public.vendor_profiles v on v.id = p.vendor_id
    where p.id = product_id
      and p.status = 'draft'
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

-- Vendor uploads use the product UUID as the first storage folder.
drop policy if exists "Product downloads: approved vendors upload" on storage.objects;
create policy "Product downloads: approved vendors upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-downloads'
  and exists (
    select 1
    from public.products p
    join public.vendor_profiles v on v.id = p.vendor_id
    where p.id::text = (storage.foldername(name))[1]
      and p.status = 'draft'
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

drop policy if exists "Product downloads: vendors delete own draft files" on storage.objects;
create policy "Product downloads: vendors delete own draft files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-downloads'
  and exists (
    select 1
    from public.products p
    join public.vendor_profiles v on v.id = p.vendor_id
    where p.id::text = (storage.foldername(name))[1]
      and p.status = 'draft'
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

drop policy if exists "Product covers: approved vendors upload" on storage.objects;
create policy "Product covers: approved vendors upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-covers'
  and exists (
    select 1
    from public.products p
    join public.vendor_profiles v on v.id = p.vendor_id
    where p.id::text = (storage.foldername(name))[1]
      and p.status = 'draft'
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

drop policy if exists "Product covers: vendors delete own draft covers" on storage.objects;
create policy "Product covers: vendors delete own draft covers"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-covers'
  and exists (
    select 1
    from public.products p
    join public.vendor_profiles v on v.id = p.vendor_id
    where p.id::text = (storage.foldername(name))[1]
      and p.status = 'draft'
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);


drop policy if exists "Products: vendors read own listings" on public.products;
create policy "Products: vendors read own listings"
on public.products for select to authenticated
using (
  exists (
    select 1 from public.vendor_profiles v
    where v.id = vendor_id
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);
