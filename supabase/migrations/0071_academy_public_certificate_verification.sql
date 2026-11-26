-- Public, privacy-preserving verification for NBJ Academy certificates.
-- Exposes only certificate number, issue date and course title; no student data.

create or replace function public.verify_academy_certificate(p_certificate_number text)
returns table (
  certificate_number text,
  issued_at timestamptz,
  course_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.certificate_number, c.issued_at, co.title
  from public.academy_certificates c
  join public.academy_courses co on co.id = c.course_id
  where c.certificate_number = upper(trim(p_certificate_number))
  limit 1;
$$;

revoke all on function public.verify_academy_certificate(text) from public, anon, authenticated;
grant execute on function public.verify_academy_certificate(text) to anon, authenticated;
