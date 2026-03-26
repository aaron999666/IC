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
- SEO and GEO assets including route-level meta, JSON-LD, `robots.txt`, `sitemap.xml`, `llms.txt` and `og-cover.svg`
- admin AI provider console with encrypted secret storage and runtime fallback control
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
- `WORKERS_AI_BASE_URL`
- `WORKERS_AI_REQUEST_MODE`
- `WORKERS_AI_ACCOUNT_ID`
- `WORKERS_AI_API_TOKEN`
- `BOM_MAX_LINES`
- `BOM_FREE_LINES`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DEFAULT_BUYER_COMPANY_ID`
- `SUPABASE_DEFAULT_SUBMITTED_BY_USER_ID`
- `ADMIN_API_TOKEN`
- `ADMIN_ENCRYPTION_KEY`
- `AI_CONFIG_CACHE_TTL_SECONDS`

## BOM parsing flow

The endpoint at `functions/api/bom/parse.ts` now does four things:

1. cleans and validates the incoming BOM text
2. calls Gemini 1.5 Flash first
3. falls back to Cloudflare Workers AI if Gemini fails
4. optionally persists the normalized result into `bom_parse_jobs`, `bom_parse_lines` and `points_ledger`

At runtime the parser now tries to load provider settings from the secure admin table first, then falls back to environment defaults if admin storage is empty or unavailable.

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

## SEO and GEO assets

The repo now includes:

- dynamic route-level title, description, canonical, Open Graph and Twitter tags
- JSON-LD schema for the brand, website, FAQ and key public pages
- crawl controls in `public/robots.txt`
- URL inventory in `public/sitemap.xml`
- LLM-oriented summary files in `public/llms.txt` and `public/llms-full.txt`
- a social preview image in `public/og-cover.svg`

## Cloudflare config note

`wrangler.toml` is included for Pages build output, model defaults and the `AI` binding name. Keep secrets in Cloudflare environment variables or `.dev.vars` locally.

## Admin AI configuration

The admin console lives at `/admin/ai` and uses a bootstrap bearer token as the current server-side gate.

Security model in this repo:

- provider secrets are never stored in `VITE_*` variables
- the browser can write secrets but can never read them back
- provider secrets are encrypted before being stored in Supabase
- runtime parsing decrypts them only inside the Pages Function
- if secure admin storage is unavailable, parsing falls back to environment defaults

Related files:

- `functions/api/admin/ai-config.ts`
- `functions/api/ai-config-store.ts`
- `src/pages/AdminAiPage.tsx`
- `supabase/migrations/20260327013000_add_admin_ai_provider_configs.sql`

## GitHub

Remote repository: [github.com/aaron999666/IC](https://github.com/aaron999666/IC)
