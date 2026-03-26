create table if not exists public.admin_ai_provider_configs (
  provider text primary key check (provider in ('gemini', 'workers-ai')),
  display_name text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  request_mode text not null default 'api-key' check (request_mode in ('api-key', 'binding', 'rest')),
  model text not null,
  base_url text,
  api_key_ciphertext text,
  api_key_hint text,
  api_token_ciphertext text,
  api_token_hint text,
  account_id text,
  metadata jsonb not null default '{}'::jsonb,
  updated_by text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger admin_ai_provider_configs_set_updated_at
before update on public.admin_ai_provider_configs
for each row execute function public.set_updated_at();

alter table public.admin_ai_provider_configs enable row level security;

insert into public.admin_ai_provider_configs (
  provider,
  display_name,
  enabled,
  priority,
  request_mode,
  model,
  base_url,
  metadata,
  updated_by
)
values
  (
    'gemini',
    'Gemini',
    true,
    10,
    'api-key',
    'gemini-1.5-flash',
    'https://generativelanguage.googleapis.com/v1beta',
    jsonb_build_object('seeded', true),
    'migration-seed'
  ),
  (
    'workers-ai',
    'Cloudflare Workers AI',
    true,
    20,
    'binding',
    '@cf/meta/llama-3.1-8b-instruct-fast',
    'https://api.cloudflare.com/client/v4',
    jsonb_build_object('seeded', true),
    'migration-seed'
  )
on conflict (provider) do nothing;
