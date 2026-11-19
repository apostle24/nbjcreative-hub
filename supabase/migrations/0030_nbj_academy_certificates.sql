-- NBJ Academy course completion certificates.
create table if not exists public.academy_certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.academy_enrollments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  certificate_number text not null unique default ('NBJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  issued_at timestamptz not null default now()
);

create index if not exists academy_certificates_student_idx
  on public.academy_certificates(student_id, issued_at desc);

alter table public.academy_certificates enable row level security;

drop policy if exists "Students and course instructors can view certificates" on public.academy_certificates;
create policy "Students and course instructors can view certificates"
on public.academy_certificates for select
using (
  student_id = auth.uid()
  or exists (
    select 1 from public.academy_courses c
    where c.id = academy_certificates.course_id and c.instructor_id = auth.uid()
  )
);

grant select on public.academy_certificates to authenticated;

create or replace function public.issue_academy_course_certificate(p_enrollment_id uuid)
returns table(
  certificate_id uuid,
  certificate_number text,
  issued_at timestamptz,
  course_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_course_id uuid;
  v_total_lessons integer;
  v_completed_lessons integer;
  v_unpassed_quizzes integer;
  v_certificate public.academy_certificates%rowtype;
begin
  select e.student_id, e.course_id
    into v_student_id, v_course_id
  from public.academy_enrollments e
  where e.id = p_enrollment_id and e.status = 'active';

  if v_student_id is null or v_student_id <> auth.uid() then
    raise exception 'Active enrolment not found or access denied';
  end if;

  select count(*) into v_total_lessons
  from public.academy_lessons l
  join public.academy_sections s on s.id = l.section_id
  where s.course_id = v_course_id;

  if v_total_lessons = 0 then
    raise exception 'This course has no lessons to complete';
  end if;

  select count(*) into v_completed_lessons
  from public.academy_lesson_progress p
  join public.academy_lessons l on l.id = p.lesson_id
  join public.academy_sections s on s.id = l.section_id
  where p.enrollment_id = p_enrollment_id and s.course_id = v_course_id;

  if v_completed_lessons < v_total_lessons then
    raise exception 'Complete all course lessons before requesting a certificate';
  end if;

  select count(*) into v_unpassed_quizzes
  from public.academy_quizzes q
  where q.course_id = v_course_id and q.is_published
    and not exists (
      select 1 from public.academy_quiz_attempts a
      where a.quiz_id = q.id and a.student_id = v_student_id
        and a.submitted_at is not null and a.passed = true
    );

  if v_unpassed_quizzes > 0 then
    raise exception 'Pass all published course assessments before requesting a certificate';
  end if;

  insert into public.academy_certificates(enrollment_id, student_id, course_id)
  values (p_enrollment_id, v_student_id, v_course_id)
  on conflict (enrollment_id) do nothing;

  select * into v_certificate
  from public.academy_certificates c
  where c.enrollment_id = p_enrollment_id;

  return query select v_certificate.id, v_certificate.certificate_number,
    v_certificate.issued_at, v_certificate.course_id;
end;
$$;

grant execute on function public.issue_academy_course_certificate(uuid) to authenticated;
