-- Harden Academy RPCs against anonymous execution and NULL auth.uid() checks.
-- In PostgreSQL, comparing a non-NULL user id with NULL yields NULL; an IF
-- condition that evaluates to NULL does not enter its THEN branch.

create or replace function public.submit_academy_quiz_attempt(p_attempt_id uuid)
returns table(
  attempt_id uuid,
  score integer,
  total_questions integer,
  passed boolean,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz_id uuid;
  v_student_id uuid;
  v_pass_mark integer;
  v_total integer;
  v_score integer;
  v_submitted timestamptz;
begin
  select a.quiz_id, a.student_id, q.pass_mark, a.submitted_at
    into v_quiz_id, v_student_id, v_pass_mark, v_submitted
  from public.academy_quiz_attempts a
  join public.academy_quizzes q on q.id = a.quiz_id
  where a.id = p_attempt_id
  for update of a;

  if v_quiz_id is null
     or auth.uid() is null
     or v_student_id is distinct from auth.uid() then
    raise exception 'Attempt not found or access denied';
  end if;

  if v_submitted is not null then
    raise exception 'This attempt has already been submitted';
  end if;

  select count(*) into v_total
  from public.academy_quiz_questions
  where quiz_id = v_quiz_id;

  if v_total = 0 then
    raise exception 'This quiz has no questions';
  end if;

  select count(*) filter (where r.selected_option = k.correct_option)
    into v_score
  from public.academy_quiz_questions x
  join public.academy_quiz_answer_keys k on k.question_id = x.id
  left join public.academy_quiz_responses r
    on r.question_id = x.id and r.attempt_id = p_attempt_id
  where x.quiz_id = v_quiz_id;

  v_submitted := now();

  update public.academy_quiz_responses r
    set is_correct = (r.selected_option = k.correct_option)
  from public.academy_quiz_answer_keys k
  where r.attempt_id = p_attempt_id
    and r.question_id = k.question_id;

  update public.academy_quiz_attempts a
    set score = round((v_score::numeric / v_total) * 100)::integer,
        total_questions = v_total,
        passed = (
          round((v_score::numeric / v_total) * 100)::integer >= v_pass_mark
        ),
        submitted_at = v_submitted
  where a.id = p_attempt_id;

  return query
  select
    p_attempt_id,
    round((v_score::numeric / v_total) * 100)::integer,
    v_total,
    (round((v_score::numeric / v_total) * 100)::integer >= v_pass_mark),
    v_submitted;
end;
$$;

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
  where e.id = p_enrollment_id
    and e.status = 'active';

  if v_student_id is null
     or auth.uid() is null
     or v_student_id is distinct from auth.uid() then
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
  where p.enrollment_id = p_enrollment_id
    and s.course_id = v_course_id;

  if v_completed_lessons < v_total_lessons then
    raise exception 'Complete all course lessons before requesting a certificate';
  end if;

  select count(*) into v_unpassed_quizzes
  from public.academy_quizzes q
  where q.course_id = v_course_id
    and q.is_published
    and not exists (
      select 1
      from public.academy_quiz_attempts a
      where a.quiz_id = q.id
        and a.student_id = v_student_id
        and a.submitted_at is not null
        and a.passed = true
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

  return query
  select
    v_certificate.id,
    v_certificate.certificate_number,
    v_certificate.issued_at,
    v_certificate.course_id;
end;
$$;

-- These RPCs are for authenticated students/instructors only. Explicitly
-- revoke both PUBLIC and anon, as Supabase default grants can expose new
-- functions to anon independently of the PUBLIC grant.
revoke all on function public.submit_academy_quiz_attempt(uuid)
  from public, anon;
grant execute on function public.submit_academy_quiz_attempt(uuid)
  to authenticated;

revoke all on function public.issue_academy_course_certificate(uuid)
  from public, anon;
grant execute on function public.issue_academy_course_certificate(uuid)
  to authenticated;

revoke all on function public.get_academy_course_student_analytics(uuid)
  from public, anon;
grant execute on function public.get_academy_course_student_analytics(uuid)
  to authenticated;

revoke all on function public.update_business_enquiry_status(uuid, text)
  from public, anon;
grant execute on function public.update_business_enquiry_status(uuid, text)
  to authenticated;
