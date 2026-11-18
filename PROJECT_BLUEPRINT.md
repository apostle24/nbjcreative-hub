# NBJCreative Hub — Product & Platform Blueprint

## 1. Product vision
NBJCreative Hub is a global digital-products business. The first release sells products owned and managed by NBJCreative Hub. The architecture should leave room for a multi-vendor marketplace, but third-party vendor onboarding and payouts are explicitly deferred until the owned-product store is stable.

## 2. Current baseline (audited 2026-11-18)
- Next.js 15, React 19, TypeScript and Tailwind CSS.
- Deployed on Render from GitHub.
- Existing frontend is a marketing/storefront prototype with sample catalogue data.
- No production database, authentication, admin CRUD, order processing, payment verification, protected downloads or customer order history are implemented.
- Payhip currently hosts the first product and handles its checkout/delivery independently. It is not a native checkout integration in this application.

## 3. Target architecture
- Web application: Next.js App Router + TypeScript.
- Hosting: Render web service.
- Database, authentication and file storage: Supabase (Postgres, Auth, private Storage).
- Payments: Paystack for Ghana-based merchant processing, subject to account capability, currency and international card acceptance checks.
- Email: transactional email provider to be selected before production order emails are enabled.
- Analytics: privacy-conscious event and sales analytics; provider to be selected later.
- Source control and deployments: GitHub main branch with Render auto-deploy.

## 4. Release 1 — Owned-product commerce (build in this order)
1. Product and category data model; replace hardcoded sample catalogue.
2. Public storefront: home, category listing, search/filter, product details, FAQs and contact.
3. Customer authentication (email sign-up/sign-in, password reset) and account area.
4. Admin role and protected dashboard.
5. Admin product management: create/edit/archive products, pricing, cover images, downloadable files and publication status.
6. Cart/checkout flow and Paystack payment initialization.
7. Server-side payment verification and signed webhook handling; never trust a browser success redirect as proof of payment.
8. Order records and idempotent payment event processing.
9. Secure digital delivery: private storage, short-lived signed download links, entitlement checks and download limits.
10. Customer order history, receipts/confirmation emails and support contact.
11. Operational pages: terms, privacy, refund/digital delivery policy, contact and help.
12. Monitoring, backups, security review, accessibility, SEO and end-to-end testing.

## 5. Core data entities
- profiles: user profile and role (customer/admin); role changes restricted to trusted server-side admin actions.
- categories: name, slug, description, sort order, active state.
- products: title, slug, summary, description, price, currency, cover asset, status, category, SEO fields.
- product_files: private storage object path, filename, version, size and product association.
- orders: customer, reference, amount, currency, payment status, fulfillment status and timestamps.
- order_items: product snapshot, quantity and unit price at purchase.
- payment_events: provider event/reference, verified payload metadata, processing status and idempotency key.
- download_entitlements: order item, customer, expiry/limits and revocation state.
- support_messages: customer enquiry and status.

## 6. Security requirements
- Supabase Row Level Security on all customer-facing tables.
- Admin authorization enforced server-side; never rely only on hiding UI.
- Service-role and payment secrets only in server environment variables.
- Verify Paystack transactions server-side and validate webhook signatures.
- Make webhook handling idempotent to prevent duplicate orders or fulfillment.
- Keep paid files in private storage; authorize every download and issue short-lived signed URLs.
- Validate and limit file uploads; restrict types and sizes.
- Never commit credentials, private customer data or payment secrets to Git.

## 7. Release 2 — Marketplace (after Release 1 is stable)
- Vendor applications, review and approval.
- Vendor profiles and storefronts.
- Vendor product submission and moderation.
- Commission rules, vendor balances, payout reconciliation and dispute workflow.
- Tax, consumer protection and payment-provider review for each target market.
- Vendor analytics and reporting.

## 8. Out of scope until separately approved
- Native mobile apps.
- Automated vendor payouts.
- Multi-currency settlement/display promises.
- AI product generation features.
- Subscription billing.
- Any claim that the prototype is ready to accept direct payments.

## 9. Definition of done for Release 1
A real customer can discover a published product, create an account or check out according to the chosen policy, pay through a verified payment flow, receive a confirmed order, access only the files they purchased, retrieve those files later from their account, and contact support. An authorized admin can manage products and orders. Automated tests cover payment verification, webhook replay, authorization and download access.

## 10. Build discipline
Implement one milestone at a time. For each milestone: make a focused GitHub change, deploy to a staging/preview environment where possible, test it, record what passed and what remains, then continue. Do not advertise the platform as fully operational until the end-to-end definition of done passes.
