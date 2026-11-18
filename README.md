# NBJCreative Hub

A global-facing digital products storefront, built with Next.js, TypeScript and Tailwind CSS.

## Current implementation
- Responsive marketing homepage and navigation
- Eight product departments
- Search and category filtering for the initial catalogue
- Product preview cards and launch-state messaging
- About, newsletter-interest and footer sections

## Important status
This is the first frontend milestone. Checkout, customer authentication, order management, protected file delivery, database integration, admin CRUD and vendor marketplace features are **not implemented yet**. Product prices and coming-soon entries are illustrative; do not accept payments from this prototype.

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Next milestones
1. Connect Supabase for products, customer accounts and orders.
2. Build a secure admin dashboard and product/file management.
3. Integrate a Ghana-compatible payment provider and verify payment webhooks.
4. Implement protected digital delivery and customer order history.
5. Test the complete purchase flow before public launch.
6. Add vendor marketplace functionality only after the owned-product store is stable.

## Environment
Copy `.env.example` to `.env.local` when integrations are introduced. Never commit real secrets.
