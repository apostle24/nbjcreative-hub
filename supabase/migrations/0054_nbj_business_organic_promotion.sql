-- 0054: Organic business discovery and homepage spotlight.
-- Ranking is based on the number of currently published Marketplace offerings.
-- No paid placement, owner-selected ranking, or private business data is introduced.

create index if not exists vendor_profiles_owner_status_idx
  on public.vendor_profiles (owner_id, status);

create index if not exists products_published_vendor_created_idx
  on public.products (vendor_id, created_at desc)
  where status = 'published';

create or replace function public.get_public_business_directory()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'business_name', b.business_name,
        'business_slug', b.business_slug,
        'description', b.description,
        'industry', b.industry,
        'country', b.country,
        'city', b.city,
        'website_url', b.website_url,
        'offerings_count', (
          select count(*)
          from public.vendor_profiles v
          join public.products p on p.vendor_id = v.id
          where v.owner_id = b.owner_id
            and v.status = 'approved'
            and p.status = 'published'
        )
      )
      order by
        (
          select count(*)
          from public.vendor_profiles v
          join public.products p on p.vendor_id = v.id
          where v.owner_id = b.owner_id
            and v.status = 'approved'
            and p.status = 'published'
        ) desc,
        b.created_at desc,
        b.business_name asc
    ),
    '[]'::jsonb
  )
  from public.business_workspaces b
  where b.is_public = true
    and b.status = 'active';
$$;

revoke all on function public.get_public_business_directory() from public;
grant execute on function public.get_public_business_directory() to anon, authenticated;

comment on function public.get_public_business_directory() is
  'Returns safe public business details and published Marketplace offering counts, ranking active public businesses with published offerings first for organic discovery.';
