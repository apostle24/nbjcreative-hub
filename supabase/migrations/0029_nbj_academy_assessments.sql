-- NBJ Academy assessments: quizzes, questions, attempts and protected answer keys.
create table if not exists public.academy_quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  title text not null,
  instructions text not null default '',
  pass_mark integer not null default 70 check (pass_mark between 0 and 100),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.academy_quizzes(id) on delete cascade,
  prompt text not null,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.academy_quiz_answer_keys (
  question_id uuid primary key references public.academy_quiz_questions(id) on delete cascade,
  correct_option integer not null check (correct_option >= 0)
);

create table if not exists public.academy_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.academy_quizzes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  score integer,
  total_questions integer,
  passed boolean,
  submitted_at timestamptz,
  started_at timestamptz not null default now()
);

create index if not exists academy_quizzes_course_idx on public.academy_quizzes(course_id);
create index if not exists academy_quiz_questions_quiz_idx on public.academy_quiz_questions(quiz_id, sort_order);
create index if not exists academy_quiz_attempts_student_idx on public.academy_quiz_attempts(student_id, started_at desc);

create table if not exists public.academy_quiz_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.academy_quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.academy_quiz_questions(id) on delete cascade,
  selected_option integer not null check (selected_option >= 0),
  is_correct boolean,
  unique(attempt_id, question_id)
);

alter table public.academy_quizzes enable row level security;
alter table public.academy_quiz_questions enable row level security;
alter table public.academy_quiz_answer_keys enable row level security;
alter table public.academy_quiz_attempts enable row level security;
alter table public.academy_quiz_responses enable row level security;

drop policy if exists "Published quizzes visible to enrolled students" on public.academy_quizzes;
create policy "Published quizzes visible to enrolled students" on public.academy_quizzes for select
using (is_published and exists (select 1 from public.academy_enrollments e where e.course_id = academy_quizzes.course_id and e.student_id = auth.uid() and e.status = 'active')
or exists (select 1 from public.academy_courses c where c.id = course_id and c.instructor_id = auth.uid()));

drop policy if exists "Instructors manage own quizzes" on public.academy_quizzes;
create policy "Instructors manage own quizzes" on public.academy_quizzes for all
using (exists (select 1 from public.academy_courses c where c.id = course_id and c.instructor_id = auth.uid()))
with check (exists (select 1 from public.academy_courses c where c.id = course_id and c.instructor_id = auth.uid()));

drop policy if exists "Quiz questions visible to enrolled students and instructors" on public.academy_quiz_questions;
create policy "Quiz questions visible to enrolled students and instructors" on public.academy_quiz_questions for select
using (exists (
  select 1 from public.academy_quizzes q
  join public.academy_enrollments e on e.course_id = q.course_id
  where q.id = quiz_id and q.is_published and e.student_id = auth.uid() and e.status = 'active'
) or exists (
  select 1 from public.academy_quizzes q join public.academy_courses c on c.id = q.course_id
  where q.id = quiz_id and c.instructor_id = auth.uid()
));

drop policy if exists "Instructors manage quiz questions" on public.academy_quiz_questions;
create policy "Instructors manage quiz questions" on public.academy_quiz_questions for all
using (exists (select 1 from public.academy_quizzes q join public.academy_courses c on c.id=q.course_id where q.id=quiz_id and c.instructor_id=auth.uid()))
with check (exists (select 1 from public.academy_quizzes q join public.academy_courses c on c.id=q.course_id where q.id=quiz_id and c.instructor_id=auth.uid()));

drop policy if exists "Only instructors can manage answer keys" on public.academy_quiz_answer_keys;
create policy "Only instructors can manage answer keys" on public.academy_quiz_answer_keys for all
using (exists (select 1 from public.academy_quiz_questions x join public.academy_quizzes q on q.id=x.quiz_id join public.academy_courses c on c.id=q.course_id where x.id=question_id and c.instructor_id=auth.uid()))
with check (exists (select 1 from public.academy_quiz_questions x join public.academy_quizzes q on q.id=x.quiz_id join public.academy_courses c on c.id=q.course_id where x.id=question_id and c.instructor_id=auth.uid()));

drop policy if exists "Students create and view own quiz attempts" on public.academy_quiz_attempts;
create policy "Students create and view own quiz attempts" on public.academy_quiz_attempts for select
using (student_id=auth.uid() or exists (select 1 from public.academy_quizzes q join public.academy_courses c on c.id=q.course_id where q.id=quiz_id and c.instructor_id=auth.uid()));
create policy "Students start attempts for enrolled quizzes" on public.academy_quiz_attempts for insert
with check (student_id=auth.uid() and exists (select 1 from public.academy_quizzes q join public.academy_enrollments e on e.course_id=q.course_id where q.id=quiz_id and q.is_published and e.student_id=auth.uid() and e.status='active'));

drop policy if exists "Students manage own unsubmitted quiz responses" on public.academy_quiz_responses;
create policy "Students manage own unsubmitted quiz responses" on public.academy_quiz_responses for select
using (exists (select 1 from public.academy_quiz_attempts a where a.id=attempt_id and a.student_id=auth.uid()));
create policy "Students answer own unsubmitted quizzes" on public.academy_quiz_responses for insert
with check (
  exists (select 1 from public.academy_quiz_attempts a where a.id=attempt_id and a.student_id=auth.uid() and a.submitted_at is null)
  and exists (select 1 from public.academy_quiz_questions q where q.id=question_id)
);
create policy "Students update own unsubmitted answers" on public.academy_quiz_responses for update
using (exists (select 1 from public.academy_quiz_attempts a where a.id=attempt_id and a.student_id=auth.uid() and a.submitted_at is null))
with check (exists (select 1 from public.academy_quiz_attempts a where a.id=attempt_id and a.student_id=auth.uid() and a.submitted_at is null));

grant select, insert, update, delete on public.academy_quizzes, public.academy_quiz_questions to authenticated;
grant select, insert on public.academy_quiz_attempts to authenticated;
grant select, insert, update on public.academy_quiz_responses to authenticated;
grant select, insert, update, delete on public.academy_quiz_answer_keys to authenticated;

create or replace function public.submit_academy_quiz_attempt(p_attempt_id uuid)
returns table(attempt_id uuid, score integer, total_questions integer, passed boolean, submitted_at timestamptz)
language plpgsql
security definer
set search_path = public
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
  join public.academy_quizzes q on q.id=a.quiz_id
  where a.id=p_attempt_id
  for update of a;

  if v_quiz_id is null or v_student_id <> auth.uid() then
    raise exception 'Attempt not found or access denied';
  end if;
  if v_submitted is not null then
    raise exception 'This attempt has already been submitted';
  end if;

  select count(*) into v_total from public.academy_quiz_questions where quiz_id=v_quiz_id;
  if v_total = 0 then raise exception 'This quiz has no questions'; end if;

  select count(*) filter (where r.selected_option=k.correct_option)
    into v_score
  from public.academy_quiz_questions x
  join public.academy_quiz_answer_keys k on k.question_id=x.id
  left join public.academy_quiz_responses r on r.question_id=x.id and r.attempt_id=p_attempt_id
  where x.quiz_id=v_quiz_id;

  v_submitted := now();
  update public.academy_quiz_responses r
    set is_correct=(r.selected_option=k.correct_option)
  from public.academy_quiz_answer_keys k
  where r.attempt_id=p_attempt_id and r.question_id=k.question_id;
  update public.academy_quiz_attempts a
    set score=round((v_score::numeric / v_total)*100)::integer,
        total_questions=v_total,
        passed=(round((v_score::numeric / v_total)*100)::integer >= v_pass_mark),
        submitted_at=v_submitted
    where a.id=p_attempt_id;

  return query select p_attempt_id, round((v_score::numeric / v_total)*100)::integer, v_total,
    (round((v_score::numeric / v_total)*100)::integer >= v_pass_mark), v_submitted;
end;
$$;

grant execute on function public.submit_academy_quiz_attempt(uuid) to authenticated;
