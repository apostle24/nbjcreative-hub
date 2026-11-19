-- NBJ Work: employer hiring workflow
alter table public.work_job_applications
  drop constraint if exists work_job_applications_status_check;

alter table public.work_job_applications
  add constraint work_job_applications_status_check
  check (status in ('submitted','viewed','shortlisted','interviewing','accepted','rejected','withdrawn'));

alter table public.work_job_applications
  add column if not exists quality_score smallint
    check (quality_score is null or quality_score between 1 and 5),
  add column if not exists interview_at timestamptz;

create index if not exists work_job_applications_status_idx
  on public.work_job_applications(status, created_at desc);

comment on column public.work_job_applications.quality_score is
  'Employer assessment of application quality, from 1 (low) to 5 (excellent).';
comment on column public.work_job_applications.interview_at is
  'Optional interview date and time set by the employer.';
