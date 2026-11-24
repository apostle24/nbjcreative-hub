-- 0052: NBJ Business customer enquiries
-- Public visitors can submit enquiries only to active, publicly listed businesses.
-- Business owners/managers can read their workspace enquiries and update status.

create table if not exists public.business_enquiries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.business_workspaces(id) on delete cascade,
  sender_name text not null check (char_length(trim(sender_name)) between 2 and 120),
  sender_email text not null check (char_length(trim(sender_email)) between 5 and 254),
  sender_phone text,
  subject text not null check (char_length(trim(subject)) between 2 and 160),
  message text not null check (char_length(trim(message)) between 10 and 5000),
  status text not null default 'new' check (status in ('new','in_progress','responded','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_enquiries_workspace_created_idx
  on public.business_enquiries (workspace_id, created_at desc);

create index if not exists business_enquiries_workspace_status_idx
  on public.business_enquiries (workspace_id, status, created_at desc);

alter table public.business_enquiries enable row level security;

drop policy if exists "Business managers read customer enquiries"
  on public.business_enquiries;
create policy "Business managers read customer enquiries"
  on public.business_enquiries
  for select
  to authenticated
  using (public.can_manage_business_workspace(workspace_id));

revoke all on public.business_enquiries from anon, authenticated;
grant select on public.business_enquiries to authenticated;

create or replace function public.submit_business_enquiry(
  p_business_slug text,
  p_sender_name text,
  p_sender_email text,
  p_sender_phone text,
  p_subject text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_workspace_id uuid;
  v_enquiry_id uuid;
begin
  if p_business_slug is null or char_length(trim(p_business_slug)) < 2 then
    raise exception 'Business profile is invalid.';
  end if;

  if p_sender_name is null or char_length(trim(p_sender_name)) not between 2 and 120 then
    raise exception 'Enter your name (2 to 120 characters).';
  end if;

  if p_sender_email is null
     or char_length(trim(p_sender_email)) not between 5 and 254
     or trim(p_sender_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$' then
    raise exception 'Enter a valid email address.';
  end if;

  if p_sender_phone is not null and char_length(trim(p_sender_phone)) > 40 then
    raise exception 'Phone number is too long.';
  end if;

  if p_subject is null or char_length(trim(p_subject)) not between 2 and 160 then
    raise exception 'Enter a subject (2 to 160 characters).';
  end if;

  if p_message is null or char_length(trim(p_message)) not between 10 and 5000 then
    raise exception 'Your message must be between 10 and 5,000 characters.';
  end if;

  select b.id into v_workspace_id
  from public.business_workspaces b
  where b.business_slug = lower(trim(p_business_slug))
    and b.is_public = true
    and b.status = 'active'
  limit 1;

  if v_workspace_id is null then
    raise exception 'This business is not currently accepting public enquiries.';
  end if;

  insert into public.business_enquiries (
    workspace_id, sender_name, sender_email, sender_phone, subject, message
  )
  values (
    v_workspace_id,
    trim(p_sender_name),
    lower(trim(p_sender_email)),
    nullif(trim(coalesce(p_sender_phone, '')), ''),
    trim(p_subject),
    trim(p_message)
  )
  returning id into v_enquiry_id;

  return v_enquiry_id;
end;
$function$;

revoke all on function public.submit_business_enquiry(text,text,text,text,text,text)
  from public;
grant execute on function public.submit_business_enquiry(text,text,text,text,text,text)
  to anon, authenticated;

create or replace function public.update_business_enquiry_status(
  p_enquiry_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must sign in to manage business enquiries.';
  end if;

  if p_status not in ('new','in_progress','responded','closed') then
    raise exception 'Invalid enquiry status.';
  end if;

  select e.workspace_id into v_workspace_id
  from public.business_enquiries e
  where e.id = p_enquiry_id;

  if v_workspace_id is null
     or not public.can_manage_business_workspace(v_workspace_id) then
    raise exception 'You do not have permission to manage this enquiry.';
  end if;

  update public.business_enquiries
  set status = p_status,
      updated_at = now()
  where id = p_enquiry_id;

  return found;
end;
$function$;

revoke all on function public.update_business_enquiry_status(uuid,text)
  from public;
grant execute on function public.update_business_enquiry_status(uuid,text)
  to authenticated;

drop trigger if exists business_enquiries_updated_at on public.business_enquiries;
create trigger business_enquiries_updated_at
before update on public.business_enquiries
for each row execute function public.set_updated_at();

comment on table public.business_enquiries is
  'Private customer and business-to-business enquiries submitted to public NBJ Business profiles.';
comment on function public.submit_business_enquiry(text,text,text,text,text,text) is
  'Validates and stores a public enquiry for an active, publicly listed business without exposing private business contact details.';
