# Supabase setup — NBJCreative Hub

This guide creates the backend project. Do not paste secret keys into GitHub, chat, or client-side code.

## A. Create the Supabase project
1. Open https://supabase.com and sign in.
2. Create a new project named `nbjcreative-hub`.
3. Choose a strong unique database password and store it in a password manager.
4. Choose a nearby region with acceptable latency for your expected customers; compare available regions in the dashboard.
5. Wait until the project is ready.

## B. Apply the database schema
1. In the Supabase project, open **SQL Editor**.
2. Choose **New query**.
3. Open this repository file: `supabase/migrations/0001_initial_schema.sql`.
4. Copy the complete SQL into the editor and run it.
5. Confirm the query completes successfully and the tables appear under **Table Editor**.

The migration creates profiles, categories, products, private product files, orders, order items, payment events, download entitlements and support messages. It also enables row-level security and creates a private file bucket.

## C. Collect only the public project settings
In **Project Settings → API** (or **Data API**, depending on dashboard layout), copy:
- Project URL
- Publishable/anon key (public key only)

Add these to Render as environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The service-role key is privileged. Do not put it in a `NEXT_PUBLIC_*` variable, browser code, GitHub, or chat. We will configure it only for trusted server-side operations when we build payment verification and file delivery.

## D. Configure authentication
1. Open **Authentication → URL Configuration**.
2. Set the Site URL to the deployed website URL for now: `https://nbjcreative-hub.onrender.com`.
3. Add the same URL to the Redirect URLs list.
4. Keep email confirmation enabled for production. Configure SMTP before relying on production sign-up emails.

## E. Owner admin account
1. Sign up through the website after authentication is implemented.
2. Verify the account email.
3. Only after confirming the correct owner account, use the Supabase SQL Editor to promote that profile to admin:
   `update public.profiles set role = 'admin' where email = 'YOUR_VERIFIED_OWNER_EMAIL';`
4. Never expose admin promotion in a public signup form.

## Important
- The migration is a first backend foundation, not a finished store.
- No payment is collected by this schema.
- No downloadable file is publicly accessible.
- Do not upload real customer data or paid files until the application-side authorization and download routes are implemented and tested.
