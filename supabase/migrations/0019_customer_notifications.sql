-- NBJCreative Hub: customer notifications centre
create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null check (notification_type in ('order_paid','download_ready','review_status','account','announcement')),
  title text not null,
  message text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customer_notifications_customer_created_idx
  on public.customer_notifications(customer_id, created_at desc);
create index if not exists customer_notifications_unread_idx
  on public.customer_notifications(customer_id, read_at) where read_at is null;

alter table public.customer_notifications enable row level security;
drop policy if exists "Customers read own notifications" on public.customer_notifications;
create policy "Customers read own notifications"
on public.customer_notifications for select to authenticated
using (customer_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Customers mark own notifications read" on public.customer_notifications;
create policy "Customers mark own notifications read"
on public.customer_notifications for update to authenticated
using (customer_id = (select auth.uid()))
with check (customer_id = (select auth.uid()));

grant select on public.customer_notifications to authenticated;
grant update (read_at) on public.customer_notifications to authenticated;
revoke insert, delete on public.customer_notifications from anon, authenticated;

create or replace function public.notify_customer_order_paid()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid'
     and new.customer_id is not null then
    insert into public.customer_notifications(customer_id, notification_type, title, message, action_url)
    values (new.customer_id, 'order_paid', 'Payment confirmed',
      'Your payment for order ' || new.reference || ' has been confirmed.',
      '/account/orders');
  end if;
  return new;
end;
$$;

drop trigger if exists customer_paid_order_notification on public.orders;
create trigger customer_paid_order_notification
after update of payment_status on public.orders
for each row execute function public.notify_customer_order_paid();

create or replace function public.notify_customer_download_ready()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_order_reference text;
  v_product_title text;
begin
  if new.customer_id is not null then
    select o.reference, oi.product_title into v_order_reference, v_product_title
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = new.order_item_id and o.customer_id = new.customer_id
    limit 1;

    if v_order_reference is not null then
      insert into public.customer_notifications(customer_id, notification_type, title, message, action_url)
      values (new.customer_id, 'download_ready', 'Your download is ready',
        coalesce(v_product_title, 'A purchased product') || ' is ready to download (order ' || v_order_reference || ').',
        '/account/orders');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists customer_download_ready_notification on public.download_entitlements;
create trigger customer_download_ready_notification
after insert on public.download_entitlements
for each row execute function public.notify_customer_download_ready();

create or replace function public.notify_customer_review_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_order_customer uuid;
begin
  if new.status is distinct from old.status and new.status in ('published','rejected') then
    select o.customer_id into v_order_customer
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = new.order_item_id
    limit 1;

    if v_order_customer is not null then
      insert into public.customer_notifications(customer_id, notification_type, title, message, action_url)
      values (v_order_customer, 'review_status',
        case new.status when 'published' then 'Your review is published' else 'Your review needs attention' end,
        case new.status when 'published' then 'Your product review is now visible to other customers.' else 'Your product review was not published. You can contact support if you need help.' end,
        '/account/orders');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists customer_review_status_notification on public.product_reviews;
create trigger customer_review_status_notification
after update of status on public.product_reviews
for each row execute function public.notify_customer_review_status();
