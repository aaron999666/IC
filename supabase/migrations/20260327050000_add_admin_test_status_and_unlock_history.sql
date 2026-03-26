alter table public.admin_ai_provider_configs
  add column if not exists last_test_status text check (last_test_status in ('success', 'failure')),
  add column if not exists last_test_message text,
  add column if not exists last_test_latency_ms integer,
  add column if not exists last_tested_at timestamptz;

create or replace function public.list_unlocked_inventory_contacts(
  p_requester_company_id uuid,
  limit_count integer default 20
)
returns table (
  unlock_id uuid,
  inventory_listing_id uuid,
  standard_part_number text,
  brand text,
  package_type text,
  seller_company_name text,
  contact_person text,
  phone_number text,
  wechat_id text,
  seller_credit_score integer,
  points_spent bigint,
  unlocked_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    icu.id as unlock_id,
    icu.inventory_listing_id,
    p.full_part_number as standard_part_number,
    m.name as brand,
    pkg.code as package_type,
    c.display_name as seller_company_name,
    cpp.contact_person,
    cpp.phone_number,
    cpp.wechat_id,
    cpp.credit_score as seller_credit_score,
    icu.points_spent,
    icu.created_at as unlocked_at
  from public.inventory_contact_unlocks icu
  join public.inventory_listings il on il.id = icu.inventory_listing_id
  join public.companies c on c.id = il.seller_company_id
  join public.company_private_profiles cpp on cpp.company_id = il.seller_company_id
  join public.chip_parts p on p.id = il.part_id
  join public.manufacturers m on m.id = p.manufacturer_id
  left join public.chip_packages pkg on pkg.id = p.package_id
  where icu.requester_company_id = p_requester_company_id
    and p_requester_company_id = any(public.current_company_ids())
  order by icu.created_at desc
  limit least(greatest(coalesce(limit_count, 20), 1), 100)
$$;
