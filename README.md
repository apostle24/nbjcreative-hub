# NBJCreative Hub

**Create · Learn · Earn · Work · Grow**

NBJCreative Hub is being developed as a global digital business and opportunity ecosystem: one connected platform for buying and selling, learning and teaching, finding work, building businesses and connecting with opportunities.

## Platform modules

- **NBJ Marketplace** — physical products, digital products and online services.
- **Vendor Centre** — seller onboarding, listings, orders, fulfilment and sales.
- **NBJ Work** — employers, job seekers, jobs, applications and talent discovery.
- **NBJ Academy** — instructors, courses, lessons, assessments, student progress and certificates.
- **NBJ Business** — business workspaces, public profiles, discovery, customer enquiries, marketplace offerings and business performance.
- **Admin Centre** — platform administration, moderation and operational oversight.
- **Future expansion:** NBJ Network and NBJ Intelligence.

The intended experience is one website, one shared account identity and connected platform infrastructure—not separate standalone products.

## Current technical foundation

- Next.js App Router, React and TypeScript.
- Render deployment connected to GitHub.
- Supabase authentication, PostgreSQL database and Storage.
- Paystack payment integration.
- Marketplace ordering, protected digital delivery and vendor workflows.
- Work, Academy, Business and Admin application areas.

## Development status

The repository contains substantial working foundations across the modules. Some workflows have been tested by the project owner, while others still require end-to-end testing, security review or completion. A feature's presence in the code does not by itself mean it is production-ready.

See [PROJECT_BLUEPRINT.md](./PROJECT_BLUEPRINT.md) for the authoritative vision and [PLATFORM_COMPLETION_REGISTER.md](./PLATFORM_COMPLETION_REGISTER.md) for the current audit register and outstanding work.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment and security

Copy `.env.example` to `.env.local` when setting up a local environment. Never commit real credentials, service-role keys or payment secrets. Production secrets belong in the hosting provider's protected environment-variable settings.
