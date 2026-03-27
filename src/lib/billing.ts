import type { CompanyMembership, RechargeOrder } from '../types'

type RechargeOrderPayload = {
  companyId: string
  amountCny: number
  paymentChannel: string
  note?: string
}

type RechargeOrderListResponse = {
  orders?: RechargeOrder[]
  error?: string
}

type RechargeOrderCreateResponse = {
  order?: RechargeOrder
  error?: string
}

export const BILLING_PORTAL_URL =
  import.meta.env.VITE_BILLING_PORTAL_URL?.trim() || 'https://pay.iccorehub.com'

export const FINANCE_ROLES: CompanyMembership['role'][] = ['owner', 'admin', 'finance', 'ops']

export const RECHARGE_PACKAGES = [
  { amountCny: 100, label: '100 CNY', note: '1000 积分，适合零星解锁与小批量 BOM 解析' },
  { amountCny: 300, label: '300 CNY', note: '3000 积分，适合持续询价与每日找货' },
  { amountCny: 1000, label: '1000 CNY', note: '10000 积分，适合团队高频搜索与采购协同' },
] as const

function buildAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  }
}

export function isInsufficientPointsMessage(message: string | null | undefined) {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('insufficient points') || normalized.includes('积分不足')
}

export function canManageBilling(role: CompanyMembership['role'] | null | undefined) {
  return Boolean(role && FINANCE_ROLES.includes(role))
}

export function formatMoneyCny(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export async function listRechargeOrders(accessToken: string, companyId: string, limit = 12) {
  const params = new URLSearchParams({
    companyId,
    limit: `${limit}`,
  })

  const response = await fetch(`/api/billing/orders?${params.toString()}`, {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })

  const payload = (await response.json().catch(() => null)) as RechargeOrderListResponse | null

  if (!response.ok || !payload?.orders) {
    throw new Error(payload?.error ?? 'Failed to load recharge orders.')
  }

  return payload.orders
}

export async function createRechargeOrder(accessToken: string, body: RechargeOrderPayload) {
  const response = await fetch('/api/billing/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as RechargeOrderCreateResponse | null

  if (!response.ok || !payload?.order) {
    throw new Error(payload?.error ?? 'Failed to create recharge order.')
  }

  return payload.order
}
