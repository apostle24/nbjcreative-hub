-- 0051: NBJ Business public profiles and directory
-- Reuses business_workspaces; no duplicate business records or marketplace tables.

alter table public.business_workspaces
  add column if not exists is_public boolean not null default false;

create index if not exists business_workspaces_public_directory_idx
  on public.business_workspaces (industry, country, city, created_at desc)
  where is_public = true and status = 'active';

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
        'website_url', b.website_url
      )
      order by b.business_name
    ),
    '[]'::jsonb
  )
  from public.business_workspaces b
  where b.is_public = true
    and b.status = 'active';
$$;

create or replace function public.get_public_business_profile(p_business_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business_name', b.business_name,
    'business_slug', b.business_slug,
    'description', b.description,
    'industry', b.industry,
    'country', b.country,
    'city', b.city,
    'website_url', b.website_url
  )
  from public.business_workspaces b
  where b.business_slug = lower(trim(p_business_slug))
    and b.is_public = true
    and b.status = 'active'
  limit 1;
$$;

revoke all on function public.get_public_business_directory() from public;
revoke all on function public.get_public_business_profile(text) from public;
grant execute on function public.get_public_business_directory() to anon, authenticated;
grant execute on function public.get_public_business_profile(text) to anon, authenticated;

comment on column public.business_workspaces.is_public is
  'Owner-controlled public listing visibility. Private business contact email and phone are never exposed by public directory functions.';
comment on function public.get_public_business_directory() is
  'Returns only business fields approved for public discovery; excludes owner IDs and private contact details.';
comment on function public.get_public_business_profile(text) is
  'Returns a public business profile only when the owner has enabled public visibility.';
