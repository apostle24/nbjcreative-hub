-- NBJ Academy finance audit trail and atomic admin operations.
create table if not exists public.academy_finance_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('earning_reconciled','payout_approved','payout_rejected','payout_marked_paid')),
  earning_id uuid references public.academy_instructor_earnings(id) on delete restrict,
  payout_request_id uuid references public.academy_instructor_payout_requests(id) on delete restrict,
  amount numeric(12,2),
  currency text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists academy_finance_audit_created_idx
  on public.academy_finance_audit_log(created_at desc);
create index if not exists academy_finance_audit_payout_idx
  on public.academy_finance_audit_log(payout_request_id, created_at desc);

alter table public.academy_finance_audit_log enable row level security;
revoke all on public.academy_finance_audit_log from anon, authenticated;
grant select, insert on public.academy_finance_audit_log to service_role;

create or replace function public.admin_reconcile_academy_earning(
  p_admin_id uuid,
  p_earning_id uuid,
  p_platform_fee numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.academy_instructor_earnings%rowtype;
begin
  if p_admin_id is null or p_earning_id is null or p_platform_fee is null or p_platform_fee < 0 then
    raise exception 'Invalid reconciliation details.';
  end if;

  select * into v_row
  from public.academy_instructor_earnings
  where id = p_earning_id
  for update;

  if not found then raise exception 'Earning record not found.'; end if;
  if v_row.status <> 'pending_review' then raise exception 'This earning has already been reconciled.'; end if;
  if p_platform_fee >= v_row.gross_amount then raise exception 'Platform fee must be less than gross payment.'; end if;

  update public.academy_instructor_earnings
  set platform_fee_amount = round(p_platform_fee, 2),
      instructor_amount = round(v_row.gross_amount - p_platform_fee, 2),
      status = 'available',
      reconciled_at = now()
  where id = p_earning_id;

  insert into public.academy_finance_audit_log(actor_id, action, earning_id, amount, currency)
  values (p_admin_id, 'earning_reconciled', p_earning_id, round(p_platform_fee,2), v_row.currency);
end;
$$;

create or replace function public.admin_update_academy_payout(
  p_admin_id uuid,
  p_payout_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout public.academy_instructor_payout_requests%rowtype;
  v_action text;
begin
  if p_admin_id is null or p_payout_id is null or p_status not in ('approved','rejected','paid') then
    raise exception 'Invalid payout update.';
  end if;

  select * into v_payout
  from public.academy_instructor_payout_requests
  where id = p_payout_id
  for update;

  if not found then raise exception 'Payout request not found.'; end if;

  if p_status in ('approved','rejected') and v_payout.status <> 'pending' then
    raise exception 'Only pending requests can be approved or rejected.';
  end if;
  if p_status = 'paid' and v_payout.status <> 'approved' then
    raise exception 'Only approved requests can be marked paid.';
  end if;

  update public.academy_instructor_payout_requests
  set status = p_status,
      admin_note = nullif(left(coalesce(p_note,''),2000),''),
      reviewed_at = case when p_status in ('approved','rejected') then now() else reviewed_at end,
      paid_at = case when p_status = 'paid' then now() else paid_at end
  where id = p_payout_id;

  if p_status = 'paid' then
    update public.academy_instructor_earnings
    set status = 'paid'
    where payout_request_id = p_payout_id and status = 'requested';
    if not found then raise exception 'No reserved earnings were found for this payout. Transaction rolled back.'; end if;
    v_action := 'payout_marked_paid';
  elsif p_status = 'rejected' then
    update public.academy_instructor_earnings
    set status = 'available', payout_request_id = null
    where payout_request_id = p_payout_id and status = 'requested';
    if not found then raise exception 'No reserved earnings were found for this payout. Transaction rolled back.'; end if;
    v_action := 'payout_rejected';
  else
    v_action := 'payout_approved';
  end if;

  insert into public.academy_finance_audit_log(actor_id, action, payout_request_id, amount, currency, note)
  values (p_admin_id, v_action, p_payout_id, v_payout.amount, v_payout.currency, nullif(left(coalesce(p_note,''),2000),''));
end;
$$;

revoke all on function public.admin_reconcile_academy_earning(uuid,uuid,numeric) from public, anon, authenticated;
revoke all on function public.admin_update_academy_payout(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.admin_reconcile_academy_earning(uuid,uuid,numeric) to service_role;
grant execute on function public.admin_update_academy_payout(uuid,uuid,text,text) to service_role;
