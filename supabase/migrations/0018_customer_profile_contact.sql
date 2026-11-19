-- Customer profile contact phone and sync verified auth email changes.
alter table public.profiles
  add column if not exists phone_number text;

create or replace function public.sync_profile_auth_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = new.email
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
when (new.email is distinct from old.email)
execute procedure public.sync_profile_auth_email();
