-- NBJCreative Hub: public product cover images
-- Digital downloads remain in the private product-downloads bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-covers',
  'product-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Product covers: public read" on storage.objects;
create policy "Product covers: public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-covers');

drop policy if exists "Product covers: admins upload" on storage.objects;
create policy "Product covers: admins upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-covers' and public.is_admin());

drop policy if exists "Product covers: admins update" on storage.objects;
create policy "Product covers: admins update"
on storage.objects for update
to authenticated
using (bucket_id = 'product-covers' and public.is_admin())
with check (bucket_id = 'product-covers' and public.is_admin());

drop policy if exists "Product covers: admins delete" on storage.objects;
create policy "Product covers: admins delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-covers' and public.is_admin());
