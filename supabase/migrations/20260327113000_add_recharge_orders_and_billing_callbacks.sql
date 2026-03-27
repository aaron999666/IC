alter type public.points_event_type add value if not exists 'recharge_topup';

create type public.recharge_order_status as enum (
  'pending',
  'processing',
  'paid',
  'cancelled',
  'expired',
  'failed'
);

create or replace function public.generate_recharge_order_no()
returns text
language plpgsql
as $$
begin
  return
    'RCH'
    || to_char(timezone('Asia/Shanghai', now()), 'YYYYMMDDHH24MISS')
    || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));
end;
$$;

create table public.recharge_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default public.generate_recharge_order_no(),
  checkout_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  company_id uuid not null references public.companies(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  status public.recharge_order_status not null default 'pending',
  amount_cny numeric(12, 2) not null check (amount_cny > 0),
  points_amount bigint not null check (points_amount > 0),
  bonus_points bigint not null default 0 check (bonus_points >= 0),
  total_points bigint generated always as (points_amount + bonus_points) stored,
  currency text not null default 'CNY',
  payment_channel text,
  external_order_no text,
  external_trade_no text,
  note text,
  paid_amount_cny numeric(12, 2),
  last_callback_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  paid_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index recharge_orders_company_status_created_idx
  on public.recharge_orders (company_id, status, created_at desc);

create unique index recharge_orders_external_trade_no_unique_idx
  on public.recharge_orders (external_trade_no)
  where external_trade_no is not null;

create table public.billing_callback_logs (
  id uuid primary key default gen_random_uuid(),
  recharge_order_id uuid not null references public.recharge_orders(id) on delete cascade,
  order_no text not null,
  source text not null default 'domestic_gateway',
  next_status public.recharge_order_status not null,
  external_order_no text,
  external_trade_no text,
  paid_amount_cny numeric(12, 2),
  payment_channel text,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  message text,
  created_at timestamptz not null default timezone('utc', now())
);

create index billing_callback_logs_order_created_idx
  on public.billing_callback_logs (recharge_order_id, created_at desc);

create trigger recharge_orders_set_updated_at
before update on public.recharge_orders
for each row execute function public.set_updated_at();

create or replace function public.sync_recharge_order_status(
  p_order_no text,
  p_next_status public.recharge_order_status,
  p_external_trade_no text default null,
  p_external_order_no text default null,
  p_paid_amount_cny numeric default null,
  p_payment_channel text default null,
  p_callback_payload jsonb default '{}'::jsonb,
  p_source text default 'domestic_gateway',
  p_message text default null
)
returns table (
  order_id uuid,
  company_id uuid,
  order_no text,
  status public.recharge_order_status,
  total_points bigint,
  points_balance bigint,
  credited boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.recharge_orders%rowtype;
  v_log_id uuid;
  v_balance bigint := 0;
  v_credited boolean := false;
begin
  if coalesce(trim(p_order_no), '') = '' then
    raise exception 'p_order_no is required';
  end if;

  select *
  into v_order
  from public.recharge_orders ro
  where ro.order_no = p_order_no
  for update;

  if not found then
    raise exception 'Recharge order not found';
  end if;

  insert into public.billing_callback_logs (
    recharge_order_id,
    order_no,
    source,
    next_status,
    external_order_no,
    external_trade_no,
    paid_amount_cny,
    payment_channel,
    payload,
    message
  )
  values (
    v_order.id,
    v_order.order_no,
    coalesce(nullif(trim(p_source), ''), 'domestic_gateway'),
    p_next_status,
    p_external_order_no,
    p_external_trade_no,
    p_paid_amount_cny,
    p_payment_channel,
    coalesce(p_callback_payload, '{}'::jsonb),
    p_message
  )
  returning id into v_log_id;

  if p_next_status = 'paid' then
    if p_paid_amount_cny is not null and p_paid_amount_cny < v_order.amount_cny then
      update public.billing_callback_logs
      set message = coalesce(message || ' · ', '') || 'Paid amount below order amount'
      where id = v_log_id;

      raise exception 'Paid amount does not cover order amount';
    end if;

    if v_order.status <> 'paid' then
      update public.recharge_orders
      set
        status = 'paid',
        external_trade_no = coalesce(nullif(trim(p_external_trade_no), ''), external_trade_no),
        external_order_no = coalesce(nullif(trim(p_external_order_no), ''), external_order_no),
        payment_channel = coalesce(nullif(trim(p_payment_channel), ''), payment_channel),
        paid_amount_cny = coalesce(p_paid_amount_cny, paid_amount_cny, amount_cny),
        paid_at = coalesce(paid_at, timezone('utc', now())),
        credited_at = coalesce(credited_at, timezone('utc', now())),
        last_callback_payload = coalesce(p_callback_payload, '{}'::jsonb)
      where id = v_order.id;

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
        v_order.company_id,
        'recharge_topup',
        v_order.total_points,
        'recharge_orders',
        v_order.id,
        jsonb_build_object(
          'order_no', v_order.order_no,
          'payment_channel', coalesce(nullif(trim(p_payment_channel), ''), v_order.payment_channel),
          'external_order_no', p_external_order_no,
          'external_trade_no', p_external_trade_no,
          'paid_amount_cny', coalesce(p_paid_amount_cny, v_order.amount_cny),
          'source', coalesce(nullif(trim(p_source), ''), 'domestic_gateway')
        ),
        v_order.requested_by
      );

      v_credited := true;
    end if;
  else
    if v_order.status <> 'paid' and v_order.status <> p_next_status then
      update public.recharge_orders
      set
        status = p_next_status,
        external_trade_no = coalesce(nullif(trim(p_external_trade_no), ''), external_trade_no),
        external_order_no = coalesce(nullif(trim(p_external_order_no), ''), external_order_no),
        payment_channel = coalesce(nullif(trim(p_payment_channel), ''), payment_channel),
        last_callback_payload = coalesce(p_callback_payload, '{}'::jsonb),
        expires_at = case
          when p_next_status = 'expired' then coalesce(expires_at, timezone('utc', now()))
          else expires_at
        end
      where id = v_order.id;
    end if;
  end if;

  update public.billing_callback_logs
  set
    processed = true,
    message = coalesce(
      message,
      case when v_credited then 'Points credited' else 'Status synchronized' end
    )
  where id = v_log_id;

  select *
  into v_order
  from public.recharge_orders ro
  where ro.id = v_order.id;

  select pa.balance
  into v_balance
  from public.points_accounts pa
  where pa.company_id = v_order.company_id;

  return query
  select
    v_order.id,
    v_order.company_id,
    v_order.order_no,
    v_order.status,
    v_order.total_points,
    coalesce(v_balance, 0),
    v_credited;
end;
$$;

alter table public.recharge_orders enable row level security;
alter table public.billing_callback_logs enable row level security;

create policy "Finance roles can view own recharge orders"
on public.recharge_orders
for select
using (
  exists (
    select 1
    from public.company_members cm
    where cm.company_id = recharge_orders.company_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
      and cm.role in ('owner', 'admin', 'finance', 'ops')
  )
);
