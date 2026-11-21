-- NBJCreative Hub: vendors can publish their own complete listings without admin review.
-- Seller onboarding approval remains separate from product publication.

drop policy if exists "Products: approved vendors create drafts" on public.products;
drop policy if exists "Products: vendors manage own drafts" on public.products;
drop policy if exists "Products: vendors read own listings" on public.products;

create policy "Products: approved vendors create own listings"
on public.products for insert to authenticated
with check (
  vendor_id is not null
  and status in ('draft', 'published')
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.vendor_profiles v
    where v.id = vendor_id
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

create policy "Products: approved vendors read own listings"
on public.products for select to authenticated
using (
  vendor_id is not null
  and exists (
    select 1 from public.vendor_profiles v
    where v.id = vendor_id
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

create policy "Products: approved vendors manage own listings"
on public.products for update to authenticated
using (
  vendor_id is not null
  and exists (
    select 1 from public.vendor_profiles v
    where v.id = vendor_id
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
)
with check (
  vendor_id is not null
  and status in ('draft', 'published')
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.vendor_profiles v
    where v.id = vendor_id
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

drop policy if exists "Product files: vendors add to own drafts" on public.product_files;
create policy "Product files: vendors add to own listings"
on public.product_files for insert to authenticated
with check (
  exists (
    select 1 from public.products p
    join public.vendor_profiles v on v.id = p.vendor_id
    where p.id = product_id
      and p.status in ('draft', 'published')
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

drop policy if exists "Product downloads: approved vendors upload" on storage.objects;
create policy "Product downloads: approved vendors upload own listings"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-downloads'
  and exists (
    select 1 from public.products p
    join public.vendor_profiles v on v.id = p.vendor_id
    where p.id::text = (storage.foldername(name))[1]
      and p.status in ('draft', 'published')
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

drop policy if exists "Product covers: approved vendors upload" on storage.objects;
create policy "Product covers: approved vendors upload own listings"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-covers'
  and exists (
    select 1 from public.products p
    join public.vendor_profiles v on v.id = p.vendor_id
    where p.id::text = (storage.foldername(name))[1]
      and p.status in ('draft', 'published')
      and v.owner_id = (select auth.uid())
      and v.status = 'approved'
  )
);

comment on policy "Products: approved vendors create own listings" on public.products is
  'Approved vendors may publish their own products immediately; admin approval is not required.';
