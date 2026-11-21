-- NBJCreative Hub: the platform owner is the sole administrator.
-- All other accounts are customer accounts; ordinary users cannot inherit admin access.

update public.profiles
set role = 'customer'
where role = 'admin'
  and lower(coalesce(email, '')) <> 'nbjoshua8@gmail.com';

update public.profiles
set role = 'admin'
where lower(coalesce(email, '')) = 'nbjoshua8@gmail.com';

