-- Harden the Academy instructor analytics RPC with an empty search_path.
-- All application objects and auth.uid() are explicitly schema-qualified.

create or replace function public.get_academy_course_student_analytics(p_course_id uuid)
returns table(
  enrollment_id uuid,
  student_id uuid,
  student_name text,
  student_email text,
  enrollment_status text,
  enrolled_at timestamptz,
  completed_lessons integer,
  total_lessons integer,
  progress_percent integer,
  assessment_attempts integer,
  best_score integer,
  latest_score integer,
  passed_assessments integer,
  total_published_assessments integer
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
     or not exists (
       select 1
       from public.academy_courses c
       where c.id = p_course_id
         and c.instructor_id = auth.uid()
     ) then
    raise exception 'Course not found or access denied';
  end if;

  return query
  with course_lessons as (
    select count(l.id)::integer as total
    from public.academy_sections s
    left join public.academy_lessons l on l.section_id = s.id
    where s.course_id = p_course_id
  ),
  published_quizzes as (
    select count(*)::integer as total
    from public.academy_quizzes q
    where q.course_id = p_course_id and q.is_published
  ),
  student_attempts as (
    select q.course_id, a.student_id,
      count(*) filter (where a.submitted_at is not null)::integer as attempts,
      max(a.score) filter (where a.submitted_at is not null)::integer as best_score,
      (array_agg(a.score order by a.submitted_at desc)
        filter (where a.submitted_at is not null))[1]::integer as latest_score,
      count(distinct a.quiz_id) filter (
        where a.submitted_at is not null and a.passed
      )::integer as passed
    from public.academy_quiz_attempts a
    join public.academy_quizzes q on q.id = a.quiz_id
    where q.course_id = p_course_id
    group by q.course_id, a.student_id
  )
  select
    e.id,
    e.student_id,
    coalesce(nullif(trim(p.full_name), ''), 'Student')::text,
    coalesce(p.email, '')::text,
    e.status,
    e.enrolled_at,
    coalesce(progress.done, 0)::integer,
    cl.total,
    case when cl.total = 0 then 0
      else round((coalesce(progress.done,0)::numeric / cl.total) * 100)::integer
    end,
    coalesce(sa.attempts, 0)::integer,
    sa.best_score,
    sa.latest_score,
    coalesce(sa.passed, 0)::integer,
    pq.total
  from public.academy_enrollments e
  join public.profiles p on p.id = e.student_id
  cross join course_lessons cl
  cross join published_quizzes pq
  left join lateral (
    select count(*)::integer as done
    from public.academy_lesson_progress lp
    join public.academy_lessons l on l.id = lp.lesson_id
    join public.academy_sections s on s.id = l.section_id
    where lp.enrollment_id = e.id and s.course_id = p_course_id
  ) progress on true
  left join student_attempts sa
    on sa.student_id = e.student_id and sa.course_id = e.course_id
  where e.course_id = p_course_id
  order by e.enrolled_at desc;
end;
$function$;

revoke all on function public.get_academy_course_student_analytics(uuid)
  from public, anon;
grant execute on function public.get_academy_course_student_analytics(uuid)
  to authenticated;
