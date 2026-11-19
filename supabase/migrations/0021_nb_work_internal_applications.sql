-- NBJ Work: allow internal applications when no external application channel is set.
alter table public.work_job_posts
  drop constraint if exists work_job_application_contact_check;

comment on column public.work_job_posts.application_url is
  'Optional external application URL. Leave blank to accept applications inside NBJ Work.';
comment on column public.work_job_posts.application_email is
  'Optional application email. Leave blank to accept applications inside NBJ Work.';
