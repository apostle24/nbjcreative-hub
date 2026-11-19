-- NBJCreative Hub: safe public vendor storefront
-- Exposes only approved store presentation fields and published products.
create or replace function public.get_public_vendor_store(p_store_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'store', jsonb_build_object(
      'store_name', v.store_name,
      'store_slug', v.store_slug,
      'description', v.description,
      'website_url', v.website_url
    ),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'title', p.title,
          'slug', p.slug,
          'summary', p.summary,
          'description', p.description,
          'price', p.price,
          'currency', p.currency,
          'cover_image_path', p.cover_image_path,
          'category', c.name
        )
        order by p.created_at desc
      )
      from public.products p
      left join public.categories c on c.id = p.category_id
      where p.vendor_id = v.id
        and p.status = 'published'
    ), '[]'::jsonb)
  )
  from public.vendor_profiles v
  where v.store_slug = lower(trim(p_store_slug))
    and v.status = 'approved'
  limit 1;
$$;

revoke all on function public.get_public_vendor_store(text) from public;
grant execute on function public.get_public_vendor_store(text) to anon, authenticated;

comment on function public.get_public_vendor_store(text) is
  'Returns public store presentation fields and published products only; excludes owner IDs, contact emails, and application review data.';
