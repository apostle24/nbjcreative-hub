-- NBJ Work: private employer verification records and evidence storage
create table if not exists public.work_employer_verifications (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null unique references public.work_employer_profiles(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  organisation_type text not null check (
    organisation_type in ('company','nonprofit','government','educational','sole_trader','other')
  ),
  registration_country text not null check (char_length(trim(registration_country)) between 2 and 100),
  registration_number text check (
    registration_number is null or char_length(trim(registration_number)) <= 120
  ),
  evidence_storage_path text not null,
  evidence_file_name text not null check (char_length(trim(evidence_file_name)) between 1 and 255),
  status text not null default 'pending' check (
    status in ('pending','verified','rejected','suspended')
  ),
  applicant_note text check (applicant_note is null or char_length(applicant_note) <= 2000),
  review_note text check (review_note is null or char_length(review_note) <= 2000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_employer_verification_evidence_path_check check (
    evidence_storage_path like employer_id::text || '/%'
  )
);

create index if not exists work_employer_verifications_status_idx
  on public.work_employer_verifications(status, submitted_at desc);

drop trigger if exists work_employer_verifications_updated_at
  on public.work_employer_verifications;
create trigger work_employer_verifications_updated_at
before update on public.work_employer_verifications
for each row execute function public.set_updated_at();

alter table public.work_employer_verifications enable row level security;

-- Verification records are private: the employer owner and administrators only.
drop policy if exists "Work employer verification owner or admin read"
  on public.work_employer_verifications;
create policy "Work employer verification owner or admin read"
on public.work_employer_verifications for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.work_employer_profiles e
    where e.id = employer_id and e.owner_id = (select auth.uid())
  )
);

-- Submissions and decisions are written through server routes using the service role.
revoke all on public.work_employer_verifications from anon, authenticated;
grant select on public.work_employer_verifications to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-employer-verification',
  'work-employer-verification',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png'];

drop policy if exists "Work employer verification evidence owner upload"
  on storage.objects;
create policy "Work employer verification evidence owner upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'work-employer-verification'
  and exists (
    select 1 from public.work_employer_profiles e
    where e.id::text = (storage.foldername(name))[1]
      and e.owner_id = (select auth.uid())
  )
);

drop policy if exists "Work employer verification evidence owner or admin read"
  on storage.objects;
create policy "Work employer verification evidence owner or admin read"
on storage.objects for select to authenticated
using (
  bucket_id = 'work-employer-verification'
  and (
    public.is_admin()
    or exists (
      select 1 from public.work_employer_profiles e
      where e.id::text = (storage.foldername(name))[1]
        and e.owner_id = (select auth.uid())
    )
  )
);

comment on table public.work_employer_verifications is
  'Private evidence and review records for NBJ Work employer verification. Public profiles must never expose these fields.';
