-- NBJ Business workspace foundation
create table if not exists public.business_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(trim(business_name)) between 2 and 120),
  business_slug text not null unique check (business_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  industry text,
  country text,
  city text,
  website_url text,
  contact_email text,
  contact_phone text,
  default_currency char(3) not null default 'GHS',
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id)
);

create table if not exists public.business_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.business_workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','manager','member')),
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique(workspace_id,user_id)
);

create index if not exists business_workspace_members_user_idx
  on public.business_workspace_members(user_id,workspace_id);

create trigger business_workspaces_updated_at
before update on public.business_workspaces
for each row execute function public.set_updated_at();

create or replace function public.add_business_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_workspace_members(workspace_id,user_id,role)
  values(new.id,new.owner_id,'owner')
  on conflict(workspace_id,user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists business_workspace_owner_membership on public.business_workspaces;
create trigger business_workspace_owner_membership
after insert on public.business_workspaces
for each row execute function public.add_business_workspace_owner();

create or replace function public.is_business_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
  );
$$;

alter table public.business_workspaces enable row level security;
alter table public.business_workspace_members enable row level security;

drop policy if exists "Business workspaces: members read" on public.business_workspaces;
create policy "Business workspaces: members read"
on public.business_workspaces for select to authenticated
using (public.is_business_workspace_member(id) or public.is_admin());

drop policy if exists "Business workspaces: owners create" on public.business_workspaces;
create policy "Business workspaces: owners create"
on public.business_workspaces for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "Business workspaces: owners update" on public.business_workspaces;
create policy "Business workspaces: owners update"
on public.business_workspaces for update to authenticated
using (
  owner_id = (select auth.uid()) or public.is_admin()
)
with check (
  owner_id = (select auth.uid()) or public.is_admin()
);

drop policy if exists "Business workspace members: members read" on public.business_workspace_members;
create policy "Business workspace members: members read"
on public.business_workspace_members for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_business_workspace_member(workspace_id)
  or public.is_admin()
);

revoke all on public.business_workspaces from anon;
revoke all on public.business_workspace_members from anon;
grant select,insert,update on public.business_workspaces to authenticated;
grant select on public.business_workspace_members to authenticated;
