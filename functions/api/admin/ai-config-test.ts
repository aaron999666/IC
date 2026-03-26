import {
  AiConfigValidationError,
  buildAiConfigAuditSnapshot,
  buildAiConfigAuditSnapshotFromPayload,
  getAdminAiProviderConfigs,
  listAdminAiConfigAuditLogs,
  recordAiConfigAuditEvent,
  resolveDraftRuntimeAiProviderConfig,
  updateAdminAiProviderTestStatus,
  type AiConfigEnv,
  type AiProvider,
  type AiRequestMode,
} from '../ai-config-store'
import { getAdminSession } from './auth'
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
  const adminSession = await getAdminSession(request, env)

  if (!adminSession) {
    return {
      failure: jsonResponse(
        {
          error: 'Unauthorized. Sign in with a Supabase user that has owner, admin or ops role.',
        },
        401,
      ),
      adminSession: null,
    }
  }

  return {
    failure: null,
    adminSession,
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export async function onRequestPost(context: PagesFunctionContext<AiConfigEnv>) {
  const authorization = await ensureAdminAuthorized(context.request, context.env)
  if (authorization.failure) {
    return authorization.failure
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
    await updateAdminAiProviderTestStatus(
      context.env,
      body.provider,
      'success',
      result.message,
      result.latency_ms,
      result.tested_at,
    )

    try {
      await recordAiConfigAuditEvent(context.env, {
        provider: body.provider,
        action: 'test',
        outcome: 'success',
        operatorName: authorization.adminSession.operatorName,
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
      configs: await getAdminAiProviderConfigs(context.env).catch(() => []),
      auditLogs: await listAdminAiConfigAuditLogs(context.env, 24).catch(() => []),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI provider health check failed.'

    await updateAdminAiProviderTestStatus(
      context.env,
      body.provider,
      'failure',
      message,
      null,
      new Date().toISOString(),
    ).catch(() => undefined)

    try {
      await recordAiConfigAuditEvent(context.env, {
        provider: body.provider,
        action: 'test',
        outcome: 'failure',
        operatorName: authorization.adminSession.operatorName,
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
        configs: await getAdminAiProviderConfigs(context.env).catch(() => []),
        auditLogs: await listAdminAiConfigAuditLogs(context.env, 24).catch(() => []),
      },
      error instanceof AiConfigValidationError ? 400 : 502,
    )
  }
}
