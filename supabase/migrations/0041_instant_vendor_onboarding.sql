-- NBJCreative Hub: remove manual approval from seller onboarding.
-- Job and project applications retain employer-controlled approval workflows.

drop policy if exists "Vendors: submit own application" on public.vendor_profiles;
drop policy if exists "Vendors: edit pending application" on public.vendor_profiles;

-- Existing seller applications should not remain blocked after this policy change.
update public.vendor_profiles
set status = 'approved'
where status = 'pending';

create policy "Vendors: activate own seller account"
on public.vendor_profiles for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and status = 'approved'
  and reviewed_at is null
);

comment on table public.vendor_profiles is
  'Seller storefront accounts are activated automatically by the owner. Administrators may later suspend accounts for policy violations.';
