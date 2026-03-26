import {
  getAdminAiProviderConfigs,
  isAuthorizedAdminRequest,
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

export async function onRequestGet(context: PagesFunctionContext<AiConfigEnv>) {
  const authFailure = await ensureAdminAuthorized(context.request, context.env)
  if (authFailure) {
    return authFailure
  }

  try {
    const configs = await getAdminAiProviderConfigs(context.env)
    return jsonResponse({ configs })
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
    const configs = await upsertAdminAiProviderConfig(context.env, {
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
      updatedBy: body.updatedBy,
    })

    return jsonResponse({ ok: true, configs })
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Failed to save admin AI configuration.',
      },
      500,
    )
  }
}
