import { createClient } from '@supabase/supabase-js'

type CompanyRole = 'owner' | 'admin' | 'buyer' | 'seller' | 'finance' | 'ops'

type MembershipRow = {
  company_id: string
  role: CompanyRole
  companies:
    | {
        display_name: string
      }
    | null
    | Array<{
        display_name: string
      }>
}

export interface BillingEnv {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  BILLING_PORTAL_URL?: string
  BILLING_WEBHOOK_SECRET?: string
}

export interface CompanySession {
  userId: string
  email: string | null
  operatorName: string
  memberships: Array<{
    companyId: string
    companyName: string
    role: CompanyRole
  }>
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ICCoreHub-Billing-Secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export const FINANCE_ROLES: CompanyRole[] = ['owner', 'admin', 'finance', 'ops']

function getBearerToken(request: Request) {
  const authorization = request.headers.get('Authorization') ?? ''
  return authorization.replace(/^Bearer\s+/i, '').trim()
}

function buildOperatorName(email: string | null, metadata: Record<string, unknown> | undefined, userId: string) {
  const fullName = typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : ''
  const displayName = typeof metadata?.display_name === 'string' ? metadata.display_name.trim() : ''

  return fullName || displayName || email || userId
}

function normalizeCompanyName(
  companies:
    | MembershipRow['companies']
    | undefined,
) {
  const company = Array.isArray(companies) ? companies[0] ?? null : companies
  return company?.display_name?.trim() || 'Unknown company'
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

export function badRequest(message: string) {
  return jsonResponse({ error: message }, 400)
}

export function unauthorized(message = 'Unauthorized') {
  return jsonResponse({ error: message }, 401)
}

export function forbidden(message = 'Forbidden') {
  return jsonResponse({ error: message }, 403)
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export function createServiceClient(env: BillingEnv) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service configuration is required for billing APIs.')
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export async function getCompanySession(request: Request, env: BillingEnv): Promise<CompanySession | null> {
  const accessToken = getBearerToken(request)
  if (!accessToken) {
    return null
  }

  const supabase = createServiceClient(env)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken)

  if (userError || !user) {
    return null
  }

  const { data, error } = await supabase
    .from('company_members')
    .select('company_id, role, companies(display_name)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (error) {
    throw error
  }

  const memberships = ((data ?? []) as MembershipRow[]).map((membership) => ({
    companyId: membership.company_id,
    companyName: normalizeCompanyName(membership.companies),
    role: membership.role,
  }))

  if (memberships.length === 0) {
    return null
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    operatorName: buildOperatorName(user.email ?? null, user.user_metadata, user.id),
    memberships,
  }
}

export function requireFinanceMembership(session: CompanySession, companyId: string) {
  const membership =
    session.memberships.find((item) => item.companyId === companyId) ?? null

  if (!membership) {
    return { ok: false, message: 'No active membership for the selected company.' } as const
  }

  if (!FINANCE_ROLES.includes(membership.role)) {
    return {
      ok: false,
      message: 'Billing access requires owner, admin, finance or ops role.',
    } as const
  }

  return { ok: true, membership } as const
}

export function buildCheckoutUrl(env: BillingEnv, checkoutToken: string) {
  const baseUrl = env.BILLING_PORTAL_URL?.trim() || 'https://pay.iccorehub.com'
  return `${baseUrl.replace(/\/$/, '')}/checkout?token=${encodeURIComponent(checkoutToken)}`
}
