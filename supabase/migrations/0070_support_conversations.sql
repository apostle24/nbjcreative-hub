-- Two-way customer support conversations. Existing support tickets remain unchanged.
create table public.support_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_messages(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  sender_role text not null check (sender_role in ('customer','admin')),
  message text not null check (char_length(trim(message)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index support_replies_ticket_created_idx
  on public.support_replies(ticket_id, created_at);

alter table public.support_replies enable row level security;

create policy "Support replies: ticket owner or admin reads"
on public.support_replies for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.support_messages t
    where t.id = ticket_id and t.customer_id = (select auth.uid())
  )
);

create policy "Support replies: ticket owner or admin sends"
on public.support_replies for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and (
    (sender_role = 'admin' and public.is_admin())
    or (
      sender_role = 'customer'
      and exists (
        select 1 from public.support_messages t
        where t.id = ticket_id
          and t.customer_id = (select auth.uid())
          and t.status <> 'closed'
      )
    )
  )
);

-- Keep ticket activity timestamps current without allowing clients to edit ticket records.
create or replace function public.touch_support_ticket_from_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.support_messages
  set updated_at = now()
  where id = new.ticket_id;
  return new;
end;
$$;

revoke all on function public.touch_support_ticket_from_reply() from public, anon, authenticated;
create trigger support_replies_touch_ticket
after insert on public.support_replies
for each row execute function public.touch_support_ticket_from_reply();
