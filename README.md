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
- Cloudflare Pages Function example for AI BOM parsing at `functions/api/bom/parse.ts`
- BOM dual-engine rollout notes at `docs/bom-dual-engine-strategy.md`
- Supabase bootstrap schema at `supabase/migrations/20260326190000_initial_matchrail.sql`
- Information-flow MVP layer at `supabase/migrations/20260326210000_add_information_flow_mvp_layer.sql`

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

For Cloudflare Pages Functions, copy values from `.dev.vars.example` for local edge testing:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_BASE_URL`
- `WORKERS_AI_MODEL`
- `BOM_MAX_LINES`
- `BOM_FREE_LINES`

## AI BOM endpoint

The example Pages Function lives at `functions/api/bom/parse.ts` and accepts:

```json
{
  "text": "STM32 F103 C8 T6, 8000\nMAX 3232ESE, 12000"
}
```

It returns structured rows plus billable line metadata so you can hook it into the points ledger later.
The endpoint now runs a dual-engine chain: Gemini primary, Workers AI fallback.

## Supabase schema

The migration file creates:

- company and membership tables for KYB and RLS scoping
- chip dictionary tables for manufacturers, families, packages, parts, aliases and datasheets
- vector storage plus a `find_similar_parts(...)` SQL function for substitute lookup
- inventory, RFQ, quotes and escrow tables for the trading workflow
- BOM parse job tables and points ledger tables for AI cost accounting

The second migration adds the lighter pure-information-flow layer:

- `company_private_profiles` for private seller contact data and credit score
- `public_inventory_search` for redacted live inventory search results
- `search_public_inventory(...)` for public RPC-based inventory lookup
- `unlock_inventory_contact(...)` for server-side points deduction plus contact reveal
- `inventory_contact_unlocks` for append-only unlock history

## Example RPC flow

Public search:

```sql
select *
from public.search_public_inventory('STM32F103', 20);
```

Contact unlock after the buyer is authenticated:

```sql
select *
from public.unlock_inventory_contact(
  'inventory-listing-uuid',
  'buyer-company-uuid'
);
```

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
