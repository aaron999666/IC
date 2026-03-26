# IC MatchRail

IC MatchRail is a React + TypeScript frontend starter for an IC chip B2B brokerage platform. It is shaped around four platform pillars:

- canonical chip data dictionary
- AI-assisted BOM parsing
- escrow-aware sourcing workflow
- points-based monetization instead of subscriptions

## What is included

- landing page with high-density industrial UI
- buyer market board for live sourcing results
- AI BOM parsing workspace with normalization preview
- data center view for dictionary pipeline and Supabase schema spine
- seller and buyer dashboard for RFQ, inventory sync and points ledger
- Cloudflare Pages SPA fallback via `public/_redirects`

## Stack

- React 19
- TypeScript
- Vite
- React Router

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Environment variables

Copy values from `.env.example` when you wire real services:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ENV`

## Suggested next implementation steps

1. Connect Supabase and create the first schema: `chip_family`, `chip_sku`, `cross_reference`, `seller_inventory`, `rfq_thread`, `quote`, `escrow_order`, `points_ledger`.
2. Replace mock market and BOM data with real loaders fed by catalog crawlers and distributor imports.
3. Add auth, KYB flow, quote privacy and points ledger mutations behind RLS policies.
4. Connect Cloudflare Pages CI/CD after the GitHub remote is created.

## GitHub remote

`gh` is not installed in this environment, so the project is initialized as a local Git repository only. Once you create a remote repository, connect it with:

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```
