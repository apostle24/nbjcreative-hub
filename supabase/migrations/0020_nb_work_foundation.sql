-- NBJCreative Hub: NBJ Work jobs and freelance marketplace foundation
create table if not exists public.work_employer_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  company_name text not null check (char_length(trim(company_name)) between 2 and 120),
  company_slug text not null unique check (company_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  website_url text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_job_posts (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.work_employer_profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 5 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null check (char_length(trim(description)) between 30 and 12000),
  opportunity_type text not null check (opportunity_type in ('full_time','part_time','contract','freelance','internship','volunteer')),
  workplace_type text not null default 'remote' check (workplace_type in ('remote','hybrid','onsite')),
  location text,
  country text,
  salary_min numeric(12,2) check (salary_min is null or salary_min >= 0),
  salary_max numeric(12,2) check (salary_max is null or salary_max >= 0),
  currency char(3) not null default 'USD',
  application_url text,
  application_email text,
  status text not null default 'draft' check (status in ('draft','published','closed','archived')),
  application_deadline date,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_job_salary_range_check check (
    salary_min is null or salary_max is null or salary_max >= salary_min
  ),
  constraint work_job_application_contact_check check (
    application_url is not null or application_email is not null
  )
);

create table if not exists public.work_job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.work_job_posts(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  cover_letter text not null check (char_length(trim(cover_letter)) between 20 and 5000),
  resume_url text,
  status text not null default 'submitted' check (status in ('submitted','viewed','shortlisted','rejected','withdrawn')),
  employer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);

create index if not exists work_job_posts_public_idx
  on public.work_job_posts(status, published_at desc);
create index if not exists work_job_posts_employer_idx
  on public.work_job_posts(employer_id, created_at desc);
create index if not exists work_job_applications_applicant_idx
  on public.work_job_applications(applicant_id, created_at desc);
create index if not exists work_job_applications_job_idx
  on public.work_job_applications(job_id, created_at desc);

drop trigger if exists work_employer_profiles_updated_at on public.work_employer_profiles;
create trigger work_employer_profiles_updated_at
before update on public.work_employer_profiles
for each row execute function public.set_updated_at();

drop trigger if exists work_job_posts_updated_at on public.work_job_posts;
create trigger work_job_posts_updated_at
before update on public.work_job_posts
for each row execute function public.set_updated_at();

drop trigger if exists work_job_applications_updated_at on public.work_job_applications;
create trigger work_job_applications_updated_at
before update on public.work_job_applications
for each row execute function public.set_updated_at();

alter table public.work_employer_profiles enable row level security;
alter table public.work_job_posts enable row level security;
alter table public.work_job_applications enable row level security;

-- Employer profiles are public to read, but owners control their own company profile.
drop policy if exists "Work employers public read" on public.work_employer_profiles;
create policy "Work employers public read"
on public.work_employer_profiles for select to anon, authenticated
using (true);

drop policy if exists "Work employers create own" on public.work_employer_profiles;
create policy "Work employers create own"
on public.work_employer_profiles for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "Work employers update own" on public.work_employer_profiles;
create policy "Work employers update own"
on public.work_employer_profiles for update to authenticated
using (owner_id = (select auth.uid()) or public.is_admin())
with check (owner_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Work employers admin delete" on public.work_employer_profiles;
create policy "Work employers admin delete"
on public.work_employer_profiles for delete to authenticated
using (public.is_admin());

-- Anyone can browse published jobs. Employers can manage only their own posts.
drop policy if exists "Work jobs public published read" on public.work_job_posts;
create policy "Work jobs public published read"
on public.work_job_posts for select to anon, authenticated
using (
  status = 'published'
  or public.is_admin()
  or exists (
    select 1 from public.work_employer_profiles e
    where e.id = employer_id and e.owner_id = (select auth.uid())
  )
);

drop policy if exists "Work jobs employer create draft" on public.work_job_posts;
create policy "Work jobs employer create draft"
on public.work_job_posts for insert to authenticated
with check (
  status = 'draft'
  and exists (
    select 1 from public.work_employer_profiles e
    where e.id = employer_id and e.owner_id = (select auth.uid())
  )
);

drop policy if exists "Work jobs employer update own" on public.work_job_posts;
create policy "Work jobs employer update own"
on public.work_job_posts for update to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.work_employer_profiles e
    where e.id = employer_id and e.owner_id = (select auth.uid())
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.work_employer_profiles e
    where e.id = employer_id and e.owner_id = (select auth.uid())
  )
);

drop policy if exists "Work jobs employer delete own draft" on public.work_job_posts;
create policy "Work jobs employer delete own draft"
on public.work_job_posts for delete to authenticated
using (
  status = 'draft'
  and exists (
    select 1 from public.work_employer_profiles e
    where e.id = employer_id and e.owner_id = (select auth.uid())
  )
);

-- Applicants can create and read their own applications; employers can read applications
-- for jobs they own. Status changes will be handled through a checked server endpoint.
drop policy if exists "Work applications applicant read own" on public.work_job_applications;
create policy "Work applications applicant read own"
on public.work_job_applications for select to authenticated
using (
  applicant_id = (select auth.uid())
  or public.is_admin()
  or exists (
    select 1
    from public.work_job_posts j
    join public.work_employer_profiles e on e.id = j.employer_id
    where j.id = job_id and e.owner_id = (select auth.uid())
  )
);

drop policy if exists "Work applications submit own" on public.work_job_applications;
create policy "Work applications submit own"
on public.work_job_applications for insert to authenticated
with check (
  applicant_id = (select auth.uid())
  and status = 'submitted'
  and employer_note is null
  and exists (
    select 1 from public.work_job_posts j
    where j.id = job_id and j.status = 'published'
      and (j.application_deadline is null or j.application_deadline >= current_date)
  )
);

drop policy if exists "Work applications admin manage" on public.work_job_applications;
create policy "Work applications admin manage"
on public.work_job_applications for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.work_employer_profiles, public.work_job_posts to anon, authenticated;
grant insert, update, delete on public.work_employer_profiles to authenticated;
grant insert, update, delete on public.work_job_posts to authenticated;
grant select, insert on public.work_job_applications to authenticated;
revoke all on public.work_job_applications from anon;
revoke update, delete on public.work_job_applications from authenticated;

comment on table public.work_employer_profiles is
  'Company or client profiles for NBJ Work employers and freelance project owners.';
comment on table public.work_job_posts is
  'Published jobs, freelance projects, contracts, internships and volunteer opportunities.';
comment on table public.work_job_applications is
  'Private applications. Applicants see their own; the job owner and administrators can review them.';
