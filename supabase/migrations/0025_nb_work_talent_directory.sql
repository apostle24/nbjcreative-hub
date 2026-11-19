-- NBJ Work: safe public candidate directory RPCs
create or replace function public.search_public_work_candidates(
  p_query text default null,
  p_country text default null,
  p_skill text default null,
  p_limit integer default 50
)
returns table (
  profile_id uuid,
  professional_headline text,
  professional_summary text,
  location text,
  country text,
  skills text[],
  experience_years smallint,
  education text,
  certifications text,
  website_url text,
  linkedin_url text,
  portfolio_url text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.professional_headline, p.professional_summary, p.location,
         p.country, p.skills, p.experience_years, p.education, p.certifications,
         p.website_url, p.linkedin_url, p.portfolio_url, p.updated_at
  from public.work_candidate_profiles p
  where p.is_public = true
    and (nullif(trim(p_country), '') is null or lower(coalesce(p.country,'')) = lower(trim(p_country)))
    and (nullif(trim(p_skill), '') is null or exists (
      select 1 from unnest(p.skills) s where s ilike '%' || trim(p_skill) || '%'
    ))
    and (nullif(trim(p_query), '') is null or
      concat_ws(' ', p.professional_headline, p.professional_summary, p.location,
                p.country, array_to_string(p.skills, ' '), p.education) ilike '%' || trim(p_query) || '%')
  order by p.updated_at desc
  limit least(greatest(coalesce(p_limit,50),1),100);
$$;

create or replace function public.get_public_work_candidate(p_profile_id uuid)
returns table (
  profile_id uuid,
  professional_headline text,
  professional_summary text,
  location text,
  country text,
  skills text[],
  experience_years smallint,
  education text,
  certifications text,
  website_url text,
  linkedin_url text,
  portfolio_url text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.professional_headline, p.professional_summary, p.location,
         p.country, p.skills, p.experience_years, p.education, p.certifications,
         p.website_url, p.linkedin_url, p.portfolio_url, p.updated_at
  from public.work_candidate_profiles p
  where p.id = p_profile_id and p.is_public = true
  limit 1;
$$;

revoke all on function public.search_public_work_candidates(text,text,text,integer) from public;
revoke all on function public.get_public_work_candidate(uuid) from public;
grant execute on function public.search_public_work_candidates(text,text,text,integer) to anon, authenticated;
grant execute on function public.get_public_work_candidate(uuid) to anon, authenticated;
