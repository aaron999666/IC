create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists vector;

create type public.company_role as enum ('owner', 'admin', 'buyer', 'seller', 'finance', 'ops');
create type public.kyb_status as enum ('draft', 'pending', 'approved', 'rejected');
create type public.inventory_status as enum ('draft', 'live', 'reserved', 'sold', 'archived');
create type public.rfq_status as enum ('draft', 'open', 'quoted', 'awarded', 'closed', 'cancelled');
create type public.quote_status as enum ('draft', 'submitted', 'accepted', 'rejected', 'expired');
create type public.escrow_status as enum ('pending_funding', 'funded', 'qc_pending', 'released', 'disputed', 'cancelled');
create type public.parse_job_status as enum ('queued', 'completed', 'failed');
create type public.points_event_type as enum (
  'kyb_reward',
  'erp_sync_reward',
  'escrow_rebate',
  'contact_reveal_spend',
  'rfq_priority_spend',
  'bom_parse_spend',
  'insight_spend',
  'manual_adjustment'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  country_code text,
  tax_id text,
  website_url text,
  kyb_status public.kyb_status not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.company_role not null default 'buyer',
  is_active boolean not null default true,
  invited_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (company_id, user_id)
);

create or replace function public.current_company_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(company_id), '{}'::uuid[])
  from public.company_members
  where user_id = auth.uid()
    and is_active = true
$$;

create table public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text generated always as (lower(trim(name))) stored,
  country_code text,
  website_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (normalized_name)
);

create table public.chip_families (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  family_name text not null,
  base_model text not null,
  category text,
  subcategory text,
  lifecycle_status text not null default 'active',
  datasheet_url text,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (manufacturer_id, base_model)
);

create table public.chip_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  mount_type text,
  pin_count integer,
  description text,
  dimensions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (code)
);

create table public.chip_parts (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers(id) on delete restrict,
  family_id uuid references public.chip_families(id) on delete set null,
  package_id uuid references public.chip_packages(id) on delete set null,
  full_part_number text not null,
  normalized_part_number text generated always as (
    regexp_replace(upper(full_part_number), '[^A-Z0-9+]', '', 'g')
  ) stored,
  base_part_number text not null,
  packaging text,
  temp_grade text,
  pin_count integer,
  lifecycle_status text not null default 'active',
  description text,
  datasheet_url text,
  param_summary jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index chip_parts_normalized_part_number_key
  on public.chip_parts (normalized_part_number);

create index chip_parts_full_part_number_trgm_idx
  on public.chip_parts using gin (full_part_number gin_trgm_ops);

create table public.chip_part_aliases (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.chip_parts(id) on delete cascade,
  alias_text text not null,
  normalized_alias text generated always as (
    regexp_replace(upper(alias_text), '[^A-Z0-9+]', '', 'g')
  ) stored,
  alias_source text not null default 'manual',
  created_at timestamptz not null default timezone('utc', now()),
  unique (part_id, normalized_alias)
);

create index chip_part_aliases_alias_text_trgm_idx
  on public.chip_part_aliases using gin (alias_text gin_trgm_ops);

create table public.chip_part_datasheets (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.chip_parts(id) on delete cascade,
  source_url text not null,
  checksum_sha256 text,
  page_count integer,
  parser_model text,
  extracted_fields jsonb not null default '{}'::jsonb,
  extracted_at timestamptz not null default timezone('utc', now()),
  unique (part_id, source_url)
);

create table public.chip_part_embeddings (
  part_id uuid primary key references public.chip_parts(id) on delete cascade,
  embedding_model text not null default 'text-embedding-3-small',
  embedded_text text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index chip_part_embeddings_cosine_idx
  on public.chip_part_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table public.cross_references (
  id uuid primary key default gen_random_uuid(),
  source_part_id uuid not null references public.chip_parts(id) on delete cascade,
  replacement_part_id uuid not null references public.chip_parts(id) on delete cascade,
  compatibility_kind text not null check (
    compatibility_kind in ('drop_in', 'functionally_equivalent', 'package_compatible', 'partial')
  ),
  score numeric(5, 4) not null check (score >= 0 and score <= 1),
  rationale text,
  risk_flags text[] not null default '{}'::text[],
  verified_by text not null default 'ai',
  created_at timestamptz not null default timezone('utc', now()),
  unique (source_part_id, replacement_part_id)
);

create table public.inventory_listings (
  id uuid primary key default gen_random_uuid(),
  seller_company_id uuid not null references public.companies(id) on delete cascade,
  part_id uuid not null references public.chip_parts(id) on delete restrict,
  stock_qty numeric(18, 0) not null check (stock_qty >= 0),
  available_qty numeric(18, 0) not null check (available_qty >= 0),
  moq numeric(18, 0) not null default 1 check (moq >= 1),
  warehouse_country_code text,
  warehouse_city text,
  date_code text,
  lot_code text,
  packaging_condition text,
  status public.inventory_status not null default 'draft',
  supports_escrow boolean not null default false,
  display_currency text not null default 'CNY',
  display_price_min numeric(18, 6),
  display_price_max numeric(18, 6),
  sync_source text,
  sync_freshness_at timestamptz,
  certifications jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (display_price_min is null or display_price_min >= 0),
  check (display_price_max is null or display_price_max >= 0)
);

create index inventory_listings_part_status_idx
  on public.inventory_listings (part_id, status, sync_freshness_at desc);

create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  buyer_company_id uuid not null references public.companies(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  status public.rfq_status not null default 'draft',
  urgency text not null default 'normal',
  need_by date,
  currency text not null default 'CNY',
  destination_country_code text,
  buyer_note text,
  is_priority boolean not null default false,
  points_spent bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.rfq_lines (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  raw_input text not null,
  requested_part_number text,
  normalized_part_number text,
  part_id uuid references public.chip_parts(id) on delete set null,
  requested_qty numeric(18, 0) not null check (requested_qty > 0),
  target_unit_price numeric(18, 6),
  brand_hint text,
  replacement_allowed boolean not null default true,
  matched_replacement_part_id uuid references public.chip_parts(id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index rfq_lines_normalized_part_number_idx
  on public.rfq_lines (normalized_part_number);

create table public.rfq_matches (
  id uuid primary key default gen_random_uuid(),
  rfq_line_id uuid not null references public.rfq_lines(id) on delete cascade,
  seller_company_id uuid not null references public.companies(id) on delete cascade,
  inventory_listing_id uuid references public.inventory_listings(id) on delete set null,
  match_score numeric(5, 4) not null check (match_score >= 0 and match_score <= 1),
  match_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (rfq_line_id, seller_company_id, inventory_listing_id)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  rfq_match_id uuid references public.rfq_matches(id) on delete set null,
  buyer_company_id uuid not null references public.companies(id) on delete cascade,
  seller_company_id uuid not null references public.companies(id) on delete cascade,
  status public.quote_status not null default 'draft',
  currency text not null default 'CNY',
  valid_until timestamptz,
  payment_terms text,
  incoterm text,
  supports_escrow boolean not null default false,
  confidential_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index quotes_buyer_seller_status_idx
  on public.quotes (buyer_company_id, seller_company_id, status);

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  rfq_line_id uuid references public.rfq_lines(id) on delete set null,
  inventory_listing_id uuid references public.inventory_listings(id) on delete set null,
  unit_price numeric(18, 6) not null check (unit_price >= 0),
  quantity numeric(18, 0) not null check (quantity > 0),
  lead_time_days integer,
  brand text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.escrow_orders (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes(id) on delete cascade,
  buyer_company_id uuid not null references public.companies(id) on delete cascade,
  seller_company_id uuid not null references public.companies(id) on delete cascade,
  status public.escrow_status not null default 'pending_funding',
  funded_amount numeric(18, 2),
  currency text not null default 'CNY',
  funded_at timestamptz,
  qc_required boolean not null default false,
  qc_passed_at timestamptz,
  released_at timestamptz,
  dispute_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.bom_parse_jobs (
  id uuid primary key default gen_random_uuid(),
  buyer_company_id uuid not null references public.companies(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  status public.parse_job_status not null default 'queued',
  source_text text not null,
  line_count integer not null check (line_count >= 1),
  model_name text,
  prompt_version text not null default 'v1',
  token_usage jsonb not null default '{}'::jsonb,
  points_charged bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.bom_parse_lines (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.bom_parse_jobs(id) on delete cascade,
  line_number integer not null check (line_number >= 1),
  raw_line text not null,
  parsed_part_number text,
  parsed_quantity numeric(18, 0),
  parsed_brand text,
  matched_part_id uuid references public.chip_parts(id) on delete set null,
  confidence numeric(5, 4),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (job_id, line_number)
);

create table public.points_accounts (
  company_id uuid primary key references public.companies(id) on delete cascade,
  balance bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type public.points_event_type not null,
  delta bigint not null,
  reference_table text,
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.apply_points_ledger_entry()
returns trigger
language plpgsql
as $$
begin
  insert into public.points_accounts (company_id, balance, created_at, updated_at)
  values (new.company_id, new.delta, timezone('utc', now()), timezone('utc', now()))
  on conflict (company_id)
  do update
    set balance = public.points_accounts.balance + excluded.balance,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create trigger manufacturers_set_updated_at
before update on public.manufacturers
for each row execute function public.set_updated_at();

create trigger chip_families_set_updated_at
before update on public.chip_families
for each row execute function public.set_updated_at();

create trigger chip_packages_set_updated_at
before update on public.chip_packages
for each row execute function public.set_updated_at();

create trigger chip_parts_set_updated_at
before update on public.chip_parts
for each row execute function public.set_updated_at();

create trigger chip_part_embeddings_set_updated_at
before update on public.chip_part_embeddings
for each row execute function public.set_updated_at();

create trigger inventory_listings_set_updated_at
before update on public.inventory_listings
for each row execute function public.set_updated_at();

create trigger rfqs_set_updated_at
before update on public.rfqs
for each row execute function public.set_updated_at();

create trigger quotes_set_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

create trigger escrow_orders_set_updated_at
before update on public.escrow_orders
for each row execute function public.set_updated_at();

create trigger bom_parse_jobs_set_updated_at
before update on public.bom_parse_jobs
for each row execute function public.set_updated_at();

create trigger points_accounts_set_updated_at
before update on public.points_accounts
for each row execute function public.set_updated_at();

create trigger points_ledger_apply_delta
after insert on public.points_ledger
for each row execute function public.apply_points_ledger_entry();

create or replace function public.find_similar_parts(
  query_embedding vector(1536),
  match_count integer default 3,
  min_similarity numeric default 0.75
)
returns table (
  part_id uuid,
  full_part_number text,
  manufacturer_name text,
  similarity numeric
)
language sql
stable
as $$
  select
    p.id as part_id,
    p.full_part_number,
    m.name as manufacturer_name,
    (1 - (e.embedding <=> query_embedding))::numeric(6, 5) as similarity
  from public.chip_part_embeddings e
  join public.chip_parts p on p.id = e.part_id
  join public.manufacturers m on m.id = p.manufacturer_id
  where (1 - (e.embedding <=> query_embedding)) >= min_similarity
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1)
$$;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.inventory_listings enable row level security;
alter table public.rfqs enable row level security;
alter table public.rfq_lines enable row level security;
alter table public.rfq_matches enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.escrow_orders enable row level security;
alter table public.bom_parse_jobs enable row level security;
alter table public.bom_parse_lines enable row level security;
alter table public.points_accounts enable row level security;
alter table public.points_ledger enable row level security;

create policy "company members can view their membership"
on public.company_members
for select
using (user_id = auth.uid());

create policy "company members can view their company"
on public.companies
for select
using (id = any(public.current_company_ids()));

create policy "seller can manage own inventory"
on public.inventory_listings
for all
using (seller_company_id = any(public.current_company_ids()))
with check (seller_company_id = any(public.current_company_ids()));

create policy "authenticated users can browse live inventory"
on public.inventory_listings
for select
using (auth.role() = 'authenticated' and status = 'live');

create policy "buyer company manages own rfqs"
on public.rfqs
for all
using (buyer_company_id = any(public.current_company_ids()))
with check (buyer_company_id = any(public.current_company_ids()));

create policy "buyer company manages own rfq lines"
on public.rfq_lines
for all
using (
  exists (
    select 1
    from public.rfqs r
    where r.id = rfq_lines.rfq_id
      and r.buyer_company_id = any(public.current_company_ids())
  )
)
with check (
  exists (
    select 1
    from public.rfqs r
    where r.id = rfq_lines.rfq_id
      and r.buyer_company_id = any(public.current_company_ids())
  )
);

create policy "rfq matches visible to buyer or matched seller"
on public.rfq_matches
for select
using (
  seller_company_id = any(public.current_company_ids())
  or exists (
    select 1
    from public.rfq_lines l
    join public.rfqs r on r.id = l.rfq_id
    where l.id = rfq_matches.rfq_line_id
      and r.buyer_company_id = any(public.current_company_ids())
  )
);

create policy "seller can create rfq matches"
on public.rfq_matches
for insert
with check (seller_company_id = any(public.current_company_ids()));

create policy "quotes visible only to both counterparties"
on public.quotes
for select
using (
  buyer_company_id = any(public.current_company_ids())
  or seller_company_id = any(public.current_company_ids())
);

create policy "seller can create quotes"
on public.quotes
for insert
with check (seller_company_id = any(public.current_company_ids()));

create policy "quote parties can update quotes"
on public.quotes
for update
using (
  buyer_company_id = any(public.current_company_ids())
  or seller_company_id = any(public.current_company_ids())
)
with check (
  buyer_company_id = any(public.current_company_ids())
  or seller_company_id = any(public.current_company_ids())
);

create policy "quote lines visible only to quote parties"
on public.quote_lines
for select
using (
  exists (
    select 1
    from public.quotes q
    where q.id = quote_lines.quote_id
      and (
        q.buyer_company_id = any(public.current_company_ids())
        or q.seller_company_id = any(public.current_company_ids())
      )
  )
);

create policy "seller can insert quote lines for own quotes"
on public.quote_lines
for insert
with check (
  exists (
    select 1
    from public.quotes q
    where q.id = quote_lines.quote_id
      and q.seller_company_id = any(public.current_company_ids())
  )
);

create policy "escrow visible only to buyer and seller"
on public.escrow_orders
for select
using (
  buyer_company_id = any(public.current_company_ids())
  or seller_company_id = any(public.current_company_ids())
);

create policy "escrow parties can update their order"
on public.escrow_orders
for update
using (
  buyer_company_id = any(public.current_company_ids())
  or seller_company_id = any(public.current_company_ids())
)
with check (
  buyer_company_id = any(public.current_company_ids())
  or seller_company_id = any(public.current_company_ids())
);

create policy "buyer company owns bom parse jobs"
on public.bom_parse_jobs
for all
using (buyer_company_id = any(public.current_company_ids()))
with check (buyer_company_id = any(public.current_company_ids()));

create policy "buyer company owns bom parse lines"
on public.bom_parse_lines
for select
using (
  exists (
    select 1
    from public.bom_parse_jobs j
    where j.id = bom_parse_lines.job_id
      and j.buyer_company_id = any(public.current_company_ids())
  )
);

create policy "company can view own points account"
on public.points_accounts
for select
using (company_id = any(public.current_company_ids()));

create policy "company can view own points ledger"
on public.points_ledger
for select
using (company_id = any(public.current_company_ids()));
