-- 0053: Connect public NBJ Business profiles to existing marketplace listings.
-- A business profile shows published offerings owned by the same account through Vendor Centre.
create or replace function public.get_public_business_offerings(p_business_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'slug', p.slug,
        'product_type', p.product_type,
        'summary', p.summary,
        'description', p.description,
        'price', p.price,
        'currency', p.currency,
        'shipping_note', p.shipping_note,
        'delivery_note', p.delivery_note
      )
      order by p.created_at desc
    ),
    '[]'::jsonb
  )
  from public.business_workspaces b
  join public.vendor_profiles v on v.owner_id = b.owner_id
  join public.products p on p.vendor_id = v.id
  where b.business_slug = lower(trim(p_business_slug))
    and b.is_public = true
    and b.status = 'active'
    and v.status = 'approved'
    and p.status = 'published';
$function$;

revoke all on function public.get_public_business_offerings(text) from public;
grant execute on function public.get_public_business_offerings(text) to anon, authenticated;

comment on function public.get_public_business_offerings(text) is
  'Returns published marketplace products and services belonging to the owner of an active public NBJ Business profile. Reuses existing Vendor Centre listings and checkout.';
