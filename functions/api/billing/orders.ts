import {
  badRequest,
  buildCheckoutUrl,
  createServiceClient,
  forbidden,
  getCompanySession,
  jsonResponse,
  onRequestOptions,
  requireFinanceMembership,
  unauthorized,
  type BillingEnv,
} from './shared'

interface PagesFunctionContext<TEnv> {
  request: Request
  env: TEnv
}

type RechargeOrderRow = {
  id: string
  order_no: string
  checkout_token: string
  status: string
  amount_cny: string | number
  points_amount: string | number
  bonus_points: string | number
  total_points: string | number
  currency: string
  payment_channel: string | null
  external_order_no: string | null
  external_trade_no: string | null
  note: string | null
  paid_amount_cny: string | number | null
  paid_at: string | null
  credited_at: string | null
  expires_at: string | null
  created_at: string
  requested_by: string | null
}

type CreateRechargeOrderBody = {
  companyId?: string
  amountCny?: number
  paymentChannel?: string
  note?: string
}

function normalizeAmount(value: unknown) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN

  if (!Number.isFinite(parsed)) {
    return null
  }

  const rounded = Math.round(parsed * 100) / 100
  return rounded > 0 ? rounded : null
}

function mapOrder(row: RechargeOrderRow, env: BillingEnv) {
  return {
    id: row.id,
    order_no: row.order_no,
    status: row.status,
    amount_cny: Number(row.amount_cny),
    points_amount: Number(row.points_amount),
    bonus_points: Number(row.bonus_points),
    total_points: Number(row.total_points),
    currency: row.currency,
    payment_channel: row.payment_channel,
    payment_url: buildCheckoutUrl(env, row.checkout_token),
    external_order_no: row.external_order_no,
    external_trade_no: row.external_trade_no,
    note: row.note,
    paid_amount_cny: row.paid_amount_cny === null ? null : Number(row.paid_amount_cny),
    paid_at: row.paid_at,
    credited_at: row.credited_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
    requested_by: row.requested_by,
  }
}

export { onRequestOptions }

export async function onRequestGet(context: PagesFunctionContext<BillingEnv>) {
  const { request, env } = context
  const session = await getCompanySession(request, env)

  if (!session) {
    return unauthorized('Sign in with Supabase Auth before loading recharge orders.')
  }

  const url = new URL(request.url)
  const companyId = url.searchParams.get('companyId')?.trim() ?? ''
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '12', 10) || 12, 1), 30)

  if (!companyId) {
    return badRequest('`companyId` query parameter is required.')
  }

  const membershipCheck = requireFinanceMembership(session, companyId)
  if (!membershipCheck.ok) {
    return forbidden(membershipCheck.message)
  }

  try {
    const supabase = createServiceClient(env)
    const { data, error } = await supabase
      .from('recharge_orders')
      .select('id, order_no, checkout_token, status, amount_cny, points_amount, bonus_points, total_points, currency, payment_channel, external_order_no, external_trade_no, note, paid_amount_cny, paid_at, credited_at, expires_at, created_at, requested_by')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return jsonResponse({
      orders: ((data ?? []) as RechargeOrderRow[]).map((row) => mapOrder(row, env)),
    })
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Failed to load recharge orders.',
      },
      500,
    )
  }
}

export async function onRequestPost(context: PagesFunctionContext<BillingEnv>) {
  const { request, env } = context
  const session = await getCompanySession(request, env)

  if (!session) {
    return unauthorized('Sign in with Supabase Auth before creating a recharge order.')
  }

  const body = (await request.json().catch(() => null)) as CreateRechargeOrderBody | null
  const companyId = body?.companyId?.trim() ?? ''
  const paymentChannel = body?.paymentChannel?.trim() || 'alipay_qr'
  const note = body?.note?.trim() || null
  const amountCny = normalizeAmount(body?.amountCny)

  if (!companyId) {
    return badRequest('`companyId` is required.')
  }

  const membershipCheck = requireFinanceMembership(session, companyId)
  if (!membershipCheck.ok) {
    return forbidden(membershipCheck.message)
  }

  if (amountCny === null) {
    return badRequest('`amountCny` must be a positive number.')
  }

  if (amountCny < 10) {
    return badRequest('Recharge amount must be at least 10 CNY.')
  }

  const pointsAmount = Math.round(amountCny * 10)
  if (pointsAmount <= 0) {
    return badRequest('Recharge amount is too small to convert into points.')
  }

  try {
    const supabase = createServiceClient(env)
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('recharge_orders')
      .insert({
        company_id: companyId,
        requested_by: session.userId,
        amount_cny: amountCny,
        points_amount: pointsAmount,
        bonus_points: 0,
        payment_channel: paymentChannel,
        note,
        expires_at: expiresAt,
      })
      .select('id, order_no, checkout_token, status, amount_cny, points_amount, bonus_points, total_points, currency, payment_channel, external_order_no, external_trade_no, note, paid_amount_cny, paid_at, credited_at, expires_at, created_at, requested_by')
      .single()

    if (error || !data) {
      throw error ?? new Error('Recharge order creation did not return a row.')
    }

    return jsonResponse(
      {
        order: mapOrder(data as RechargeOrderRow, env),
      },
      201,
    )
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Failed to create recharge order.',
      },
      500,
    )
  }
}
