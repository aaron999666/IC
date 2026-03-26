alter table public.inventory_listings
  add column if not exists is_promoted boolean not null default false,
  add column if not exists promoted_until timestamptz;

create index if not exists inventory_listings_live_promoted_idx
  on public.inventory_listings (status, is_promoted desc, promoted_until desc, created_at desc);

create table if not exists public.company_private_profiles (
  company_id uuid primary key references public.companies(id) on delete cascade,
  contact_person text not null,
  phone_number text not null,
  wechat_id text,
  credit_score integer not null default 5 check (credit_score between 1 and 5),
  sales_region text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger company_private_profiles_set_updated_at
before update on public.company_private_profiles
for each row execute function public.set_updated_at();

alter table public.company_private_profiles enable row level security;

create policy "company can manage own private profile"
on public.company_private_profiles
for all
using (company_id = any(public.current_company_ids()))
with check (company_id = any(public.current_company_ids()));

create table if not exists public.inventory_contact_unlocks (
  id uuid primary key default gen_random_uuid(),
  inventory_listing_id uuid not null references public.inventory_listings(id) on delete cascade,
  requester_company_id uuid not null references public.companies(id) on delete cascade,
  unlocked_by uuid not null references auth.users(id) on delete restrict,
  points_spent bigint not null default 50 check (points_spent >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (inventory_listing_id, requester_company_id)
);

create index if not exists inventory_contact_unlocks_requester_idx
  on public.inventory_contact_unlocks (requester_company_id, created_at desc);

alter table public.inventory_contact_unlocks enable row level security;

create policy "company can view own contact unlocks"
on public.inventory_contact_unlocks
for select
using (requester_company_id = any(public.current_company_ids()));

create or replace view public.public_inventory_search as
select
  il.id as inventory_listing_id,
  p.id as part_id,
  p.full_part_number as standard_part_number,
  m.name as brand,
  pkg.code as package_type,
  p.description,
  il.available_qty as available_quantity,
  il.moq,
  il.date_code,
  il.lot_code,
  il.display_currency as currency,
  il.display_price_min,
  il.display_price_max,
  case
    when il.display_price_min is null and il.display_price_max is null then 'Negotiable'
    when il.display_price_min is not null and il.display_price_max is not null then
      concat(il.display_currency, ' ', il.display_price_min, ' - ', il.display_price_max)
    when il.display_price_min is not null then
      concat(il.display_currency, ' >= ', il.display_price_min)
    else concat(il.display_currency, ' <= ', il.display_price_max)
  end as masked_price,
  coalesce(cpp.credit_score, 5) as seller_credit_score,
  il.supports_escrow,
  il.is_promoted,
  il.promoted_until,
  il.warehouse_country_code,
  il.warehouse_city,
  il.sync_freshness_at,
  il.created_at
from public.inventory_listings il
join public.chip_parts p on p.id = il.part_id
join public.manufacturers m on m.id = p.manufacturer_id
left join public.chip_packages pkg on pkg.id = p.package_id
left join public.company_private_profiles cpp on cpp.company_id = il.seller_company_id
where il.status = 'live';

create or replace function public.search_public_inventory(
  search_term text default null,
  limit_count integer default 50
)
returns table (
  inventory_listing_id uuid,
  standard_part_number text,
  brand text,
  package_type text,
  description text,
  available_quantity numeric,
  moq numeric,
  date_code text,
  lot_code text,
  currency text,
  display_price_min numeric,
  display_price_max numeric,
  masked_price text,
  seller_credit_score integer,
  supports_escrow boolean,
  is_promoted boolean,
  promoted_until timestamptz,
  warehouse_country_code text,
  warehouse_city text,
  sync_freshness_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.inventory_listing_id,
    v.standard_part_number,
    v.brand,
    v.package_type,
    v.description,
    v.available_quantity,
    v.moq,
    v.date_code,
    v.lot_code,
    v.currency,
    v.display_price_min,
    v.display_price_max,
    v.masked_price,
    v.seller_credit_score,
    v.supports_escrow,
    v.is_promoted,
    v.promoted_until,
    v.warehouse_country_code,
    v.warehouse_city,
    v.sync_freshness_at,
    v.created_at
  from public.public_inventory_search v
  where
    coalesce(search_term, '') = ''
    or v.standard_part_number ilike '%' || search_term || '%'
    or v.brand ilike '%' || search_term || '%'
    or coalesce(v.package_type, '') ilike '%' || search_term || '%'
    or exists (
      select 1
      from public.chip_part_aliases a
      where a.part_id = v.part_id
        and (
          a.alias_text ilike '%' || search_term || '%'
          or a.normalized_alias = regexp_replace(upper(search_term), '[^A-Z0-9+]', '', 'g')
        )
    )
  order by v.is_promoted desc, v.promoted_until desc nulls last, v.sync_freshness_at desc nulls last, v.created_at desc
  limit least(greatest(coalesce(limit_count, 50), 1), 100)
$$;

create or replace function public.unlock_inventory_contact(
  p_target_inventory_id uuid,
  p_requester_company_id uuid
)
returns table (
  inventory_listing_id uuid,
  seller_company_id uuid,
  seller_company_name text,
  contact_person text,
  phone_number text,
  wechat_id text,
  seller_credit_score integer,
  points_spent bigint,
  remaining_points bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user uuid := auth.uid();
  v_seller_company_id uuid;
  v_company_name text;
  v_contact public.company_private_profiles%rowtype;
  v_points_cost bigint := 50;
  v_balance bigint := 0;
  v_existing_unlock public.inventory_contact_unlocks%rowtype;
begin
  if v_auth_user is null then
    raise exception 'Authentication required';
  end if;

  if p_target_inventory_id is null then
    raise exception 'p_target_inventory_id is required';
  end if;

  if p_requester_company_id is null then
    raise exception 'p_requester_company_id is required';
  end if;

  if not (p_requester_company_id = any(public.current_company_ids())) then
    raise exception 'Not authorized for requester company';
  end if;

  select il.seller_company_id
  into v_seller_company_id
  from public.inventory_listings il
  where il.id = p_target_inventory_id
    and il.status = 'live';

  if v_seller_company_id is null then
    raise exception 'Inventory not found or not live';
  end if;

  if v_seller_company_id = p_requester_company_id then
    raise exception 'Cannot unlock your own inventory contact';
  end if;

  select c.display_name
  into v_company_name
  from public.companies c
  where c.id = v_seller_company_id;

  select *
  into v_contact
  from public.company_private_profiles cpp
  where cpp.company_id = v_seller_company_id;

  if not found then
    raise exception 'Seller contact profile is not configured';
  end if;

  insert into public.points_accounts (company_id, balance)
  values (p_requester_company_id, 0)
  on conflict (company_id) do nothing;

  perform 1
  from public.points_accounts pa
  where pa.company_id = p_requester_company_id
  for update;

  select *
  into v_existing_unlock
  from public.inventory_contact_unlocks icu
  where icu.inventory_listing_id = p_target_inventory_id
    and icu.requester_company_id = p_requester_company_id;

  if not found then
    select pa.balance
    into v_balance
    from public.points_accounts pa
    where pa.company_id = p_requester_company_id;

    if coalesce(v_balance, 0) < v_points_cost then
      raise exception 'Insufficient points balance';
    end if;

    insert into public.inventory_contact_unlocks (
      inventory_listing_id,
      requester_company_id,
      unlocked_by,
      points_spent
    )
    values (
      p_target_inventory_id,
      p_requester_company_id,
      v_auth_user,
      v_points_cost
    )
    returning *
    into v_existing_unlock;

    insert into public.points_ledger (
      company_id,
      event_type,
      delta,
      reference_table,
      reference_id,
      metadata,
      created_by
    )
    values (
      p_requester_company_id,
      'contact_reveal_spend',
      -v_points_cost,
      'inventory_listings',
      p_target_inventory_id,
      jsonb_build_object(
        'seller_company_id', v_seller_company_id,
        'unlocked_by', v_auth_user
      ),
      v_auth_user
    );
  end if;

  select pa.balance
  into v_balance
  from public.points_accounts pa
  where pa.company_id = p_requester_company_id;

  return query
  select
    p_target_inventory_id,
    v_seller_company_id,
    v_company_name,
    v_contact.contact_person,
    v_contact.phone_number,
    v_contact.wechat_id,
    v_contact.credit_score,
    coalesce(v_existing_unlock.points_spent, 0),
    coalesce(v_balance, 0);
end;
$$;
