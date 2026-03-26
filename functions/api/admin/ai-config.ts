import {
  AiConfigValidationError,
  buildAiConfigAuditSnapshot,
  buildAiConfigAuditSnapshotFromPayload,
  getAdminAiProviderConfigs,
  isAuthorizedAdminRequest,
  listAdminAiConfigAuditLogs,
  recordAiConfigAuditEvent,
  resolveDraftRuntimeAiProviderConfig,
  type AiConfigEnv,
  type AiProvider,
  type AiRequestMode,
  upsertAdminAiProviderConfig,
} from '../ai-config-store'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface PagesFunctionContext<TEnv> {
  request: Request
  env: TEnv
}

interface UpdateRequestBody {
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
  updatedBy?: string | null
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

function badRequest(message: string) {
  return jsonResponse({ error: message }, 400)
}

function parseAuditLimit(url: URL) {
  const parsed = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 24
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

async function loadConsoleData(env: AiConfigEnv, limit: number) {
  const [configs, auditLogs] = await Promise.all([
    getAdminAiProviderConfigs(env),
    listAdminAiConfigAuditLogs(env, limit),
  ])

  return { configs, auditLogs }
}

async function recordSaveAudit(
  env: AiConfigEnv,
  body: UpdateRequestBody,
  outcome: 'success' | 'failure',
  message: string,
) {
  if (!body.provider) {
    return
  }

  try {
    const snapshot =
      outcome === 'success'
        ? buildAiConfigAuditSnapshot(
            await resolveDraftRuntimeAiProviderConfig(env, {
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
          )
        : buildAiConfigAuditSnapshotFromPayload({
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

    await recordAiConfigAuditEvent(env, {
      provider: body.provider,
      action: 'save',
      outcome,
      operatorName: body.operatorName ?? body.updatedBy,
      changeNote: body.changeNote,
      configSnapshot: snapshot,
      message,
    })
  } catch {
    // Keep save flows resilient even if audit recording fails.
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export async function onRequestGet(context: PagesFunctionContext<AiConfigEnv>) {
  const authFailure = await ensureAdminAuthorized(context.request, context.env)
  if (authFailure) {
    return authFailure
  }

  try {
    const data = await loadConsoleData(context.env, parseAuditLimit(new URL(context.request.url)))
    return jsonResponse(data)
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Failed to load admin AI configuration.',
      },
      500,
    )
  }
}

export async function onRequestPost(context: PagesFunctionContext<AiConfigEnv>) {
  const authFailure = await ensureAdminAuthorized(context.request, context.env)
  if (authFailure) {
    return authFailure
  }

  const body = (await context.request.json().catch(() => null)) as UpdateRequestBody | null

  if (!body?.provider) {
    return badRequest('`provider` is required.')
  }

  if (body.provider !== 'gemini' && body.provider !== 'workers-ai') {
    return badRequest('`provider` must be either `gemini` or `workers-ai`.')
  }

  try {
    await upsertAdminAiProviderConfig(context.env, {
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
      updatedBy: body.operatorName ?? body.updatedBy,
    })

    await recordSaveAudit(context.env, body, 'success', 'Provider configuration saved successfully.')

    const data = await loadConsoleData(context.env, 24)
    return jsonResponse({ ok: true, ...data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save admin AI configuration.'
    await recordSaveAudit(context.env, body, 'failure', message)

    return jsonResponse(
      {
        error: message,
      },
      error instanceof AiConfigValidationError ? 400 : 500,
    )
  }
}
