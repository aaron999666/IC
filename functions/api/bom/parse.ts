interface Env {
  OPENAI_API_KEY: string
  OPENAI_BOM_MODEL?: string
  OPENAI_BASE_URL?: string
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

interface BomParseItem {
  part_number: string | null
  quantity: number | null
  brand: string | null
}

interface BomParseResult {
  items: BomParseItem[]
}

interface OpenAIErrorPayload {
  error?: {
    message?: string
  }
}

interface OpenAIOutputContent {
  type?: string
  text?: string
}

interface OpenAIOutputItem {
  type?: string
  content?: OpenAIOutputContent[]
}

interface OpenAIResponsePayload extends OpenAIErrorPayload {
  output_text?: string
  output?: OpenAIOutputItem[]
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const bomParseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['part_number', 'quantity', 'brand'],
        properties: {
          part_number: {
            type: ['string', 'null'],
          },
          quantity: {
            type: ['number', 'null'],
          },
          brand: {
            type: ['string', 'null'],
          },
        },
      },
    },
  },
} as const

const systemPrompt = `
You are a professional IC component BOM parsing expert.

Your job is to extract clean, structured rows from noisy BOM text.
Return only structured data that fits the provided JSON schema.

Rules:
1. Normalize part numbers by removing meaningless spaces and preserving meaningful suffixes such as package, tape, tray, temperature or + signs.
2. Extract only actual BOM rows. Ignore greetings, signatures, phone numbers, empty lines and unrelated comments.
3. If quantity is missing or ambiguous, return null.
4. If brand is not explicitly present, return null.
5. Never invent a part number.
6. Keep output order aligned with the input order.
`.trim()

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

function extractStructuredText(payload: OpenAIResponsePayload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text
  }

  const messageText = payload.output
    ?.find((item) => item.type === 'message')
    ?.content?.find((content) => content.type === 'output_text' && typeof content.text === 'string')
    ?.text

  if (messageText) {
    return messageText
  }

  throw new Error(payload.error?.message ?? 'Model response did not include structured text.')
}

function parseIntegerSetting(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export async function onRequestPost(context: PagesFunctionContext<Env>) {
  const { request, env } = context

  if (!env.OPENAI_API_KEY) {
    return jsonResponse({ error: 'Missing OPENAI_API_KEY in Cloudflare environment.' }, 500)
  }

  const body = (await request.json().catch(() => null)) as BomParseRequest | null
  const text = body?.text?.trim()

  if (!text) {
    return badRequest('Request body must include a non-empty `text` field.')
  }

  const maxLines = parseIntegerSetting(env.BOM_MAX_LINES, 200)
  const freeLines = parseIntegerSetting(env.BOM_FREE_LINES, 20)
  const rawLines = text.split(/\r?\n/).map((line) => line.trim())
  const nonEmptyLines = rawLines.filter(Boolean)

  if (nonEmptyLines.length === 0) {
    return badRequest('BOM text does not contain any parsable lines.')
  }

  if (nonEmptyLines.length > maxLines) {
    return badRequest(`BOM line limit exceeded. Max lines per request: ${maxLines}.`)
  }

  if (text.length > 24_000) {
    return badRequest('BOM payload is too large. Keep request bodies under 24,000 characters.')
  }

  const model = env.OPENAI_BOM_MODEL ?? 'gpt-4o-mini'
  const apiBaseUrl = env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'

  const upstreamResponse = await fetch(`${apiBaseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Parse the following IC BOM text into structured rows:\n\n${text}`,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'bom_parse_result',
          strict: true,
          schema: bomParseSchema,
        },
      },
    }),
  })

  if (!upstreamResponse.ok) {
    const errorPayload = (await upstreamResponse.json().catch(() => null)) as OpenAIErrorPayload | null

    return jsonResponse(
      {
        error: errorPayload?.error?.message ?? 'AI provider request failed.',
        upstream_status: upstreamResponse.status,
      },
      502,
    )
  }

  const openAIResponse = (await upstreamResponse.json()) as OpenAIResponsePayload

  try {
    const parsed = JSON.parse(extractStructuredText(openAIResponse)) as BomParseResult
    const billableLines = Math.max(nonEmptyLines.length - freeLines, 0)

    return jsonResponse({
      request_id: crypto.randomUUID(),
      model,
      input_lines: nonEmptyLines.length,
      free_lines: freeLines,
      billable_lines: billableLines,
      items: parsed.items,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to parse structured AI response.'

    return jsonResponse(
      {
        error: message,
      },
      502,
    )
  }
}
