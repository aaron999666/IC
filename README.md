# ICCoreHub

`ICCoreHub.com` is a React + TypeScript starter for a pure information-flow IC chip platform. The product focus is:

- canonical chip dictionary and substitute graph
- dual-engine AI BOM cleansing
- redacted public inventory search
- server-side contact reveal with points deduction

## What is in the repo

- branded `ICCoreHub` landing page and navigation
- public market board with Supabase RPC loader fallback to local demo data
- live AI BOM workspace wired to Cloudflare Pages Functions
- dual-engine BOM parsing strategy docs at `docs/bom-dual-engine-strategy.md`
- Supabase base schema at `supabase/migrations/20260326190000_initial_matchrail.sql`
- pure information-flow MVP layer at `supabase/migrations/20260326210000_add_information_flow_mvp_layer.sql`
- Cloudflare Pages config in `wrangler.toml`
- custom brand mark at `public/iccorehub-mark.svg`

## Stack

- React 19
- TypeScript
- Vite
- React Router
- Cloudflare Pages Functions
- Supabase Postgres + RLS + RPC

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
```

## Frontend environment

Copy `.env.example` and provide:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ENV`

When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist, the market board calls `search_public_inventory(...)`. Otherwise it falls back to the local demo dataset.

## Cloudflare Pages Function environment

Copy `.dev.vars.example` for local Pages Function testing:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_BASE_URL`
- `WORKERS_AI_MODEL`
- `BOM_MAX_LINES`
- `BOM_FREE_LINES`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DEFAULT_BUYER_COMPANY_ID`
- `SUPABASE_DEFAULT_SUBMITTED_BY_USER_ID`

## BOM parsing flow

The endpoint at `functions/api/bom/parse.ts` now does four things:

1. cleans and validates the incoming BOM text
2. calls Gemini 1.5 Flash first
3. falls back to Cloudflare Workers AI if Gemini fails
4. optionally persists the normalized result into `bom_parse_jobs`, `bom_parse_lines` and `points_ledger`

Example request:

```json
{
  "text": "STM32 F103 C8 T6, 8000\nMAX 3232ESE, 12000",
  "persistResult": true,
  "chargePoints": true
}
```

If Supabase service variables or default IDs are missing, parsing still succeeds and the response returns `storage.status = "skipped"` with the reason.

## Public inventory RPC flow

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

## Cloudflare config note

`wrangler.toml` is included for Pages build output, model defaults and the `AI` binding name. Keep secrets in Cloudflare environment variables or `.dev.vars` locally.

## GitHub

Remote repository: [github.com/aaron999666/IC](https://github.com/aaron999666/IC)
