-- NBJ Academy student and instructor notifications.
create table if not exists public.academy_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'enrollment','course_completed','quiz_result','certificate','course_review','payment'
  )),
  title text not null,
  message text not null,
  action_url text,
  event_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_id, event_key)
);

create index if not exists academy_notifications_recipient_created_idx
  on public.academy_notifications(recipient_id, created_at desc);
create index if not exists academy_notifications_unread_idx
  on public.academy_notifications(recipient_id, read_at) where read_at is null;

alter table public.academy_notifications enable row level security;

drop policy if exists "Users read own Academy notifications" on public.academy_notifications;
create policy "Users read own Academy notifications"
on public.academy_notifications for select to authenticated
using (recipient_id = auth.uid());

drop policy if exists "Users mark own Academy notifications read" on public.academy_notifications;
create policy "Users mark own Academy notifications read"
on public.academy_notifications for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

grant select on public.academy_notifications to authenticated;
grant update (read_at) on public.academy_notifications to authenticated;
revoke insert, delete on public.academy_notifications from anon, authenticated;

create or replace function public.notify_academy_enrollment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_title text; v_instructor uuid; v_slug text;
begin
  select c.title, c.instructor_id, c.slug into v_title, v_instructor, v_slug
  from public.academy_courses c where c.id = new.course_id;
  insert into public.academy_notifications(recipient_id, notification_type, title, message, action_url, event_key)
  values (new.student_id, 'enrollment', 'You are enrolled',
    'Your enrolment in ' || coalesce(v_title, 'the course') || ' is now active.',
    '/account/learning', 'enrollment-student:' || new.id::text)
  on conflict (recipient_id, event_key) do nothing;
  if v_instructor is not null and v_instructor <> new.student_id then
    insert into public.academy_notifications(recipient_id, notification_type, title, message, action_url, event_key)
    values (v_instructor, 'enrollment', 'New student enrolment',
      'A student has enrolled in ' || coalesce(v_title, 'your course') || '.',
      '/academy/instructor/courses/' || new.course_id::text || '/students',
      'enrollment-instructor:' || new.id::text)
    on conflict (recipient_id, event_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists academy_enrollment_notification on public.academy_enrollments;
create trigger academy_enrollment_notification
after insert on public.academy_enrollments
for each row execute function public.notify_academy_enrollment();

create or replace function public.notify_academy_course_completion()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_course_id uuid; v_student_id uuid; v_title text; v_instructor uuid;
begin
  select e.course_id, e.student_id, c.title, c.instructor_id
    into v_course_id, v_student_id, v_title, v_instructor
  from public.academy_enrollments e
  join public.academy_courses c on c.id = e.course_id
  where e.id = new.enrollment_id;
  if v_course_id is null then return new; end if;
  if (select count(*) from public.academy_lessons l
      join public.academy_sections s on s.id = l.section_id where s.course_id = v_course_id) = 0 then
    return new;
  end if;
  if (select count(*) from public.academy_lesson_progress p
      join public.academy_lessons l on l.id = p.lesson_id
      join public.academy_sections s on s.id = l.section_id
      where p.enrollment_id = new.enrollment_id) >=
     (select count(*) from public.academy_lessons l
      join public.academy_sections s on s.id = l.section_id where s.course_id = v_course_id) then
    insert into public.academy_notifications(recipient_id, notification_type, title, message, action_url, event_key)
    values (v_student_id, 'course_completed', 'Course lessons completed',
      'You have completed all lessons in ' || coalesce(v_title, 'your course') || '. Check your learning area for certificate eligibility.',
      '/account/learning', 'completion-student:' || new.enrollment_id::text)
    on conflict (recipient_id, event_key) do nothing;
    if v_instructor is not null and v_instructor <> v_student_id then
      insert into public.academy_notifications(recipient_id, notification_type, title, message, action_url, event_key)
      values (v_instructor, 'course_completed', 'A student completed your course',
        'A student has completed all lessons in ' || coalesce(v_title, 'your course') || '.',
        '/academy/instructor/courses/' || v_course_id::text || '/students',
        'completion-instructor:' || new.enrollment_id::text)
      on conflict (recipient_id, event_key) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists academy_course_completion_notification on public.academy_lesson_progress;
create trigger academy_course_completion_notification
after insert on public.academy_lesson_progress
for each row execute function public.notify_academy_course_completion();

create or replace function public.notify_academy_quiz_result()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_course_id uuid; v_course_title text; v_quiz_title text; v_instructor uuid;
begin
  if new.submitted_at is null or old.submitted_at is not null then return new; end if;
  select c.id, c.title, c.instructor_id, q.title
    into v_course_id, v_course_title, v_instructor, v_quiz_title
  from public.academy_quizzes q
  join public.academy_courses c on c.id = q.course_id
  where q.id = new.quiz_id;
  if v_course_id is null then return new; end if;
  insert into public.academy_notifications(recipient_id, notification_type, title, message, action_url, event_key)
  values (new.student_id, 'quiz_result', 'Assessment result available',
    'Your result for ' || coalesce(v_quiz_title, 'the assessment') || ' in ' || coalesce(v_course_title, 'your course') ||
    ' is ' || coalesce(new.score::text, 'pending') || '% (' || case when coalesce(new.passed,false) then 'passed' else 'not passed' end || ').',
    '/account/learning/assessments', 'quiz-student:' || new.id::text)
  on conflict (recipient_id, event_key) do nothing;
  if v_instructor is not null and v_instructor <> new.student_id then
    insert into public.academy_notifications(recipient_id, notification_type, title, message, action_url, event_key)
    values (v_instructor, 'quiz_result', 'Student submitted an assessment',
      'A student submitted ' || coalesce(v_quiz_title, 'an assessment') || ' in ' || coalesce(v_course_title, 'your course') || '.',
      '/academy/instructor/courses/' || v_course_id::text || '/students',
      'quiz-instructor:' || new.id::text)
    on conflict (recipient_id, event_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists academy_quiz_result_notification on public.academy_quiz_attempts;
create trigger academy_quiz_result_notification
after update of submitted_at on public.academy_quiz_attempts
for each row execute function public.notify_academy_quiz_result();

create or replace function public.notify_academy_certificate()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_title text; v_instructor uuid;
begin
  select title, instructor_id into v_title, v_instructor
  from public.academy_courses where id = new.course_id;
  insert into public.academy_notifications(recipient_id, notification_type, title, message, action_url, event_key)
  values (new.student_id, 'certificate', 'Your certificate is ready',
    'Your certificate for ' || coalesce(v_title, 'the course') || ' has been issued.',
    '/academy/certificate/' || new.id::text, 'certificate-student:' || new.id::text)
  on conflict (recipient_id, event_key) do nothing;
  if v_instructor is not null and v_instructor <> new.student_id then
    insert into public.academy_notifications(recipient_id, notification_type, title, message, action_url, event_key)
    values (v_instructor, 'certificate', 'A course certificate was issued',
      'A student has earned a certificate for ' || coalesce(v_title, 'your course') || '.',
      '/academy/instructor/courses/' || new.course_id::text || '/students',
      'certificate-instructor:' || new.id::text)
    on conflict (recipient_id, event_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists academy_certificate_notification on public.academy_certificates;
create trigger academy_certificate_notification
after insert on public.academy_certificates
for each row execute function public.notify_academy_certificate();

create or replace function public.notify_academy_course_review()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_title text; v_instructor uuid;
begin
  select title, instructor_id into v_title, v_instructor
  from public.academy_courses where id = new.course_id;
  if v_instructor is not null and v_instructor <> new.student_id then
    insert into public.academy_notifications(recipient_id, notification_type, title, message, action_url, event_key)
    values (v_instructor, 'course_review', 'New course review',
      'A student left a ' || new.rating::text || '-star review for ' || coalesce(v_title, 'your course') || '.',
      '/academy/instructor/courses/' || new.course_id::text,
      'review-instructor:' || new.id::text)
    on conflict (recipient_id, event_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists academy_course_review_notification on public.academy_course_reviews;
create trigger academy_course_review_notification
after insert on public.academy_course_reviews
for each row execute function public.notify_academy_course_review();

create or replace function public.notify_academy_payment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_title text; v_slug text;
begin
  if new.status <> 'paid' or old.status = 'paid' then return new; end if;
  select title, slug into v_title, v_slug from public.academy_courses where id = new.course_id;
  insert into public.academy_notifications(recipient_id, notification_type, title, message, action_url, event_key)
  values (new.student_id, 'payment', 'Course payment confirmed',
    'Your payment for ' || coalesce(v_title, 'the course') || ' has been confirmed and your enrolment is active.',
    '/academy/course/' || coalesce(v_slug, ''),
    'payment-student:' || new.id::text)
  on conflict (recipient_id, event_key) do nothing;
  return new;
end;
$$;

drop trigger if exists academy_payment_notification on public.academy_payment_transactions;
create trigger academy_payment_notification
after update of status on public.academy_payment_transactions
for each row execute function public.notify_academy_payment();
