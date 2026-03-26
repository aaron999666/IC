import { createClient } from '@supabase/supabase-js'
import type { AiConfigEnv } from '../ai-config-store'

type CompanyRole = 'owner' | 'admin' | 'buyer' | 'seller' | 'finance' | 'ops'

type AdminMembershipRow = {
  company_id: string
  role: CompanyRole
}

export interface AdminSession {
  userId: string
  email: string | null
  operatorName: string
  companyIds: string[]
  roles: CompanyRole[]
}

const DEFAULT_ADMIN_ROLES: CompanyRole[] = ['owner', 'admin', 'ops']

function getAllowedAdminRoles(env: AiConfigEnv) {
  const raw = env.SUPABASE_ADMIN_ROLES?.trim()
  if (!raw) {
    return DEFAULT_ADMIN_ROLES
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as CompanyRole[]
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('Authorization') ?? ''
  return authorization.replace(/^Bearer\s+/i, '').trim()
}

function buildOperatorName(email: string | null, metadata: Record<string, unknown> | undefined, userId: string) {
  const fullName = typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : ''
  const displayName = typeof metadata?.display_name === 'string' ? metadata.display_name.trim() : ''

  return fullName || displayName || email || userId
}

export async function getAdminSession(request: Request, env: AiConfigEnv): Promise<AdminSession | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service configuration is required for admin authorization.')
  }

  const accessToken = getBearerToken(request)
  if (!accessToken) {
    return null
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken)

  if (userError || !user) {
    return null
  }

  const allowedRoles = getAllowedAdminRoles(env)
  const { data: memberships, error: membershipError } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .in('role', allowedRoles)

  if (membershipError) {
    throw membershipError
  }

  const activeMemberships = (memberships ?? []) as AdminMembershipRow[]
  if (activeMemberships.length === 0) {
    return null
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    operatorName: buildOperatorName(user.email ?? null, user.user_metadata, user.id),
    companyIds: activeMemberships.map((membership) => membership.company_id),
    roles: activeMemberships.map((membership) => membership.role),
  }
}
