-- 0069: administrator-approved full Marketplace refunds through Paystack.
-- This first release deliberately supports full-order refunds only. Academy refunds
-- remain out of scope until course-access and instructor-payout reversal are audited.
create table if not exists public.marketplace_refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  original_transaction_id text not null,
  refund_reference text not null unique,
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null,
  reason text not null check (char_length(trim(reason)) between 3 and 80),
  customer_note text check (customer_note is null or char_length(customer_note) <= 2000),
  status text not null default 'requested'
    check (status in ('requested','processing','pending','needs_attention','failed','processed','rejected')),
  admin_id uuid references auth.users(id) on delete restrict,
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  paystack_refund_id text,
  paystack_status text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_refund_requests_customer_idx
  on public.marketplace_refund_requests(customer_id, requested_at desc);
create index if not exists marketplace_refund_requests_status_idx
  on public.marketplace_refund_requests(status, requested_at desc);

alter table public.marketplace_refund_requests enable row level security;
revoke all on public.marketplace_refund_requests from public, anon, authenticated;
grant select, insert, update on public.marketplace_refund_requests to service_role;

create or replace function public.finalize_marketplace_refund(
  p_refund_request_id uuid,
  p_paystack_status text,
  p_paystack_refund_id text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.marketplace_refund_requests%rowtype;
  v_status text := lower(trim(coalesce(p_paystack_status,'')));
begin
  if p_refund_request_id is null or v_status not in
    ('pending','processing','needs_attention','failed','processed') then
    raise exception 'Invalid refund update.';
  end if;

  select * into v_refund
  from public.marketplace_refund_requests
  where id = p_refund_request_id
  for update;

  if not found then raise exception 'Refund request not found.'; end if;
  if v_refund.status = 'rejected' then raise exception 'Rejected refund cannot be updated.'; end if;
  if v_refund.status = 'processed' and v_status <> 'processed' then
    raise exception 'A processed refund cannot move backwards.';
  end if;

  update public.marketplace_refund_requests
  set status = v_status,
      paystack_status = v_status,
      paystack_refund_id = coalesce(nullif(p_paystack_refund_id,''), paystack_refund_id),
      processed_at = case when v_status = 'processed' then coalesce(processed_at, now()) else processed_at end,
      updated_at = now()
  where id = v_refund.id;

  if v_status = 'processed' then
    update public.orders
    set payment_status = 'refunded'
    where id = v_refund.order_id and payment_status = 'paid';

    update public.download_entitlements
    set revoked_at = coalesce(revoked_at, now())
    where order_item_id in (
      select oi.id from public.order_items oi where oi.order_id = v_refund.order_id
    ) and revoked_at is null;
  end if;

  return v_status;
end;
$$;

revoke all on function public.finalize_marketplace_refund(uuid,text,text) from public, anon, authenticated;
grant execute on function public.finalize_marketplace_refund(uuid,text,text) to service_role;
