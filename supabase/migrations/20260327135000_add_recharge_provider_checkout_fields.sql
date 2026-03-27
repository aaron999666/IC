alter table public.recharge_orders
  add column if not exists provider_checkout_url text,
  add column if not exists provider_checkout_qr_code text,
  add column if not exists provider_checkout_payload jsonb not null default '{}'::jsonb,
  add column if not exists provider_checkout_generated_at timestamptz;
