-- 0059: Correct public business enquiry email validation.
-- The original function stored two backslashes before the dot. With
-- standard_conforming_strings enabled, the regex must contain one backslash
-- to match a literal dot in an email domain.

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
     or trim(p_sender_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
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

comment on function public.submit_business_enquiry(text,text,text,text,text,text) is
  'Validates and stores a public enquiry for an active, publicly listed business without exposing private business contact details.';
