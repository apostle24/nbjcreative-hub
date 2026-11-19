-- NBJCreative Hub: vendor notifications
create table if not exists public.vendor_notifications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_profiles(id) on delete cascade,
  notification_type text not null check (notification_type in ('store_status','product_status','new_order','announcement')),
  title text not null,
  message text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists vendor_notifications_vendor_created_idx
  on public.vendor_notifications(vendor_id, created_at desc);
create index if not exists vendor_notifications_unread_idx
  on public.vendor_notifications(vendor_id, read_at) where read_at is null;

alter table public.vendor_notifications enable row level security;
drop policy if exists "Vendors read own notifications" on public.vendor_notifications;
create policy "Vendors read own notifications"
on public.vendor_notifications for select to authenticated
using (exists (
  select 1 from public.vendor_profiles v
  where v.id = vendor_id and v.owner_id = (select auth.uid())
));
drop policy if exists "Vendors mark own notifications read" on public.vendor_notifications;
create policy "Vendors mark own notifications read"
on public.vendor_notifications for update to authenticated
using (exists (
  select 1 from public.vendor_profiles v
  where v.id = vendor_id and v.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.vendor_profiles v
  where v.id = vendor_id and v.owner_id = (select auth.uid())
));
grant select on public.vendor_notifications to authenticated;
grant update (read_at) on public.vendor_notifications to authenticated;

create or replace function public.notify_vendor_store_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.vendor_notifications(vendor_id, notification_type, title, message, action_url)
    values (
      new.id, 'store_status',
      case new.status when 'approved' then 'Your store is approved'
        when 'rejected' then 'Your store application was not approved'
        when 'suspended' then 'Your store has been suspended'
        else 'Your store application status changed' end,
      case new.status when 'approved' then 'Your seller account is approved. You can now manage products and your store.'
        when 'rejected' then coalesce(nullif(new.review_note, ''), 'Please review your application details and contact support if you need help.')
        when 'suspended' then coalesce(nullif(new.review_note, ''), 'Contact platform support if you need help with this decision.')
        else 'Your store application status is now ' || new.status::text || '.' end,
      '/vendor'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists vendor_store_status_notification on public.vendor_profiles;
create trigger vendor_store_status_notification
after update of status on public.vendor_profiles
for each row execute function public.notify_vendor_store_status();

create or replace function public.notify_vendor_product_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  if new.status is distinct from old.status and new.vendor_id is not null then
    select owner_id into v_owner_id
    from public.vendor_profiles
    where id = new.vendor_id;
    if v_owner_id is not null then
      insert into public.vendor_notifications(vendor_id, notification_type, title, message, action_url)
      values (
        new.vendor_id, 'product_status',
        case new.status when 'published' then 'Your product is approved'
          when 'archived' then 'Your product was declined or archived'
          else 'Your product was returned for review' end,
        '"' || new.title || '" is now ' || new.status::text || '.',
        '/vendor/products'
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vendor_product_status_notification on public.products;
create trigger vendor_product_status_notification
after update of status on public.products
for each row execute function public.notify_vendor_product_status();

create or replace function public.notify_vendors_of_paid_order()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v record;
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    for v in
      select distinct vp.id as vendor_id, vp.owner_id
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      join public.vendor_profiles vp on vp.id = p.vendor_id
      where oi.order_id = new.id and vp.status = 'approved'
    loop
      insert into public.vendor_notifications(vendor_id, notification_type, title, message, action_url)
      values (
        v.vendor_id, 'new_order', 'You have a new paid order',
        'A customer order includes one or more of your products. Open your sales dashboard for details.',
        '/vendor/sales'
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists vendor_paid_order_notification on public.orders;
create trigger vendor_paid_order_notification
after update of payment_status on public.orders
for each row execute function public.notify_vendors_of_paid_order();
