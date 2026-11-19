-- NBJ Academy instructor earnings ledger and payout requests.
-- Earnings remain under review until an authorised finance process reconciles platform fees.
create table if not exists public.academy_instructor_earnings (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null unique references public.academy_payment_transactions(id) on delete restrict,
  instructor_id uuid not null references auth.users(id) on delete restrict,
  course_id uuid not null references public.academy_courses(id) on delete restrict,
  currency text not null check (char_length(currency) = 3),
  gross_amount numeric(12,2) not null check (gross_amount > 0),
  platform_fee_amount numeric(12,2),
  instructor_amount numeric(12,2),
  status text not null default 'pending_review'
    check (status in ('pending_review','available','requested','paid','reversed')),
  payout_request_id uuid,
  created_at timestamptz not null default now(),
  reconciled_at timestamptz,
  check (
    (status = 'pending_review' and instructor_amount is null and platform_fee_amount is null)
    or (status <> 'pending_review' and instructor_amount is not null and platform_fee_amount is not null)
  )
);

create index if not exists academy_instructor_earnings_owner_idx
  on public.academy_instructor_earnings(instructor_id, currency, status, created_at desc);

create table if not exists public.academy_instructor_payout_requests (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references auth.users(id) on delete restrict,
  currency text not null check (char_length(currency) = 3),
  amount numeric(12,2) not null check (amount > 0),
  payout_method text not null check (char_length(trim(payout_method)) between 2 and 40),
  account_name text not null check (char_length(trim(account_name)) between 2 and 120),
  account_details text not null check (char_length(trim(account_details)) between 4 and 240),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','paid','cancelled')),
  instructor_note text,
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz
);

create index if not exists academy_instructor_payout_owner_idx
  on public.academy_instructor_payout_requests(instructor_id, requested_at desc);

alter table public.academy_instructor_earnings enable row level security;
alter table public.academy_instructor_payout_requests enable row level security;

drop policy if exists "Instructors view own Academy earnings" on public.academy_instructor_earnings;
create policy "Instructors view own Academy earnings"
  on public.academy_instructor_earnings for select to authenticated
  using (instructor_id = auth.uid());

drop policy if exists "Instructors view own Academy payout requests" on public.academy_instructor_payout_requests;
create policy "Instructors view own Academy payout requests"
  on public.academy_instructor_payout_requests for select to authenticated
  using (instructor_id = auth.uid());

grant select on public.academy_instructor_earnings to authenticated;
grant select on public.academy_instructor_payout_requests to authenticated;
revoke insert, update, delete on public.academy_instructor_earnings from anon, authenticated;
revoke insert, update, delete on public.academy_instructor_payout_requests from anon, authenticated;

create or replace function public.record_academy_instructor_earning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_instructor uuid;
begin
  if new.status <> 'paid' or old.status = 'paid' then
    return new;
  end if;

  select c.instructor_id into v_instructor
  from public.academy_courses c
  where c.id = new.course_id;

  if v_instructor is not null then
    insert into public.academy_instructor_earnings(
      payment_transaction_id, instructor_id, course_id, currency, gross_amount
    ) values (
      new.id, v_instructor, new.course_id, upper(new.currency), new.amount
    ) on conflict (payment_transaction_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists academy_record_instructor_earning on public.academy_payment_transactions;
create trigger academy_record_instructor_earning
after update of status on public.academy_payment_transactions
for each row execute function public.record_academy_instructor_earning();

-- Backfill payments already confirmed before this ledger was introduced.
insert into public.academy_instructor_earnings(
  payment_transaction_id, instructor_id, course_id, currency, gross_amount
)
select p.id, c.instructor_id, p.course_id, upper(p.currency), p.amount
from public.academy_payment_transactions p
join public.academy_courses c on c.id = p.course_id
where p.status = 'paid'
on conflict (payment_transaction_id) do nothing;

create or replace function public.request_academy_instructor_payout(
  p_currency text,
  p_payout_method text,
  p_account_name text,
  p_account_details text
)
returns table(payout_request_id uuid, requested_amount numeric, requested_currency text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_amount numeric(12,2);
  v_request_id uuid;
begin
  if v_user is null then raise exception 'Please sign in to request a payout.'; end if;
  if char_length(v_currency) <> 3
     or char_length(trim(coalesce(p_payout_method, ''))) not between 2 and 40
     or char_length(trim(coalesce(p_account_name, ''))) not between 2 and 120
     or char_length(trim(coalesce(p_account_details, ''))) not between 4 and 240 then
    raise exception 'Enter valid payout currency and payment details.';
  end if;

  perform 1 from public.academy_instructor_earnings e
  where e.instructor_id = v_user and e.currency = v_currency and e.status = 'available'
  for update;

  select coalesce(sum(e.instructor_amount), 0) into v_amount
  from public.academy_instructor_earnings e
  where e.instructor_id = v_user and e.currency = v_currency and e.status = 'available';

  if v_amount <= 0 then
    raise exception 'There is no available balance in this currency to request.';
  end if;

  insert into public.academy_instructor_payout_requests(
    instructor_id, currency, amount, payout_method, account_name, account_details
  ) values (
    v_user, v_currency, v_amount, trim(p_payout_method), trim(p_account_name), trim(p_account_details)
  ) returning id into v_request_id;

  update public.academy_instructor_earnings
  set status = 'requested', payout_request_id = v_request_id
  where instructor_id = v_user and currency = v_currency and status = 'available';

  return query select v_request_id, v_amount, v_currency;
end;
$$;

revoke all on function public.request_academy_instructor_payout(text,text,text,text) from public;
revoke all on function public.request_academy_instructor_payout(text,text,text,text) from anon;
grant execute on function public.request_academy_instructor_payout(text,text,text,text) to authenticated;
