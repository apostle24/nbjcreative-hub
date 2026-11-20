-- Migration 0039: NBJ Business Finance Centre
-- Workspace-scoped income, expenses, budgets and transaction history.

create table if not exists public.business_financial_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.business_workspaces(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  category text not null check (char_length(trim(category)) between 1 and 100),
  description text not null check (char_length(trim(description)) between 1 and 250),
  amount numeric(14,2) not null check (amount > 0),
  currency varchar(3) not null check (currency ~ '^[A-Z]{3}$'),
  transaction_date date not null default current_date,
  payment_method text check (payment_method is null or payment_method in ('cash', 'bank_transfer', 'mobile_money', 'card', 'other')),
  reference text,
  notes text,
  status text not null default 'recorded' check (status in ('recorded', 'voided')),
  voided_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.business_workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  category text not null check (char_length(trim(category)) between 1 and 100),
  amount numeric(14,2) not null check (amount > 0),
  currency varchar(3) not null check (currency ~ '^[A-Z]{3}$'),
  period text not null check (period in ('monthly', 'quarterly', 'yearly', 'custom')),
  start_date date not null,
  end_date date,
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_budgets_valid_dates check (end_date is null or end_date >= start_date),
  constraint business_budgets_custom_end_date check (period <> 'custom' or end_date is not null)
);

create index if not exists business_financial_transactions_workspace_date_idx
  on public.business_financial_transactions (workspace_id, transaction_date desc);
create index if not exists business_financial_transactions_workspace_type_idx
  on public.business_financial_transactions (workspace_id, transaction_type, currency);
create index if not exists business_budgets_workspace_status_idx
  on public.business_budgets (workspace_id, status, start_date desc);

create or replace function public.can_manage_business_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'manager')
  );
$$;

revoke all on function public.can_manage_business_workspace(uuid) from public;
grant execute on function public.can_manage_business_workspace(uuid) to authenticated;

alter table public.business_financial_transactions enable row level security;
alter table public.business_budgets enable row level security;

drop policy if exists "Business members read financial transactions" on public.business_financial_transactions;
create policy "Business members read financial transactions"
  on public.business_financial_transactions for select to authenticated
  using (public.is_business_workspace_member(workspace_id));

drop policy if exists "Business managers add financial transactions" on public.business_financial_transactions;
create policy "Business managers add financial transactions"
  on public.business_financial_transactions for insert to authenticated
  with check (
    public.can_manage_business_workspace(workspace_id)
    and created_by = auth.uid()
  );

drop policy if exists "Business managers update financial transactions" on public.business_financial_transactions;
create policy "Business managers update financial transactions"
  on public.business_financial_transactions for update to authenticated
  using (public.can_manage_business_workspace(workspace_id))
  with check (
    public.can_manage_business_workspace(workspace_id)
    and created_by = (select created_by from public.business_financial_transactions t where t.id = id)
  );

drop policy if exists "Business members read budgets" on public.business_budgets;
create policy "Business members read budgets"
  on public.business_budgets for select to authenticated
  using (public.is_business_workspace_member(workspace_id));

drop policy if exists "Business managers create budgets" on public.business_budgets;
create policy "Business managers create budgets"
  on public.business_budgets for insert to authenticated
  with check (
    public.can_manage_business_workspace(workspace_id)
    and created_by = auth.uid()
  );

drop policy if exists "Business managers update budgets" on public.business_budgets;
create policy "Business managers update budgets"
  on public.business_budgets for update to authenticated
  using (public.can_manage_business_workspace(workspace_id))
  with check (public.can_manage_business_workspace(workspace_id));

drop trigger if exists set_business_financial_transactions_updated_at on public.business_financial_transactions;
create trigger set_business_financial_transactions_updated_at
  before update on public.business_financial_transactions
  for each row execute function public.set_updated_at();

drop trigger if exists set_business_budgets_updated_at on public.business_budgets;
create trigger set_business_budgets_updated_at
  before update on public.business_budgets
  for each row execute function public.set_updated_at();

comment on table public.business_financial_transactions is
  'Workspace-scoped business income and expense records. Keep reports grouped by currency.';
comment on table public.business_budgets is
  'Workspace-scoped budgets with explicit currency and date periods.';
