-- NBJ Work: attach private candidate CVs to internal applications
alter table public.work_job_applications
  add column if not exists resume_document_id uuid references public.work_candidate_documents(id) on delete restrict,
  add column if not exists resume_storage_path text,
  add column if not exists resume_file_name text;

create or replace function public.set_work_application_resume_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.resume_document_id is null then
    new.resume_storage_path := null;
    new.resume_file_name := null;
    return new;
  end if;

  select d.storage_path, d.file_name
    into new.resume_storage_path, new.resume_file_name
  from public.work_candidate_documents d
  where d.id = new.resume_document_id
    and d.user_id = new.applicant_id;

  if new.resume_storage_path is null then
    raise exception 'Selected CV does not belong to this applicant.';
  end if;
  return new;
end;
$$;

drop trigger if exists work_application_resume_snapshot on public.work_job_applications;
create trigger work_application_resume_snapshot
before insert or update of resume_document_id, applicant_id
on public.work_job_applications
for each row execute function public.set_work_application_resume_snapshot();

drop policy if exists "NBJ Work employer can read application CV files" on storage.objects;
create policy "NBJ Work employer can read application CV files"
on storage.objects for select to authenticated
using (
  bucket_id = 'work-candidate-files'
  and exists (
    select 1
    from public.work_job_applications a
    join public.work_job_posts j on j.id = a.job_id
    join public.work_employer_profiles e on e.id = j.employer_id
    where a.resume_storage_path = storage.objects.name
      and e.owner_id = (select auth.uid())
  )
);

comment on column public.work_job_applications.resume_document_id is
  'Candidate-selected private CV document attached to this application.';
comment on column public.work_job_applications.resume_storage_path is
  'Private storage path snapshot for employer-authorised application access.';
