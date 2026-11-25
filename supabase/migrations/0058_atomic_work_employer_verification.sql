-- Make NBJ Work employer verification decisions and public badge updates atomic.
create or replace function public.admin_review_work_employer_verification(
  p_request_id uuid,
  p_status text,
  p_review_note text,
  p_reviewed_by uuid
)
returns table (
  id uuid,
  status text,
  review_note text,
  reviewed_at timestamptz,
  employer_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employer_id uuid;
  v_reviewed_at timestamptz := now();
begin
  if p_status not in ('pending', 'verified', 'rejected', 'suspended') then
    raise exception 'Invalid verification status';
  end if;

  select v.employer_id
    into v_employer_id
  from public.work_employer_verifications as v
  where v.id = p_request_id
  for update;

  if not found then
    raise exception 'Verification request not found';
  end if;

  update public.work_employer_verifications as v
  set status = p_status,
      review_note = nullif(left(coalesce(p_review_note, ''), 2000), ''),
      reviewed_by = p_reviewed_by,
      reviewed_at = v_reviewed_at
  where v.id = p_request_id;

  update public.work_employer_profiles as e
  set is_verified = (p_status = 'verified')
  where e.id = v_employer_id;

  return query
  select v.id, v.status, v.review_note, v.reviewed_at, v.employer_id
  from public.work_employer_verifications as v
  where v.id = p_request_id;
end;
$$;

revoke all on function public.admin_review_work_employer_verification(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_review_work_employer_verification(uuid, text, text, uuid)
  to service_role;

comment on function public.admin_review_work_employer_verification(uuid, text, text, uuid) is
  'Atomically records an administrator employer-verification decision and synchronizes the public employer verification flag.';
