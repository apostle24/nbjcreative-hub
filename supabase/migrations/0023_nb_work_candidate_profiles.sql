-- NBJ Work: candidate professional profiles and private CV documents

create table if not exists public.work_candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  professional_headline text check (professional_headline is null or char_length(professional_headline) <= 160),
  professional_summary text check (professional_summary is null or char_length(professional_summary) <= 3000),
  location text check (location is null or char_length(location) <= 120),
  country text check (country is null or char_length(country) <= 100),
  skills text[] not null default '{}'::text[],
  experience_years smallint check (experience_years is null or experience_years between 0 and 60),
  education text check (education is null or char_length(education) <= 2000),
  certifications text check (certifications is null or char_length(certifications) <= 2000),
  website_url text,
  linkedin_url text,
  portfolio_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_candidate_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  document_type text not null default 'resume' check (document_type in ('resume','certificate','portfolio')),
  created_at timestamptz not null default now()
);

create index if not exists work_candidate_documents_user_idx
  on public.work_candidate_documents(user_id, created_at desc);

drop trigger if exists work_candidate_profiles_updated_at on public.work_candidate_profiles;
create trigger work_candidate_profiles_updated_at
before update on public.work_candidate_profiles
for each row execute function public.set_updated_at();

alter table public.work_candidate_profiles enable row level security;
alter table public.work_candidate_documents enable row level security;

drop policy if exists "Work candidate profile owner and public read" on public.work_candidate_profiles;
create policy "Work candidate profile owner and public read"
on public.work_candidate_profiles for select to anon, authenticated
using (is_public = true or user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Work candidate profile owner insert" on public.work_candidate_profiles;
create policy "Work candidate profile owner insert"
on public.work_candidate_profiles for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Work candidate profile owner update" on public.work_candidate_profiles;
create policy "Work candidate profile owner update"
on public.work_candidate_profiles for update to authenticated
using (user_id = (select auth.uid()) or public.is_admin())
with check (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Work candidate profile owner delete" on public.work_candidate_profiles;
create policy "Work candidate profile owner delete"
on public.work_candidate_profiles for delete to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Work candidate documents owner read" on public.work_candidate_documents;
create policy "Work candidate documents owner read"
on public.work_candidate_documents for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Work candidate documents owner insert" on public.work_candidate_documents;
create policy "Work candidate documents owner insert"
on public.work_candidate_documents for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Work candidate documents owner delete" on public.work_candidate_documents;
create policy "Work candidate documents owner delete"
on public.work_candidate_documents for delete to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

grant select, insert, update, delete on public.work_candidate_profiles to authenticated;
grant select, insert, delete on public.work_candidate_documents to authenticated;
grant select on public.work_candidate_profiles to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-candidate-files',
  'work-candidate-files',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "NBJ Work candidate files owner read" on storage.objects;
create policy "NBJ Work candidate files owner read"
on storage.objects for select to authenticated
using (
  bucket_id = 'work-candidate-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "NBJ Work candidate files owner upload" on storage.objects;
create policy "NBJ Work candidate files owner upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'work-candidate-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "NBJ Work candidate files owner delete" on storage.objects;
create policy "NBJ Work candidate files owner delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'work-candidate-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

comment on table public.work_candidate_profiles is
  'Candidate professional profile for NBJ Work. Profiles are private unless the candidate explicitly enables public visibility.';
comment on table public.work_candidate_documents is
  'Private CV, certificate and portfolio documents uploaded by the candidate.';
