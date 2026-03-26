import {
  AiConfigValidationError,
  buildAiConfigAuditSnapshot,
  buildAiConfigAuditSnapshotFromPayload,
  isAuthorizedAdminRequest,
  listAdminAiConfigAuditLogs,
  recordAiConfigAuditEvent,
  resolveDraftRuntimeAiProviderConfig,
  type AiConfigEnv,
  type AiProvider,
  type AiRequestMode,
} from '../ai-config-store'
import { runAiProviderHealthCheck } from './ai-provider-health'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PagesFunctionContext<TEnv> {
  request: Request
  env: TEnv
}

interface TestRequestBody {
  provider?: AiProvider
  displayName?: string
  enabled?: boolean
  priority?: number
  requestMode?: AiRequestMode
  model?: string
  baseUrl?: string | null
  accountId?: string | null
  apiKey?: string
  clearApiKey?: boolean
  apiToken?: string
  clearApiToken?: boolean
  operatorName?: string | null
  changeNote?: string | null
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

async function ensureAdminAuthorized(request: Request, env: AiConfigEnv) {
  const authorized = await isAuthorizedAdminRequest(request, env)

  if (!authorized) {
    return jsonResponse(
      {
        error: 'Unauthorized. Provide a valid admin bearer token.',
      },
      401,
    )
  }

  return null
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export async function onRequestPost(context: PagesFunctionContext<AiConfigEnv>) {
  const authFailure = await ensureAdminAuthorized(context.request, context.env)
  if (authFailure) {
    return authFailure
  }

  const body = (await context.request.json().catch(() => null)) as TestRequestBody | null

  if (!body?.provider) {
    return jsonResponse({ error: '`provider` is required.' }, 400)
  }

  if (body.provider !== 'gemini' && body.provider !== 'workers-ai') {
    return jsonResponse({ error: '`provider` must be either `gemini` or `workers-ai`.' }, 400)
  }

  try {
    const runtimeConfig = await resolveDraftRuntimeAiProviderConfig(context.env, {
      provider: body.provider,
      displayName: body.displayName,
      enabled: body.enabled,
      priority: body.priority,
      requestMode: body.requestMode,
      model: body.model,
      baseUrl: body.baseUrl,
      accountId: body.accountId,
      apiKey: body.apiKey,
      clearApiKey: body.clearApiKey,
      apiToken: body.apiToken,
      clearApiToken: body.clearApiToken,
    })

    const result = await runAiProviderHealthCheck(context.env, runtimeConfig)

    try {
      await recordAiConfigAuditEvent(context.env, {
        provider: body.provider,
        action: 'test',
        outcome: 'success',
        operatorName: body.operatorName,
        changeNote: body.changeNote,
        configSnapshot: buildAiConfigAuditSnapshot(runtimeConfig),
        message: result.message,
        latencyMs: result.latency_ms,
      })
    } catch {
      // Connectivity test should still return its result even if audit persistence fails.
    }

    return jsonResponse({
      ok: true,
      result,
      auditLogs: await listAdminAiConfigAuditLogs(context.env, 24).catch(() => []),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI provider health check failed.'

    try {
      await recordAiConfigAuditEvent(context.env, {
        provider: body.provider,
        action: 'test',
        outcome: 'failure',
        operatorName: body.operatorName,
        changeNote: body.changeNote,
        configSnapshot: buildAiConfigAuditSnapshotFromPayload({
          provider: body.provider,
          displayName: body.displayName,
          enabled: body.enabled,
          priority: body.priority,
          requestMode: body.requestMode,
          model: body.model,
          baseUrl: body.baseUrl,
          accountId: body.accountId,
          apiKey: body.apiKey,
          clearApiKey: body.clearApiKey,
          apiToken: body.apiToken,
          clearApiToken: body.clearApiToken,
        }),
        message,
      })
    } catch {
      // Best effort only.
    }

    return jsonResponse(
      {
        error: message,
        auditLogs: await listAdminAiConfigAuditLogs(context.env, 24).catch(() => []),
      },
      error instanceof AiConfigValidationError ? 400 : 502,
    )
  }
}
