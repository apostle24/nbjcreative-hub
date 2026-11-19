-- NBJ Academy foundation: courses, curriculum, enrolments and learning progress.
create table if not exists public.academy_courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references auth.users(id) on delete restrict,
  title text not null,
  slug text not null unique,
  short_description text not null default '',
  description text not null default '',
  category text not null default 'General',
  level text not null default 'beginner' check (level in ('beginner','intermediate','advanced','all_levels')),
  language text not null default 'English',
  thumbnail_url text,
  price numeric(12,2) not null default 0 check (price >= 0),
  currency text not null default 'GHS',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_courses_status_published_idx
  on public.academy_courses(status, published_at desc);

create table if not exists public.academy_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(course_id, sort_order)
);

create table if not exists public.academy_lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.academy_sections(id) on delete cascade,
  title text not null,
  description text not null default '',
  content text not null default '',
  video_url text,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  is_preview boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(section_id, sort_order)
);

create table if not exists public.academy_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(course_id, student_id)
);

create index if not exists academy_enrollments_student_idx
  on public.academy_enrollments(student_id, enrolled_at desc);

create table if not exists public.academy_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.academy_enrollments(id) on delete cascade,
  lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique(enrollment_id, lesson_id)
);

alter table public.academy_courses enable row level security;
alter table public.academy_sections enable row level security;
alter table public.academy_lessons enable row level security;
alter table public.academy_enrollments enable row level security;
alter table public.academy_lesson_progress enable row level security;

drop policy if exists "Published academy courses are public" on public.academy_courses;
create policy "Published academy courses are public"
  on public.academy_courses for select
  using (status = 'published' or instructor_id = auth.uid());

drop policy if exists "Instructors manage own academy courses" on public.academy_courses;
create policy "Instructors manage own academy courses"
  on public.academy_courses for all
  using (instructor_id = auth.uid())
  with check (instructor_id = auth.uid());

drop policy if exists "Course curriculum is visible to enrolled students" on public.academy_sections;
create policy "Course curriculum is visible to enrolled students"
  on public.academy_sections for select
  using (
    exists (
      select 1 from public.academy_courses c
      where c.id = course_id
        and (c.status = 'published' or c.instructor_id = auth.uid())
    )
  );

drop policy if exists "Instructors manage own course sections" on public.academy_sections;
create policy "Instructors manage own course sections"
  on public.academy_sections for all
  using (exists (select 1 from public.academy_courses c where c.id = course_id and c.instructor_id = auth.uid()))
  with check (exists (select 1 from public.academy_courses c where c.id = course_id and c.instructor_id = auth.uid()));

drop policy if exists "Preview lessons or enrolled lesson titles are visible" on public.academy_lessons;
create policy "Preview lessons or enrolled lesson titles are visible"
  on public.academy_lessons for select
  using (
    exists (
      select 1
      from public.academy_sections s
      join public.academy_courses c on c.id = s.course_id
      where s.id = section_id and c.status = 'published' and is_preview
    )
    or exists (
      select 1
      from public.academy_sections s
      join public.academy_courses c on c.id = s.course_id
      where s.id = section_id and c.instructor_id = auth.uid()
    )
    or exists (
      select 1
      from public.academy_sections s
      join public.academy_enrollments e on e.course_id = s.course_id
      where s.id = section_id and e.student_id = auth.uid() and e.status = 'active'
    )
  );

drop policy if exists "Instructors manage own lessons" on public.academy_lessons;
create policy "Instructors manage own lessons"
  on public.academy_lessons for all
  using (
    exists (
      select 1 from public.academy_sections s
      join public.academy_courses c on c.id = s.course_id
      where s.id = section_id and c.instructor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.academy_sections s
      join public.academy_courses c on c.id = s.course_id
      where s.id = section_id and c.instructor_id = auth.uid()
    )
  );

drop policy if exists "Students view own enrollments" on public.academy_enrollments;
create policy "Students view own enrollments"
  on public.academy_enrollments for select
  using (student_id = auth.uid());

drop policy if exists "Students enrol themselves in free published courses" on public.academy_enrollments;
create policy "Students enrol themselves in free published courses"
  on public.academy_enrollments for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.academy_courses c
      where c.id = course_id and c.status = 'published' and c.price = 0
    )
  );

drop policy if exists "Instructors view course enrolments" on public.academy_enrollments;
create policy "Instructors view course enrolments"
  on public.academy_enrollments for select
  using (exists (select 1 from public.academy_courses c where c.id = course_id and c.instructor_id = auth.uid()));

drop policy if exists "Students manage own lesson progress" on public.academy_lesson_progress;
create policy "Students manage own lesson progress"
  on public.academy_lesson_progress for all
  using (
    exists (
      select 1 from public.academy_enrollments e
      where e.id = enrollment_id and e.student_id = auth.uid() and e.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.academy_enrollments e
      where e.id = enrollment_id and e.student_id = auth.uid() and e.status = 'active'
    )
    and exists (
      select 1 from public.academy_enrollments e
      join public.academy_sections s on s.course_id = e.course_id
      join public.academy_lessons l on l.section_id = s.id
      where e.id = enrollment_id and l.id = lesson_id
    )
  );

grant select on public.academy_courses, public.academy_sections, public.academy_lessons to anon, authenticated;
grant insert, update, delete on public.academy_courses, public.academy_sections, public.academy_lessons to authenticated;
grant select, insert on public.academy_enrollments to authenticated;
grant select, insert, update, delete on public.academy_lesson_progress to authenticated;
