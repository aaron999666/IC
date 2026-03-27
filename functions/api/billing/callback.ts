import {
  badRequest,
  createServiceClient,
  jsonResponse,
  onRequestOptions,
  type BillingEnv,
} from './shared'
import { verifyBillingSignature } from './signature'

interface PagesFunctionContext<TEnv> {
  request: Request
  env: TEnv
}

type BillingCallbackBody = {
  orderNo?: string
  status?: 'pending' | 'processing' | 'paid' | 'cancelled' | 'expired' | 'failed'
  externalTradeNo?: string
  externalOrderNo?: string
  paidAmountCny?: number
  paymentChannel?: string
  source?: string
  message?: string
  payload?: unknown
}

type RpcResultRow = {
  order_id: string
  company_id: string
  order_no: string
  status: string
  total_points: number
  points_balance: number
  credited: boolean
}

function getWebhookSecret(request: Request) {
  return request.headers.get('X-ICCoreHub-Billing-Secret')?.trim() ?? ''
}

function getSignatureHeader(request: Request) {
  return request.headers.get('X-ICCoreHub-Billing-Signature')?.trim() ?? ''
}

function getTimestampHeader(request: Request) {
  return request.headers.get('X-ICCoreHub-Billing-Timestamp')?.trim() ?? ''
}

export { onRequestOptions }

export async function onRequestPost(context: PagesFunctionContext<BillingEnv>) {
  const { request, env } = context

  if (!env.BILLING_WEBHOOK_SECRET?.trim()) {
    return jsonResponse({ error: 'BILLING_WEBHOOK_SECRET is not configured.' }, 500)
  }

  const rawBody = await request.text()
  const hasSignedHeaders = Boolean(getTimestampHeader(request) && getSignatureHeader(request))

  if (hasSignedHeaders) {
    const verified = await verifyBillingSignature(
      env.BILLING_WEBHOOK_SECRET.trim(),
      getTimestampHeader(request),
      getSignatureHeader(request),
      rawBody,
    )

    if (!verified) {
      return jsonResponse({ error: 'Invalid billing callback signature.' }, 401)
    }
  } else if (getWebhookSecret(request) !== env.BILLING_WEBHOOK_SECRET.trim()) {
    return jsonResponse({ error: 'Invalid billing callback secret.' }, 401)
  }

  let body: BillingCallbackBody | null = null

  try {
    body = (JSON.parse(rawBody || 'null')) as BillingCallbackBody | null
  } catch {
    return badRequest('Billing callback body must be valid JSON.')
  }

  const orderNo = body?.orderNo?.trim() ?? ''
  const nextStatus = body?.status?.trim() ?? ''

  if (!orderNo) {
    return badRequest('`orderNo` is required.')
  }

  if (!nextStatus) {
    return badRequest('`status` is required.')
  }

  try {
    const supabase = createServiceClient(env)
    const { data, error } = await supabase.rpc('sync_recharge_order_status', {
      p_order_no: orderNo,
      p_next_status: nextStatus,
      p_external_trade_no: body?.externalTradeNo?.trim() || null,
      p_external_order_no: body?.externalOrderNo?.trim() || null,
      p_paid_amount_cny:
        typeof body?.paidAmountCny === 'number' && Number.isFinite(body.paidAmountCny)
          ? body.paidAmountCny
          : null,
      p_payment_channel: body?.paymentChannel?.trim() || null,
      p_callback_payload:
        body?.payload && typeof body.payload === 'object' ? body.payload : {},
      p_source: body?.source?.trim() || 'domestic_gateway',
      p_message: body?.message?.trim() || null,
    })

    if (error) {
      throw error
    }

    const row = (data?.[0] ?? null) as RpcResultRow | null
    if (!row) {
      throw new Error('Billing callback RPC returned no result.')
    }

    return jsonResponse({
      ok: true,
      order: row,
    })
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Failed to process billing callback.',
      },
      500,
    )
  }
}
