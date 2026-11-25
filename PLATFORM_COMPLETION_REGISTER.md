# NBJCreative Hub — Platform Completion Register

Last reviewed: 2026-11-25
Repository: apostle24/nbjcreative-hub

This register separates code presence from verified user journeys. A route, migration or database function is not automatically considered production-ready.

## Status definitions

- **Confirmed working:** the project owner has reported a successful live test.
- **Implemented; more testing required:** code and supporting database/API foundations exist, but the complete user journey has not been demonstrated.
- **Not yet implemented / not found in repository snapshot:** no sufficient implementation was identified in the inspected route inventory.
- **Deferred:** deliberately postponed until final launch preparation.

## Confirmed working from project history

### Marketplace and Vendor Centre
- Seller onboarding and product publishing.
- Physical, digital and online-service product types.
- Marketplace cart and checkout foundations.
- Paystack payment flow has completed successfully in a real user test.
- Seller can see paid orders.
- Digital product download from customer order history.
- Stock reservation and expiry handling have been applied and checked.
- Shipment tracking foundations are deployed.
- Customer order and seller order pages load.

### NBJ Business
- Business workspace creation and public listing.
- Public business directory and profile.
- Business profile sharing.
- Customer enquiry submission and owner inbox.
- Published Marketplace offerings displayed on public business profiles.
- Organic business spotlights and published-offering counts.
- Performance overview connected to listings, enquiries, orders and sales.

### Platform and administration
- Owner-restricted Admin Centre foundations deployed.
- Shared Supabase authentication and database infrastructure are in use.
- Render deployment is connected to GitHub.

## Implemented areas requiring end-to-end acceptance testing

### Marketplace / Vendor Centre
- Physical product purchase through delivery confirmation.
- Partial fulfilment and multiple-vendor order behaviour.
- Online-service delivery and customer acceptance.
- Returns, cancellations, refunds and dispute handling.
- Seller payout eligibility, reconciliation and settlement.
- Payment failure, duplicate webhook and recovery scenarios.
- International payment methods and currency behaviour.

### NBJ Work
Repository routes exist for jobs, employer workspaces, talent profiles, applications, CV handling, application review and employer verification.
- Complete employer-to-hire journey.
- Candidate application and status notifications.
- Employer verification lifecycle.
- Messaging, interviews, contracts and freelancer project/payment lifecycle.

### NBJ Academy
Repository routes and migrations exist for course creation, instructor management, student learning, assessments, certificates, reviews, notifications and instructor payout foundations.
- Complete instructor publish-to-earn journey.
- Complete student purchase/enrol-to-completion journey.
- Paid course checkout and payment fulfilment.
- Assessment completion and certificate verification.
- Instructor earnings, payout approval and settlement.

### NBJ Business
- Customer enquiry email delivery: application workflow exists, but provider/domain configuration is deferred.
- CRM/customer records, follow-up history and sales pipeline.
- Business-to-business connections and opportunity workflows.
- Deeper business analytics and promotion controls.

### Admin Centre
- End-to-end checks for each moderation and administrative action.
- Platform-wide user/role management and audit trail.
- Disputes, refunds and operational case management.
- Consistent reporting across Marketplace, Work, Academy and Business.

## Gaps identified in repository-level inspection

- `package.json` has development, build, start and lint scripts, but no automated test script or test framework dependency was identified.
- No test/spec/Playwright/Vitest/Jest files were found in the recursive repository tree inspected on 2026-11-24.
- README and project blueprint had become stale and described the platform as an early digital storefront. They have now been updated to reflect the ecosystem vision and current implementation status.
- A full schema/RLS/grant review and a complete route-by-route security review remain outstanding.

## Shared platform work still required

- Verify one consistent account identity and role experience across all modules.
- Verify navigation and dashboard journeys for customers, vendors, employers, candidates, instructors, students and business owners.
- Centralise and test notification delivery and user preferences.
- Complete security, privacy, upload validation, abuse prevention and access-control review.
- Add automated unit/integration/end-to-end testing.
- Verify backups, monitoring, error reporting and recovery procedures.
- Complete accessibility, responsive/mobile, performance and SEO review.

## Future expansion — not part of core completion yet

- NBJ Network.
- NBJ Intelligence.

These should be scoped after the core ecosystem modules are stable; do not let them delay core marketplace, work, learning and business journeys.

## Deferred until final launch preparation

- Purchase and connect the permanent platform domain.
- Configure professional domain email.
- Configure Resend and enable real transactional email delivery.
- Final international market, payment, legal and operational readiness checks.

The current Render URL remains the development/testing address until then.

## Immediate next audit sequence

1. Inspect package scripts and establish a safe automated testing baseline.
2. Audit Marketplace/Vendor Centre payment, fulfilment, refunds and payout routes against database functions and RLS.
3. Audit NBJ Work journeys and database permissions.
4. Audit NBJ Academy payment, learning and payout journeys.
5. Audit NBJ Business and Admin permissions, notifications and operations.
6. Build a role-based end-to-end acceptance checklist and execute it against the live application.

## Change-control rule

Before implementing a new feature, inspect the existing code, database schema, RLS policies and connected user journey. Reuse existing systems. Record the exact code commit, database migration confirmation, deployment status and user test result separately. Never label a workflow complete based on code presence alone.


## Detailed audit findings — 2026-11-24

### Marketplace / Vendor Centre — source inspection

**Implemented foundations confirmed in source**
- Marketplace payment initialization checks the signed-in customer owns the order, validates pending status, checks active stock reservations for physical items, and uses the configured public site URL for Paystack callback.
- Payment verification/webhook fulfilment was previously inspected: Paystack is verified server-side, amount/currency are checked, fulfilment is idempotent, and the fulfilment database function is service-role-only.
- Purchase-time `order_items.vendor_id` snapshot is populated during order creation. Migration 0046 backfills it and replaces the seller order query so seller order visibility and shipment updates use the order-item vendor snapshot, not the current product owner.
- Physical shipment updates check approved vendor ownership, paid status, physical product type, and forward-only fulfilment transitions.
- Online-service transitions check seller ownership, paid status, valid state transitions, and customer ownership for acceptance/revision. Private deliverables are stored in a private bucket and accessed through server routes.
- Vendor payout destination details are accessed through server routes using service_role; table access is revoked from anon/authenticated. Payout requests snapshot the destination details at request time.
- Vendor payout requests reserve balances while pending/approved/paid. External transfers are manual and an admin explicitly confirms the transfer before marking a request paid.

**Correction / integrity risks requiring a planned fix**
- The vendor earnings and payout-balance functions in migrations 0014/0015 still join `order_items` to the current `products.vendor_id`, instead of using the purchase-time `order_items.vendor_id` snapshot. This can omit earnings if a product is deleted and misattribute historic sales after a product changes owner. The seller order listing was corrected in migration 0046, but the earnings functions were not.
- The Marketplace admin payout PATCH route reads the current status and then updates the row in a separate request. It does not include the prior status in the update condition or use an atomic locked database function. Concurrent admin decisions can race. Replace with an atomic conditional transition, retaining the external-transfer confirmation requirement.
- No complete buyer-facing returns/refunds/disputes workflow was found in the inspected Marketplace routes and migrations. The existence of a refunded payment enum/status is not a refund workflow.
- Multi-vendor physical fulfilment, payment failure/retry and webhook replay, and full delivery acceptance remain live-test requirements.

### NBJ Academy — source inspection

**Implemented foundations confirmed in source**
- Paid course initialization creates a pending transaction, verifies the signed-in student, checks published course and course price/currency, and prevents already-active/completed duplicate enrolment.
- Instructor earnings are created idempotently when a payment transaction changes to paid. Earnings remain pending review until an administrator reconciles the platform fee.
- Instructor payout requests lock available earnings and reserve them. Admin payout functions lock payout requests, enforce allowed transitions, update reserved earnings, and write an audit record transactionally.
- Admin Academy finance API checks the signed-in user's database profile role before using privileged service-role RPCs. The privileged finance functions are not executable by anon/authenticated roles.
- Private lesson material and quiz-answer access protections were found in earlier migration inspection.

**Correction / integrity risks requiring a planned fix**
- Academy payment initialization builds its Paystack callback from `new URL(request.url).origin`. Align it with the canonical hosted-site callback setting used by Marketplace (`NEXT_PUBLIC_SITE_URL`) before accepting Academy payments in production.
- Instructor payout account details are stored directly on payout request records and surfaced to the admin finance API. Access is restricted by server-side admin checks, but the retention, masking and operational handling of those sensitive destination details need a dedicated review.
- Academy course purchase-to-completion, certificate issuance/verification, and instructor payout settlement remain live-test requirements. Admin payout functions record a paid status but do not themselves execute an external bank/mobile-money transfer.

### Admin identity and payout controls

- Admin middleware currently uses a hard-coded owner email allowlist, while sensitive admin API routes also check the user's database `profiles.role = 'admin'`. These are different gates. Verify the intended owner account and make the identity strategy consistent before broadening admin access; do not change the allowlist or roles without checking the actual database state.
- Marketplace payout API status changes need atomic concurrency protection as described above.
- Academy finance uses database-locked transitions and an audit log, which is a stronger pattern to reuse.

### Migration inventory issue

- The repository currently contains 57 migration files, with two different files using version prefix `0016`: `0016_product_reviews.sql` and `0016_vendor_order_management.sql`.
- This is a migration-history/CLI risk. Do not rename, reorder, or reapply either file until the live Supabase migration history is checked. Existing manually applied SQL must not be replayed blindly.

### Audit boundaries

- These are repository/source findings, not confirmation that the live database has every migration or that every route has been exercised.
- No application-code correction or database migration was applied as part of this audit update.
- The next checks are the remaining RLS/grant and route authorization review across Work, Academy, Business and Admin, followed by a consolidated prioritized correction plan and live acceptance checklist.


### Work / Academy / Business — RLS and route authorization review

**NBJ Work**
- Core employer, job and application tables have RLS enabled. Published jobs and public employer/candidate profiles are readable publicly; private application records are restricted to the applicant, the employer who owns the job, or an administrator.
- Application insert policy binds `applicant_id` to the signed-in user. Application updates/deletes are revoked from ordinary authenticated users; employer review is performed through a server route that checks the job's employer owner against the signed-in user.
- CV access route checks that the signed-in user owns the employer profile associated with the application before issuing a short-lived signed URL. Candidate documents are otherwise owner/admin restricted.
- Employer verification evidence uses owner/admin storage policies, and the admin verification API checks the database admin role.
- Remaining checks: inspect the complete applicant insert policy and application submission route together; test candidate-to-employer access boundaries with separate accounts; verify that public profile fields contain only intended public information. The full job-to-hire journey is still untested.

**NBJ Academy**
- Core course, section, lesson, enrolment and progress tables have RLS policies scoped to instructors, enrolled students and the student who owns progress/enrolment records.
- Quiz answer keys have instructor-only row policies despite authenticated table grants. Quiz attempts and responses are tied to the student and active enrolment; answer submission is limited to unsubmitted attempts.
- Private lesson-material storage policies restrict reads to the instructor or enrolled students (including completed enrolments), and restrict uploads/updates/deletes to the course instructor.
- Academy notifications are recipient-scoped; users can update their own read timestamp, while insert/delete are revoked from ordinary users.
- Continue reviewing certificate and notification function grants and test student/instructor separation against the live database.

**NBJ Business**
- Workspace reads and updates use workspace membership/owner checks. Customer enquiries are not directly writable by anon/authenticated roles; public submission goes through a validating security-definer function that accepts enquiries only for active public businesses. Enquiry status updates require an authenticated workspace manager.
- Public directory/profile/offerings are exposed through dedicated security-definer read functions rather than direct unrestricted access to private workspace records.
- Business performance function checks authentication and workspace-management permission.
- Public enquiry endpoint currently has no identified rate limit, CAPTCHA, or abuse throttling. Add an abuse-control design before public launch; do not block current working enquiry flow without a replacement.
- Email sending remains intentionally deferred until domain and sender configuration.

**Admin Centre**
- Admin API routes inspected for Marketplace products/reviews, vendor approval/review, Work verification, vendor payouts and Academy finance check the signed-in user's database profile role before using the service-role client or privileged finance functions.
- Middleware additionally applies the single-owner email allowlist to `/admin` and `/api/admin`. The database admin role and middleware allowlist must be kept aligned. The single-owner migration sets the owner account to admin and demotes other admin-role profiles; confirm the live account/role state before changing this policy.
- Work verification PATCH currently saves the verification status and then separately updates the employer's public `is_verified` flag. If the second write fails, the route reports partial failure; consider moving both writes into one database transaction.
- Admin route authorization is present in the inspected endpoints, but the remaining Admin pages/routes and their underlying table grants still require a complete review.



### Additional Academy certificate review

- Certificate issuance function checks that the requesting user owns an active enrolment, requires lesson completion and passing all published quizzes, and creates one certificate per enrolment.
- The certificate issuance function is declared `SECURITY DEFINER` with `search_path = public`, unlike the stricter empty-search-path convention used by most newer functions. Review and harden its search path and explicit execute grants/revokes in a later migration after confirming the live migration state.
- Certificate verification as a public, tamper-resistant lookup journey has not yet been confirmed; the current inspected migration establishes issuance and owner/instructor read access, not a complete public verification workflow.


### Final route-level checks and additional defects to verify

- NBJ Work employer application review converts `interviewAt` to ISO format before validating it. A malformed date can throw and return a generic 500 rather than a 400 validation response. Fix input validation order when the Work API correction pass begins.
- Work verification submission checks employer ownership and confirms the uploaded evidence object exists before saving the request. The review endpoint uses a service-role client only after authenticated owner/admin checks.
- Marketplace vendor review and approval endpoints both check the database admin role. The general review endpoint should also validate the vendor ID as a UUID and enforce allowed transition rules; it currently accepts any non-empty ID and writes one of the allowed statuses without checking the prior state.
- Academy finance GET returns payout account details to verified admins. This is intentional for transfer processing but should be masked in general UI responses and revealed only when needed for an actual payout.
- Business public enquiry endpoint has basic field validation and HTML escaping for email content. It does not currently enforce request throttling or a bot challenge. The SQL email-address regex in migration 0052 appears to contain a doubled backslash before the dot; verify the live RPC accepts a normal address before altering it. The user previously confirmed a successful enquiry, so treat this as a verification item rather than assuming a live defect.
- Academy payment initialization uses the request origin for the callback; the shared payment callback page does support both Marketplace orders and Academy course references through the central verification endpoint. This reduces duplicated callback logic, but the origin should still be canonicalized before production.
- No separate public certificate-verification route was found in the API/page inventory inspected. Certificate issuance and private student/instructor visibility exist; public verification remains unconfirmed.
- There is no current test runner or automated test suite in `package.json`. Establish a minimal test strategy (unit/integration plus Playwright or equivalent end-to-end coverage) before adding more platform surface area.

### Audit readiness and remaining external checks

The repository-level audit is now broad enough to move into a controlled correction plan. The following cannot be confirmed from GitHub source alone:
1. Which migrations are recorded as applied in the live Supabase project, especially the duplicate `0016` version.
2. Whether live RLS policies and function grants exactly match the repository migrations.
3. Whether current production data contains legacy order items with null or incorrect vendor snapshots.
4. Whether Academy Paystack callback and all payout/fulfilment paths pass real live end-to-end tests.
5. Whether the live owner account and `profiles.role` are aligned with the middleware owner allowlist.

Do not apply any migration, rename a migration, or change admin roles until these live-state checks are completed.


## Consolidated source audit update — 2026-11-25

The current `main` tree contains 171 files, 23 API route handlers and 66 SQL migration files. Vitest is configured, but the existing test suite still has only a setup smoke test; feature-level coverage is minimal.

### Earlier findings rechecked against current source

The following items listed as open in the earlier notes are already addressed in the current source and should not be treated as active defects:
- Vendor earnings and payout-balance functions use the purchase-time `order_items.vendor_id` snapshot (migration 0061), rather than the current product owner.
- Marketplace admin payout updates use a conditional status predicate to reject stale updates.
- Academy payment initialization uses `NEXT_PUBLIC_SITE_URL` with a hosted-forwarded-host fallback for the Paystack callback.
- Work interview date validation occurs before conversion to ISO.
- Public Business enquiries call `consume_business_enquiry_rate_limit` before accepting an enquiry.

### Current confirmed correction

- The Admin Vendor page's Approve button called the review API without `status: "approved"`, although the API required a status. This caused the approval action to be rejected as invalid input.
- The same review endpoint did not compare the vendor's previously displayed status during the update. A stale admin page could overwrite a newer decision.
- The correction sends the displayed status as `expectedStatus`, sends `status: "approved"` from the Approve action, and applies the update only when the database row still has the expected status. Stale decisions return HTTP 409 and require a refresh.
- Added focused unit coverage for accepted and rejected vendor status values.

### Outstanding items requiring live or broader testing

- The two migration files with prefix `0016` remain a Supabase migration-history/CLI risk. Do not rename or replay them until the live migration ledger is inspected.
- The current Admin identity still has two gates: the middleware owner-email allowlist and the database `profiles.role = 'admin'`. Verify the live owner account alignment before changing either.
- Returns/refunds/disputes, full multi-vendor fulfilment, global payment method coverage, complete Work-to-hire, Academy purchase-to-certificate, and instructor/vendor external payout settlement remain end-to-end acceptance items.
- Public certificate verification has not been confirmed in the route inventory.
- Review upload MIME/type enforcement, private bucket configuration, backup/recovery, monitoring and complete role-based RLS grants before public launch.

This update is based on the current GitHub source tree. It does not prove live Supabase migration parity, live production data integrity, Render deployment health or completion of user journeys.
