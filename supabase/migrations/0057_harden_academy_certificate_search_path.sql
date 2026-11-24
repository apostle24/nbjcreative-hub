-- Harden the SECURITY DEFINER certificate function against search_path shadowing.
-- All application objects referenced below are schema-qualified.
create or replace function public.issue_academy_course_certificate(p_enrollment_id uuid)
returns table(
  certificate_id uuid,
  certificate_number text,
  issued_at timestamptz,
  course_id uuid
)
language plpgsql
security definer
set search_path = ''
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
