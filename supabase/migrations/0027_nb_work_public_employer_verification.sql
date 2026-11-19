-- Public-safe employer verification flag. Private evidence remains in work_employer_verifications.
alter table public.work_employer_profiles
  add column if not exists is_verified boolean not null default false;

create index if not exists work_employer_profiles_verified_idx
  on public.work_employer_profiles(is_verified)
  where is_verified = true;

comment on column public.work_employer_profiles.is_verified is
  'Public-safe indicator set only by the administrator verification workflow.';
