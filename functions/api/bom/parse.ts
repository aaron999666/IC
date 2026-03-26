import {
  BOM_BRAND_ALIASES,
  BOM_OUTPUT_SCHEMA,
  BOM_PROMPT_VERSION,
  BOM_SYSTEM_PROMPT,
  type BomParsedItem,
} from './prompt'

interface AiBinding {
  run(model: string, input: unknown): Promise<unknown>
}

interface Env {
  AI?: AiBinding
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  GEMINI_BASE_URL?: string
  WORKERS_AI_MODEL?: string
  BOM_MAX_LINES?: string
  BOM_FREE_LINES?: string
}

interface PagesFunctionContext<TEnv> {
  request: Request
  env: TEnv
}

interface BomParseRequest {
  text?: string
}

interface ProviderAttempt {
  provider: 'gemini' | 'workers-ai'
  model: string
  ok: boolean
  error?: string
}

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function parseIntegerSetting(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function cleanSourceText(text: string) {
  return text.replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n').trim()
}

function normalizePartNumber(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const cleaned = value
    .toUpperCase()
    .replace(/[\u4E00-\u9FFF]/g, '')
    .replace(/[\s，,。；;：:【】（）()]/g, '')
    .replace(/[*#@'"`~!$%^&_=|<>?]/g, '')
    .replace(/[^A-Z0-9+\-/]/g, '')
    .trim()

  return cleaned || null
}

function mergeKeyFromPartNumber(value: string) {
  return value.replace(/[^A-Z0-9+]/g, '')
}

function normalizeBrand(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const raw = value.trim()
  if (!raw) {
    return null
  }

  return BOM_BRAND_ALIASES[raw] ?? BOM_BRAND_ALIASES[raw.toUpperCase()] ?? raw.toUpperCase()
}

function normalizePackageType(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const cleaned = value
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/(SOP|SOIC|QFN|QFP|LQFP|TQFP|BGA|SOT|TO)(\d+)/g, '$1-$2')
    .trim()

  return cleaned || null
}

function normalizeQuantity(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value)
  }

  if (typeof value !== 'string') {
    return null
  }

  const cleaned = value.replace(/[,\s]/g, '').toUpperCase()
  if (!cleaned) {
    return null
  }

  const direct = Number(cleaned)
  if (Number.isFinite(direct)) {
    return Math.round(direct)
  }

  const unitMatch = cleaned.match(/^(\d+(?:\.\d+)?)(K|千|万|百)$/)
  if (!unitMatch) {
    return null
  }

  const amount = Number(unitMatch[1])
  if (!Number.isFinite(amount)) {
    return null
  }

  const multiplier =
    unitMatch[2] === 'K' || unitMatch[2] === '千'
      ? 1_000
      : unitMatch[2] === '万'
        ? 10_000
        : 100

  return Math.round(amount * multiplier)
}

function normalizeProviderItems(items: unknown) {
  if (!Array.isArray(items)) {
    throw new Error('Provider output is not a JSON array.')
  }

  const merged = new Map<string, BomParsedItem>()

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const row = item as Record<string, unknown>
    const standardPartNumber = normalizePartNumber(
      typeof row.standard_part_number === 'string' ? row.standard_part_number : null,
    )
    const brand = normalizeBrand(typeof row.brand === 'string' ? row.brand : null)
    const quantity = normalizeQuantity(row.quantity)
    const packageType = normalizePackageType(
      typeof row.package_type === 'string' ? row.package_type : null,
    )

    if (!standardPartNumber) {
      continue
    }

    const key = mergeKeyFromPartNumber(standardPartNumber)
    const existing = merged.get(key)

    if (!existing) {
      merged.set(key, {
        standard_part_number: standardPartNumber,
        brand,
        quantity,
        package_type: packageType,
      })
      continue
    }

    merged.set(key, {
      standard_part_number: existing.standard_part_number ?? standardPartNumber,
      brand: existing.brand ?? brand,
      quantity:
        existing.quantity === null
          ? quantity
          : quantity === null
            ? existing.quantity
            : existing.quantity + quantity,
      package_type: existing.package_type ?? packageType,
    })
  }

  return Array.from(merged.values())
}

function extractGeminiText(payload: GeminiResponsePayload) {
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim()

  if (text) {
    return text
  }

  throw new Error(payload.error?.message ?? 'Gemini did not return text content.')
}

function extractWorkersAIText(payload: unknown) {
  const result = payload as WorkersAIResponsePayload | string | BomParsedItem[]

  if (typeof result === 'string') {
    return result.trim()
  }

  if (Array.isArray(result)) {
    return JSON.stringify(result)
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

async function callGeminiProvider(env: Env, text: string) {
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY')
  }

  const model = env.GEMINI_MODEL ?? 'gemini-1.5-flash'
  const baseUrl = env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta'

  const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: BOM_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `请解析以下BOM脏数据，并严格输出合法JSON数组：\n\n${text}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: BOM_OUTPUT_SCHEMA,
        maxOutputTokens: 4096,
      },
    }),
  })

  const payload = (await response.json().catch(() => null)) as GeminiResponsePayload | null

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Gemini request failed with ${response.status}`)
  }

  const parsed = JSON.parse(extractGeminiText(payload ?? {})) as unknown

  return {
    provider: 'gemini' as const,
    model,
    items: normalizeProviderItems(parsed),
  }
}

async function callWorkersAiProvider(env: Env, text: string) {
  if (!env.AI) {
    throw new Error('Missing Cloudflare AI binding')
  }

  const model = env.WORKERS_AI_MODEL ?? '@cf/meta/llama-3.1-8b-instruct-fast'
  const payload = await env.AI.run(model, {
    messages: [
      { role: 'system', content: BOM_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `请解析以下BOM脏数据，并严格输出合法JSON数组：\n\n${text}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: BOM_OUTPUT_SCHEMA,
    },
    max_tokens: 2048,
    temperature: 0,
  })

  const parsed = JSON.parse(extractWorkersAIText(payload)) as unknown

  return {
    provider: 'workers-ai' as const,
    model,
    items: normalizeProviderItems(parsed),
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export async function onRequestPost(context: PagesFunctionContext<Env>) {
  const { request, env } = context
  const body = (await request.json().catch(() => null)) as BomParseRequest | null
  const text = cleanSourceText(body?.text ?? '')

  if (!text) {
    return badRequest('Request body must include a non-empty `text` field.')
  }

  const maxLines = parseIntegerSetting(env.BOM_MAX_LINES, 200)
  const freeLines = parseIntegerSetting(env.BOM_FREE_LINES, 20)
  const nonEmptyLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (nonEmptyLines.length === 0) {
    return badRequest('BOM text does not contain any parsable lines.')
  }

  if (nonEmptyLines.length > maxLines) {
    return badRequest(`BOM line limit exceeded. Max lines per request: ${maxLines}.`)
  }

  if (text.length > 24_000) {
    return badRequest('BOM payload is too large. Keep request bodies under 24,000 characters.')
  }

  const providerAttempts: ProviderAttempt[] = []

  try {
    const geminiResult = await callGeminiProvider(env, text)
    providerAttempts.push({
      provider: geminiResult.provider,
      model: geminiResult.model,
      ok: true,
    })

    return jsonResponse({
      request_id: crypto.randomUUID(),
      prompt_version: BOM_PROMPT_VERSION,
      provider_used: geminiResult.provider,
      provider_model: geminiResult.model,
      fallback_used: false,
      providers_tried: providerAttempts,
      input_lines: nonEmptyLines.length,
      free_lines: freeLines,
      billable_lines: Math.max(nonEmptyLines.length - freeLines, 0),
      items: geminiResult.items,
    })
  } catch (error) {
    providerAttempts.push({
      provider: 'gemini',
      model: env.GEMINI_MODEL ?? 'gemini-1.5-flash',
      ok: false,
      error: error instanceof Error ? error.message : 'Gemini failed',
    })
  }

  try {
    const workersResult = await callWorkersAiProvider(env, text)
    providerAttempts.push({
      provider: workersResult.provider,
      model: workersResult.model,
      ok: true,
    })

    return jsonResponse({
      request_id: crypto.randomUUID(),
      prompt_version: BOM_PROMPT_VERSION,
      provider_used: workersResult.provider,
      provider_model: workersResult.model,
      fallback_used: true,
      providers_tried: providerAttempts,
      input_lines: nonEmptyLines.length,
      free_lines: freeLines,
      billable_lines: Math.max(nonEmptyLines.length - freeLines, 0),
      items: workersResult.items,
    })
  } catch (error) {
    providerAttempts.push({
      provider: 'workers-ai',
      model: env.WORKERS_AI_MODEL ?? '@cf/meta/llama-3.1-8b-instruct-fast',
      ok: false,
      error: error instanceof Error ? error.message : 'Workers AI failed',
    })
  }

  return jsonResponse(
    {
      error: 'Both BOM parsing engines failed.',
      prompt_version: BOM_PROMPT_VERSION,
      providers_tried: providerAttempts,
    },
    502,
  )
}
