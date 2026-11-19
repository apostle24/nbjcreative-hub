-- NBJCreative Hub: promote the verified owner account to administrator.
-- First create the owner account in Supabase Authentication > Users.
-- Replace the placeholder below with the exact email used for that account.
-- Run this manually in the Supabase SQL Editor as the project owner.
-- Never expose this operation through a public website form.

update public.profiles
set role = 'admin'
where email = 'REPLACE-WITH-YOUR-ADMIN-EMAIL';
