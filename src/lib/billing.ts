export const BILLING_PORTAL_URL =
  import.meta.env.VITE_BILLING_PORTAL_URL?.trim() || 'https://pay.iccorehub.com'

export function isInsufficientPointsMessage(message: string | null | undefined) {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('insufficient points') || normalized.includes('积分不足')
}
