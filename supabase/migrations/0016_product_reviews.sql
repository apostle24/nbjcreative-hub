-- NBJCreative Hub: verified customer product reviews
-- Customers may review a product only after a paid purchase.
-- Reviews are held for moderation before becoming public.

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  title text not null check (char_length(trim(title)) between 3 and 120),
  body text not null check (char_length(trim(body)) between 10 and 3000),
  status text not null default 'pending'
    check (status in ('pending', 'published', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

create index product_reviews_public_idx
  on public.product_reviews(product_id, status, created_at desc);

create trigger product_reviews_updated_at
before update on public.product_reviews
for each row execute function public.set_updated_at();

alter table public.product_reviews enable row level security;

create policy "Product reviews: public reads published"
on public.product_reviews for select to anon, authenticated
using (status = 'published' or public.is_admin());

create policy "Product reviews: admin manages"
on public.product_reviews for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.product_reviews to anon, authenticated;
revoke insert, update, delete on public.product_reviews from anon, authenticated;

create or replace function public.submit_product_review(
  p_product_id uuid,
  p_rating integer,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_order_item_id uuid;
  v_review_id uuid;
begin
  if v_customer_id is null then
    raise exception 'Please sign in to submit a review.';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Choose a rating from 1 to 5.';
  end if;

  if p_title is null or char_length(trim(p_title)) < 3
     or char_length(trim(p_title)) > 120 then
    raise exception 'Review title must be between 3 and 120 characters.';
  end if;

  if p_body is null or char_length(trim(p_body)) < 10
     or char_length(trim(p_body)) > 3000 then
    raise exception 'Review must be between 10 and 3000 characters.';
  end if;

  select oi.id into v_order_item_id
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.product_id = p_product_id
    and o.customer_id = v_customer_id
    and o.payment_status = 'paid'
  order by o.paid_at desc nulls last, o.created_at desc
  limit 1;

  if v_order_item_id is null then
    raise exception 'A completed purchase is required before reviewing this product.';
  end if;

  insert into public.product_reviews (
    product_id, customer_id, order_item_id, rating, title, body, status
  )
  values (
    p_product_id, v_customer_id, v_order_item_id,
    p_rating, trim(p_title), trim(p_body), 'pending'
  )
  returning id into v_review_id;

  return v_review_id;
exception
  when unique_violation then
    raise exception 'You have already submitted a review for this product.';
end;
$$;

revoke all on function public.submit_product_review(uuid, integer, text, text) from public;
revoke all on function public.submit_product_review(uuid, integer, text, text) from anon;
grant execute on function public.submit_product_review(uuid, integer, text, text) to authenticated;
