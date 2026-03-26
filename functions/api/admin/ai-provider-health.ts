import type {
  AiConfigEnv,
  RuntimeAiProviderConfig,
} from '../ai-config-store'

interface GeminiCandidate {
  content?: {
    parts?: Array<{
      text?: string
    }>
  }
}

interface GeminiResponsePayload {
  candidates?: GeminiCandidate[]
  error?: {
    message?: string
  }
}

interface WorkersAIResponsePayload {
  response?: unknown
  result?: {
    response?: unknown
  }
}

export interface AiProviderHealthCheckResult {
  provider: RuntimeAiProviderConfig['provider']
  model: string
  request_mode: RuntimeAiProviderConfig['request_mode']
  source: RuntimeAiProviderConfig['source']
  latency_ms: number
  message: string
  tested_at: string
}

function normalizeMessage(value: string, fallback: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 180) : fallback
}

function extractGeminiText(payload: GeminiResponsePayload) {
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim()

  if (text) {
    return text
  }

  throw new Error(payload.error?.message ?? 'Gemini did not return text content.')
}

function extractWorkersAiText(payload: unknown) {
  const result = payload as WorkersAIResponsePayload | string | Record<string, unknown>

  if (typeof result === 'string') {
    return result.trim()
  }

  const response = result?.response ?? result?.result?.response

  if (typeof response === 'string') {
    return response.trim()
  }

  if (response !== undefined) {
    return JSON.stringify(response)
  }

  return JSON.stringify(result)
}

async function testGemini(config: RuntimeAiProviderConfig) {
  if (!config.api_key) {
    throw new Error('Gemini API key is missing.')
  }

  const response = await fetch(`${(config.base_url ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '')}/models/${config.model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.api_key,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Reply with OK only.' }],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8,
      },
    }),
  })

  const payload = (await response.json().catch(() => null)) as GeminiResponsePayload | null

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Gemini request failed with ${response.status}`)
  }

  return normalizeMessage(extractGeminiText(payload ?? {}), 'Gemini health check succeeded.')
}

function buildWorkersRequestPayload() {
  return {
    messages: [{ role: 'user', content: 'Reply with OK only.' }],
    max_tokens: 8,
    temperature: 0,
  }
}

async function testWorkersAi(env: AiConfigEnv, config: RuntimeAiProviderConfig) {
  const payload = buildWorkersRequestPayload()

  if (config.request_mode === 'binding') {
    if (!env.AI) {
      throw new Error('Cloudflare AI binding is missing.')
    }

    const result = await env.AI.run(config.model, payload)
    return normalizeMessage(extractWorkersAiText(result), 'Workers AI binding health check succeeded.')
  }

  if (!config.account_id || !config.api_token) {
    throw new Error('Workers AI REST mode requires both account ID and API token.')
  }

  const endpoint = `${(config.base_url ?? 'https://api.cloudflare.com/client/v4').replace(/\/$/, '')}/accounts/${config.account_id}/ai/run/${config.model.replace(/^\/+/, '')}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.api_token}`,
    },
    body: JSON.stringify(payload),
  })

  const result = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      result && typeof result === 'object' && 'errors' in result
        ? JSON.stringify((result as { errors?: unknown }).errors)
        : `Workers AI request failed with ${response.status}`

    throw new Error(message)
  }

  return normalizeMessage(extractWorkersAiText(result), 'Workers AI REST health check succeeded.')
}

export async function runAiProviderHealthCheck(env: AiConfigEnv, config: RuntimeAiProviderConfig): Promise<AiProviderHealthCheckResult> {
  const startedAt = Date.now()
  const message =
    config.provider === 'gemini'
      ? await testGemini(config)
      : await testWorkersAi(env, config)

  return {
    provider: config.provider,
    model: config.model,
    request_mode: config.request_mode,
    source: config.source,
    latency_ms: Date.now() - startedAt,
    message,
    tested_at: new Date().toISOString(),
  }
}
