create table if not exists public.admin_ai_config_audit_logs (
  id bigserial primary key,
  provider text not null check (provider in ('gemini', 'workers-ai')),
  action text not null check (action in ('save', 'test')),
  outcome text not null check (outcome in ('success', 'failure')),
  operator_name text,
  change_note text,
  config_snapshot jsonb not null default '{}'::jsonb,
  message text,
  latency_ms integer,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_ai_config_audit_logs_provider_created_at_idx
  on public.admin_ai_config_audit_logs (provider, created_at desc, id desc);

create index if not exists admin_ai_config_audit_logs_created_at_idx
  on public.admin_ai_config_audit_logs (created_at desc, id desc);

alter table public.admin_ai_config_audit_logs enable row level security;
