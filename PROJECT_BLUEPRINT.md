# NBJCreative Hub — Product & Platform Blueprint

**Vision:** Create · Learn · Earn · Work · Grow.

## 1. Product vision

NBJCreative Hub is a global digital business and opportunity ecosystem. It brings commerce, employment, education, entrepreneurship and professional connections into one connected platform.

It is not merely a digital-products storefront, job board, course website or business directory. The value comes from the connected journeys between these areas.

### Core modules

1. **NBJ Marketplace:** buy and sell physical products, digital products and online services.
2. **Vendor Centre:** seller workspace for stores, listings, orders, fulfilment, sales and payouts.
3. **NBJ Work:** employers, job seekers, professionals, jobs, applications, contracts and work opportunities.
4. **NBJ Academy:** instructors, courses, students, learning journeys, assessments and certificates.
5. **NBJ Business:** business identity, public discovery, products/services, customer enquiries, promotion, sales connections and growth opportunities. Financial tools are optional support capabilities, not the core purpose.
6. **Admin Centre:** secure platform-wide administration, moderation, support and operational oversight.

### Future expansion

- **NBJ Network:** broader professional, business, creator and organisational connections.
- **NBJ Intelligence:** intelligent assistance for discovery, productivity, learning and business operations.

### Platform principles

- One website and one connected application.
- One shared account identity across modules and roles.
- Shared backend, profiles, permissions and platform services.
- Users should be able to move naturally between learning, work, business and commerce.
- Preserve working systems; extend rather than rebuild without cause.
- Build for international use. Do not hard-code all transactions to GHS.
- Do not treat optional finance/budget tools as the central product.

## 2. Current technical architecture

- Web application: Next.js App Router, React and TypeScript.
- Hosting: Render, deployed from GitHub.
- Database, authentication and file storage: Supabase.
- Payments: Paystack integration, with production and international capabilities to be verified by market and payment method.
- Transactional email: implementation foundation exists for NBJ Business enquiries; provider/domain configuration is deferred until launch preparation.
- Source control: GitHub repository `apostle24/nbjcreative-hub`.

## 3. Current implementation snapshot

As of 2026-11-24, the repository contains application areas and database migrations for Marketplace, Vendor Centre, Work, Academy, Business and Admin Centre.

Important implemented foundations include:
- Marketplace catalogue, cart, checkout, order lifecycle, Paystack verification/webhook and protected digital downloads.
- Vendor onboarding, product publishing, seller order management and shipment tracking.
- Work job, employer, candidate and application routes.
- Academy course, instructor, learning, assessment, certificate and payout routes.
- Business workspaces, public profiles/directory, customer enquiries, marketplace offerings, organic spotlights and performance overview.
- Owner-restricted Admin Centre and operational routes.

This is a code and project-history snapshot, not a declaration that every workflow has passed end-to-end testing. The project owner has confirmed specific live tests; other journeys remain unverified.

## 4. Completion programme

1. **Platform audit:** inventory routes, database objects, policies, integrations, tests and live workflows. Classify each as working/tested, implemented/unverified, incomplete, missing or blocked.
2. **Marketplace and Vendor Centre:** complete buyer/seller journeys, physical fulfilment, digital/service delivery, returns, refunds, payment reconciliation and payouts.
3. **NBJ Work:** complete employer and talent journeys, recruitment, communication, verification and work/contract lifecycle.
4. **NBJ Academy:** complete instructor publishing, student enrolment, learning, assessment, certificate and earnings journeys.
5. **NBJ Business:** deepen business discovery, customer relationships, promotion, sales connections and business opportunities.
6. **Admin Centre and shared services:** complete platform oversight, roles, moderation, support, notifications, security and reporting.
7. **Future expansion:** scope NBJ Network and NBJ Intelligence after core modules are stable.
8. **Global launch readiness:** domain, professional email, email-provider configuration, international readiness, accessibility, performance, monitoring, backups and final testing.

## 5. Security and reliability requirements

- Enforce Row Level Security and least-privilege database grants.
- Enforce authorization server-side; never rely only on hidden UI.
- Keep Supabase service-role and payment credentials server-side.
- Verify payment transactions server-side and validate webhook signatures.
- Make payment fulfilment idempotent.
- Keep paid files private and authorize every download.
- Validate uploads and restrict file type/size.
- Protect customer, seller, employer and student information.
- Add automated tests for authorization, payments, webhook replay, fulfilment and downloads.
- Monitor deployments and errors; maintain a recovery and backup plan.

## 6. Deferred until final launch preparation

- Purchase and connect the permanent NBJCreative Hub domain.
- Configure professional domain email and transactional email delivery.
- Complete final global payment, localisation and operational checks.

The current Render URL remains the development/testing address until then.

## 7. Definition of done

The platform is not considered complete merely because routes or database tables exist. Each core user journey must be demonstrated end-to-end with the appropriate user roles, verified data, permissions and failure handling. Automated tests and manual acceptance tests must pass, and launch-critical security and operational checks must be completed.

## 8. Build discipline

For every milestone:
1. Inspect existing code, schema and policies first.
2. Define the intended user journey and acceptance criteria.
3. Implement the smallest coherent change that advances the ecosystem.
4. Deploy and verify the deployment.
5. Test with the relevant user roles and realistic data.
6. Record what passed, what failed and what remains.
7. Do not claim a migration, deployment or workflow succeeded without evidence.

Do not create duplicate systems where an existing shared module should be reused. Do not add features that pull the platform away from the ecosystem vision.
