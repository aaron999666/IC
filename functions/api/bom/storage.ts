import type { BomParsedItem } from './prompt'

interface Env {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  SUPABASE_DEFAULT_BUYER_COMPANY_ID?: string
  SUPABASE_DEFAULT_SUBMITTED_BY_USER_ID?: string
}

interface ProviderAttempt {
  provider: string
  model: string
  ok: boolean
  error?: string
}

export interface PersistenceRequest {
  buyerCompanyId?: string
  submittedByUserId?: string
  persistResult?: boolean
  chargePoints?: boolean
}

export interface PersistenceResult {
  persisted: boolean
  status: 'saved' | 'skipped' | 'insufficient_points' | 'error'
  job_id: string | null
  points_charged: number
  skipped_reason?: string
  error?: string
}

interface PersistBomParseOptions {
  env: Env
  sourceText: string
  inputLines: number
  billableLines: number
  providerUsed: string
  providerModel: string
  providersTried: ProviderAttempt[]
  promptVersion: string
  items: BomParsedItem[]
  request: PersistenceRequest
}

interface SupabaseJobRow {
  id: string
}

interface SupabasePointsAccountRow {
  balance: number
}

function getRequestIdentity(env: Env, request: PersistenceRequest) {
  return {
    buyerCompanyId:
      request.buyerCompanyId?.trim() || env.SUPABASE_DEFAULT_BUYER_COMPANY_ID?.trim() || null,
    submittedByUserId:
      request.submittedByUserId?.trim() ||
      env.SUPABASE_DEFAULT_SUBMITTED_BY_USER_ID?.trim() ||
      null,
  }
}

async function supabaseFetch<T>(
  env: Env,
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase service configuration')
  }

  const response = await fetch(`${env.SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => null)) as
    | { message?: string }
    | T
    | null

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? payload.message
        : `Supabase request failed with ${response.status}`

    throw new Error(message ?? `Supabase request failed with ${response.status}`)
  }

  return payload as T
}

async function getAvailablePoints(env: Env, buyerCompanyId: string) {
  const rows = await supabaseFetch<SupabasePointsAccountRow[]>(
    env,
    `/rest/v1/points_accounts?company_id=eq.${buyerCompanyId}&select=balance&limit=1`,
    {
      method: 'GET',
    },
  )

  return rows[0]?.balance ?? 0
}

export async function persistBomParseResult(
  options: PersistBomParseOptions,
): Promise<PersistenceResult> {
  const { env, request, billableLines } = options
  const persistResult = request.persistResult ?? true

  if (!persistResult) {
    return {
      persisted: false,
      status: 'skipped',
      job_id: null,
      points_charged: 0,
      skipped_reason: 'Persistence disabled on request.',
    }
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      persisted: false,
      status: 'skipped',
      job_id: null,
      points_charged: 0,
      skipped_reason: 'Supabase service role environment variables are not configured.',
    }
  }

  const { buyerCompanyId, submittedByUserId } = getRequestIdentity(env, request)

  if (!buyerCompanyId || !submittedByUserId) {
    return {
      persisted: false,
      status: 'skipped',
      job_id: null,
      points_charged: 0,
      skipped_reason:
        'Missing buyer company or submitted-by user identity. Provide request IDs or default env IDs.',
    }
  }

  try {
    if ((request.chargePoints ?? true) && billableLines > 0) {
      const availablePoints = await getAvailablePoints(env, buyerCompanyId)

      if (availablePoints < billableLines) {
        return {
          persisted: false,
          status: 'insufficient_points',
          job_id: null,
          points_charged: 0,
          error: `Insufficient points. Available: ${availablePoints}, required: ${billableLines}.`,
        }
      }
    }

    const createdJobs = await supabaseFetch<SupabaseJobRow[]>(
      env,
      '/rest/v1/bom_parse_jobs',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify([
          {
            buyer_company_id: buyerCompanyId,
            submitted_by: submittedByUserId,
            status: 'completed',
            source_text: options.sourceText,
            line_count: options.inputLines,
            model_name: options.providerModel,
            prompt_version: options.promptVersion,
            token_usage: {
              provider_used: options.providerUsed,
              providers_tried: options.providersTried,
            },
            points_charged: request.chargePoints === false ? 0 : billableLines,
          },
        ]),
      },
    )

    const jobId = createdJobs[0]?.id
    if (!jobId) {
      throw new Error('Supabase did not return the created BOM parse job id.')
    }

    if (options.items.length > 0) {
      await supabaseFetch(
        env,
        '/rest/v1/bom_parse_lines',
        {
          method: 'POST',
          headers: {
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(
            options.items.map((item, index) => ({
              job_id: jobId,
              line_number: index + 1,
              raw_line:
                [item.standard_part_number, item.quantity, item.package_type]
                  .filter((value) => value !== null && value !== undefined && value !== '')
                  .join(' | ') || `PARSED_ROW_${index + 1}`,
              parsed_part_number: item.standard_part_number,
              parsed_quantity: item.quantity,
              parsed_brand: item.brand,
              parsed_package_type: item.package_type,
              confidence: null,
              notes: item.package_type
                ? `Persisted from Cloudflare Pages dual-engine parser. package_type=${item.package_type}`
                : 'Persisted from Cloudflare Pages dual-engine parser.',
            })),
          ),
        },
      )
    }

    if ((request.chargePoints ?? true) && billableLines > 0) {
      await supabaseFetch(
        env,
        '/rest/v1/points_ledger',
        {
          method: 'POST',
          headers: {
            Prefer: 'return=minimal',
          },
          body: JSON.stringify([
            {
              company_id: buyerCompanyId,
              event_type: 'bom_parse_spend',
              delta: -billableLines,
              reference_table: 'bom_parse_jobs',
              reference_id: jobId,
              metadata: {
                provider_used: options.providerUsed,
                provider_model: options.providerModel,
                prompt_version: options.promptVersion,
              },
              created_by: submittedByUserId,
            },
          ]),
        },
      )
    }

    return {
      persisted: true,
      status: 'saved',
      job_id: jobId,
      points_charged: request.chargePoints === false ? 0 : billableLines,
    }
  } catch (error) {
    return {
      persisted: false,
      status: 'error',
      job_id: null,
      points_charged: 0,
      error: error instanceof Error ? error.message : 'Failed to persist BOM parse result.',
    }
  }
}
