import type {
  AdminAiConfigAuditLog,
  AdminAiConfigConsoleResponse,
  AdminAiProviderTestResult,
} from '../types'

function buildAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  }
}

export async function loadAdminAiConsole(accessToken: string, limit = 24) {
  const response = await fetch(`/api/admin/ai-config?limit=${limit}`, {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })

  const payload = (await response.json().catch(() => null)) as
    | (AdminAiConfigConsoleResponse & { error?: string })
    | null

  if (!response.ok || !payload?.configs) {
    throw new Error(payload?.error ?? 'Failed to load admin AI console.')
  }

  return payload
}

export async function saveAdminAiProviderConfig(accessToken: string, body: Record<string, unknown>) {
  const response = await fetch('/api/admin/ai-config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as
    | ({ ok?: boolean; error?: string } & AdminAiConfigConsoleResponse)
    | null

  if (!response.ok || !payload?.configs) {
    throw new Error(payload?.error ?? 'Failed to save admin AI provider config.')
  }

  return payload
}

export async function testAdminAiProviderConfig(accessToken: string, body: Record<string, unknown>) {
  const response = await fetch('/api/admin/ai-config-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean
        error?: string
        result?: AdminAiProviderTestResult
        configs?: AdminAiConfigConsoleResponse['configs']
        auditLogs?: AdminAiConfigAuditLog[]
      }
    | null

  if (!response.ok || !payload?.result) {
    throw new Error(payload?.error ?? 'Failed to test provider connectivity.')
  }

  return payload
}
