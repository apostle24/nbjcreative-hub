-- Private course lesson materials and video uploads.
alter table public.academy_lessons
  add column if not exists attachment_path text,
  add column if not exists attachment_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academy-materials',
  'academy-materials',
  false,
  209715200,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'video/mp4',
    'video/webm'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Academy instructors upload lesson materials" on storage.objects;
create policy "Academy instructors upload lesson materials"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'academy-materials'
  and exists (
    select 1
    from public.academy_lessons l
    join public.academy_sections s on s.id = l.section_id
    join public.academy_courses c on c.id = s.course_id
    where l.id::text = split_part(name, '/', 2)
      and c.id::text = split_part(name, '/', 1)
      and c.instructor_id = auth.uid()
  )
);

drop policy if exists "Academy instructors update lesson materials" on storage.objects;
create policy "Academy instructors update lesson materials"
on storage.objects for update to authenticated
using (
  bucket_id = 'academy-materials'
  and exists (
    select 1 from public.academy_lessons l
    join public.academy_sections s on s.id = l.section_id
    join public.academy_courses c on c.id = s.course_id
    where l.id::text = split_part(name, '/', 2)
      and c.id::text = split_part(name, '/', 1)
      and c.instructor_id = auth.uid()
  )
)
with check (
  bucket_id = 'academy-materials'
  and exists (
    select 1 from public.academy_lessons l
    join public.academy_sections s on s.id = l.section_id
    join public.academy_courses c on c.id = s.course_id
    where l.id::text = split_part(name, '/', 2)
      and c.id::text = split_part(name, '/', 1)
      and c.instructor_id = auth.uid()
  )
);

drop policy if exists "Academy instructors and enrolled students read lesson materials" on storage.objects;
create policy "Academy instructors and enrolled students read lesson materials"
on storage.objects for select to authenticated
using (
  bucket_id = 'academy-materials'
  and exists (
    select 1
    from public.academy_lessons l
    join public.academy_sections s on s.id = l.section_id
    join public.academy_courses c on c.id = s.course_id
    where l.id::text = split_part(name, '/', 2)
      and c.id::text = split_part(name, '/', 1)
      and (
        c.instructor_id = auth.uid()
        or l.is_preview
        or exists (
          select 1 from public.academy_enrollments e
          where e.course_id = c.id and e.student_id = auth.uid() and e.status in ('active','completed')
        )
      )
  )
);

drop policy if exists "Academy instructors delete lesson materials" on storage.objects;
create policy "Academy instructors delete lesson materials"
on storage.objects for delete to authenticated
using (
  bucket_id = 'academy-materials'
  and exists (
    select 1 from public.academy_lessons l
    join public.academy_sections s on s.id = l.section_id
    join public.academy_courses c on c.id = s.course_id
    where l.id::text = split_part(name, '/', 2)
      and c.id::text = split_part(name, '/', 1)
      and c.instructor_id = auth.uid()
  )
);
