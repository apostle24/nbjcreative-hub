-- NBJ Academy paid course checkout and verified payment enrolment.
create table if not exists public.academy_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  student_id uuid not null references auth.users(id) on delete restrict,
  course_id uuid not null references public.academy_courses(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  paystack_transaction_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists academy_payment_transactions_student_idx
  on public.academy_payment_transactions(student_id, created_at desc);
create index if not exists academy_payment_transactions_course_idx
  on public.academy_payment_transactions(course_id, created_at desc);

alter table public.academy_payment_transactions enable row level security;

drop policy if exists "Students view own academy payments" on public.academy_payment_transactions;
create policy "Students view own academy payments"
  on public.academy_payment_transactions for select to authenticated
  using (student_id = auth.uid());

drop policy if exists "Instructors view payments for own courses" on public.academy_payment_transactions;
create policy "Instructors view payments for own courses"
  on public.academy_payment_transactions for select to authenticated
  using (exists (
    select 1 from public.academy_courses c
    where c.id = course_id and c.instructor_id = auth.uid()
  ));

grant select on public.academy_payment_transactions to authenticated;

create or replace function public.fulfill_academy_course_payment(
  p_reference text,
  p_transaction_id text,
  p_amount_subunits bigint,
  p_currency text
)
returns table(enrollment_id uuid, course_id uuid, course_slug text, already_paid boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.academy_payment_transactions%rowtype;
  v_enrollment_id uuid;
  v_slug text;
  v_already_paid boolean;
begin
  if coalesce(trim(p_reference), '') = ''
     or coalesce(trim(p_transaction_id), '') = ''
     or p_amount_subunits is null or p_amount_subunits < 1
     or char_length(coalesce(trim(p_currency), '')) <> 3 then
    raise exception 'Invalid verified Academy payment details.';
  end if;

  select * into v_payment
  from public.academy_payment_transactions
  where reference = trim(p_reference)
  for update;

  if not found then
    raise exception 'Academy payment reference was not found.';
  end if;

  if round(v_payment.amount * 100)::bigint <> p_amount_subunits
     or upper(v_payment.currency) <> upper(trim(p_currency)) then
    raise exception 'Payment amount or currency does not match the course.';
  end if;

  if v_payment.status = 'failed' then
    raise exception 'This Academy payment has been marked failed.';
  end if;

  select c.slug into v_slug
  from public.academy_courses c
  where c.id = v_payment.course_id and c.status = 'published';

  if v_slug is null then
    raise exception 'This course is no longer available for enrolment.';
  end if;

  v_already_paid := v_payment.status = 'paid';

  update public.academy_payment_transactions
  set status = 'paid',
      paystack_transaction_id = trim(p_transaction_id),
      paid_at = coalesce(paid_at, now())
  where id = v_payment.id;

  insert into public.academy_enrollments(course_id, student_id, status)
  values (v_payment.course_id, v_payment.student_id, 'active')
  on conflict (course_id, student_id) do update
    set status = 'active'
  returning id into v_enrollment_id;

  return query select v_enrollment_id, v_payment.course_id, v_slug, v_already_paid;
end;
$$;

revoke all on function public.fulfill_academy_course_payment(text, text, bigint, text) from public;
revoke all on function public.fulfill_academy_course_payment(text, text, bigint, text) from anon, authenticated;
grant execute on function public.fulfill_academy_course_payment(text, text, bigint, text) to service_role;
