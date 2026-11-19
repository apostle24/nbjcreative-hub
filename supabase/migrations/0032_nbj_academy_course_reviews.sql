-- NBJ Academy verified student course reviews and ratings.
create table if not exists public.academy_course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  enrollment_id uuid not null unique references public.academy_enrollments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text not null default '' check (char_length(review) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_course_reviews_course_idx
  on public.academy_course_reviews(course_id, created_at desc);

alter table public.academy_course_reviews enable row level security;

drop policy if exists "Public can read published course reviews" on public.academy_course_reviews;
create policy "Public can read published course reviews"
on public.academy_course_reviews for select
using (exists (
  select 1 from public.academy_courses c
  where c.id = course_id and c.status = 'published'
));

drop policy if exists "Students read own course reviews" on public.academy_course_reviews;
create policy "Students read own course reviews"
on public.academy_course_reviews for select to authenticated
using (student_id = auth.uid());

drop policy if exists "Instructors read reviews for own courses" on public.academy_course_reviews;
create policy "Instructors read reviews for own courses"
on public.academy_course_reviews for select to authenticated
using (exists (
  select 1 from public.academy_courses c
  where c.id = course_id and c.instructor_id = auth.uid()
));

drop policy if exists "Enrolled students create one course review" on public.academy_course_reviews;
create policy "Enrolled students create one course review"
on public.academy_course_reviews for insert to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1 from public.academy_enrollments e
    join public.academy_courses c on c.id = e.course_id
    where e.id = enrollment_id
      and e.course_id = academy_course_reviews.course_id
      and e.student_id = auth.uid()
      and e.status in ('active','completed')
      and c.status = 'published'
  )
);

drop policy if exists "Students update own course review" on public.academy_course_reviews;
create policy "Students update own course review"
on public.academy_course_reviews for update to authenticated
using (student_id = auth.uid())
with check (
  student_id = auth.uid()
  and exists (
    select 1 from public.academy_enrollments e
    where e.id = enrollment_id and e.course_id = academy_course_reviews.course_id
      and e.student_id = auth.uid() and e.status in ('active','completed')
  )
);

grant select on public.academy_course_reviews to anon, authenticated;
grant insert, update on public.academy_course_reviews to authenticated;

create or replace function public.get_academy_course_reviews(p_course_id uuid)
returns table (
  review_id uuid,
  student_name text,
  rating integer,
  review text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id,
    coalesce(nullif(trim(p.full_name), ''), 'Student')::text,
    r.rating,
    r.review,
    r.created_at
  from public.academy_course_reviews r
  join public.academy_courses c on c.id = r.course_id
  left join public.profiles p on p.id = r.student_id
  where r.course_id = p_course_id and c.status = 'published'
  order by r.created_at desc;
$$;

revoke all on function public.get_academy_course_reviews(uuid) from public;
grant execute on function public.get_academy_course_reviews(uuid) to anon, authenticated;
