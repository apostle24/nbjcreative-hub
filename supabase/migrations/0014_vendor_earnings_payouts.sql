-- NBJCreative Hub: vendor earnings and payout requests.
-- Earnings are gross paid product sales. Platform fees and external transfers are not
-- calculated or executed until a payout provider and commission policy are configured.

create table if not exists public.vendor_payout_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','paid')),
  vendor_note text,
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz
);

create index if not exists vendor_payout_requests_vendor_date_idx
  on public.vendor_payout_requests(vendor_id, requested_at desc);
create index if not exists vendor_payout_requests_status_date_idx
  on public.vendor_payout_requests(status, requested_at desc);

alter table public.vendor_payout_requests enable row level security;

drop policy if exists "Vendors read own payout requests" on public.vendor_payout_requests;
create policy "Vendors read own payout requests"
on public.vendor_payout_requests for select to authenticated
using (exists (
  select 1 from public.vendor_profiles v
  where v.id = vendor_id and v.owner_id = (select auth.uid())
) or public.is_admin());

drop policy if exists "Admins manage payout requests" on public.vendor_payout_requests;
create policy "Admins manage payout requests"
on public.vendor_payout_requests for all to authenticated
using (public.is_admin()) with check (public.is_admin());

grant select on public.vendor_payout_requests to authenticated;

create or replace function public.get_vendor_earnings()
returns table(currency text, gross_sales numeric, reserved_amount numeric, available_balance numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_vendor_id uuid;
begin
  select id into v_vendor_id
  from public.vendor_profiles
  where owner_id = (select auth.uid()) and status = 'approved';

  if v_vendor_id is null then
    raise exception 'An approved vendor account is required.';
  end if;

  return query
  with currencies as (
    select oi.currency::text as currency
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    join public.orders o on o.id = oi.order_id
    where p.vendor_id = v_vendor_id and o.payment_status = 'paid'
    group by oi.currency
    union
    select r.currency::text
    from public.vendor_payout_requests r
    where r.vendor_id = v_vendor_id and r.status in ('pending','approved','paid')
  ),
  sales as (
    select oi.currency::text as currency,
      coalesce(sum(oi.unit_price * oi.quantity),0)::numeric as gross_sales
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    join public.orders o on o.id = oi.order_id
    where p.vendor_id = v_vendor_id and o.payment_status = 'paid'
    group by oi.currency
  ),
  reservations as (
    select r.currency::text as currency,
      coalesce(sum(r.amount),0)::numeric as reserved_amount
    from public.vendor_payout_requests r
    where r.vendor_id = v_vendor_id and r.status in ('pending','approved','paid')
    group by r.currency
  )
  select c.currency,
    coalesce(s.gross_sales,0),
    coalesce(r.reserved_amount,0),
    greatest(coalesce(s.gross_sales,0) - coalesce(r.reserved_amount,0),0)
  from currencies c
  left join sales s using (currency)
  left join reservations r using (currency)
  order by c.currency;
end;
$$;

revoke all on function public.get_vendor_earnings() from public, anon;
grant execute on function public.get_vendor_earnings() to authenticated;

create or replace function public.request_vendor_payout(p_amount numeric, p_currency text, p_vendor_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vendor public.vendor_profiles%rowtype;
  v_gross numeric(12,2);
  v_reserved numeric(12,2);
  v_request_id uuid;
  v_currency text;
begin
  v_currency := upper(trim(coalesce(p_currency,'')));
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount,2)
     or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Enter a valid payout amount and currency.';
  end if;
  if p_vendor_note is not null and char_length(p_vendor_note) > 500 then
    raise exception 'Payout note must be 500 characters or fewer.';
  end if;

  select * into v_vendor
  from public.vendor_profiles
  where owner_id = (select auth.uid()) and status = 'approved'
  for update;

  if not found then
    raise exception 'An approved vendor account is required.';
  end if;

  select coalesce(sum(oi.unit_price * oi.quantity),0)::numeric(12,2)
  into v_gross
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  join public.orders o on o.id = oi.order_id
  where p.vendor_id = v_vendor.id
    and o.payment_status = 'paid'
    and upper(trim(oi.currency::text)) = v_currency;

  select coalesce(sum(amount),0)::numeric(12,2)
  into v_reserved
  from public.vendor_payout_requests
  where vendor_id = v_vendor.id
    and upper(trim(currency::text)) = v_currency
    and status in ('pending','approved','paid');

  if p_amount > greatest(v_gross - v_reserved,0) then
    raise exception 'Requested amount exceeds your available balance.';
  end if;

  insert into public.vendor_payout_requests(vendor_id, amount, currency, vendor_note)
  values (v_vendor.id, p_amount, v_currency, nullif(trim(p_vendor_note),''))
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.request_vendor_payout(numeric,text,text) from public, anon;
grant execute on function public.request_vendor_payout(numeric,text,text) to authenticated;
