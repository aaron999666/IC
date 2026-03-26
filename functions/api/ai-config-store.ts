interface AiBinding {
  run(model: string, input: unknown): Promise<unknown>
}

export type AiProvider = 'gemini' | 'workers-ai'
export type AiRequestMode = 'api-key' | 'binding' | 'rest'

export interface AiConfigEnv {
  AI?: AiBinding
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  ADMIN_API_TOKEN?: string
  ADMIN_ENCRYPTION_KEY?: string
  AI_CONFIG_CACHE_TTL_SECONDS?: string
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  GEMINI_BASE_URL?: string
  WORKERS_AI_MODEL?: string
  WORKERS_AI_BASE_URL?: string
  WORKERS_AI_REQUEST_MODE?: string
  WORKERS_AI_ACCOUNT_ID?: string
  WORKERS_AI_API_TOKEN?: string
}

interface StoredAiConfigRow {
  provider: AiProvider
  display_name: string
  enabled: boolean
  priority: number
  request_mode: AiRequestMode
  model: string
  base_url: string | null
  api_key_ciphertext: string | null
  api_key_hint: string | null
  api_token_ciphertext: string | null
  api_token_hint: string | null
  account_id: string | null
  metadata: Record<string, unknown> | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface RuntimeAiProviderConfig {
  provider: AiProvider
  display_name: string
  enabled: boolean
  priority: number
  request_mode: AiRequestMode
  model: string
  base_url: string | null
  api_key: string | null
  api_token: string | null
  account_id: string | null
  source: 'database' | 'environment'
}

export interface AdminAiProviderConfig {
  provider: AiProvider
  display_name: string
  enabled: boolean
  priority: number
  request_mode: AiRequestMode
  model: string
  base_url: string | null
  account_id: string | null
  api_key_hint: string | null
  api_key_configured: boolean
  api_token_hint: string | null
  api_token_configured: boolean
  source: 'database' | 'environment'
  updated_by: string | null
  updated_at: string | null
}

export interface UpsertAiProviderPayload {
  provider: AiProvider
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

let runtimeConfigCache:
  | {
      expiresAt: number
      configs: RuntimeAiProviderConfig[]
    }
  | null = null

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeRequestMode(value: string | null | undefined, provider: AiProvider): AiRequestMode {
  if (value === 'binding' || value === 'rest' || value === 'api-key') {
    return value
  }

  if (provider === 'workers-ai') {
    return 'binding'
  }

  return 'api-key'
}

function getWorkersEnvMode(env: AiConfigEnv): AiRequestMode {
  const requested = normalizeRequestMode(env.WORKERS_AI_REQUEST_MODE, 'workers-ai')
  if (requested === 'api-key') {
    return 'binding'
  }

  if (requested === 'rest') {
    return 'rest'
  }

  if (env.AI) {
    return 'binding'
  }

  if (env.WORKERS_AI_ACCOUNT_ID && env.WORKERS_AI_API_TOKEN) {
    return 'rest'
  }

  return 'binding'
}

function buildEnvFallbackConfigs(env: AiConfigEnv): RuntimeAiProviderConfig[] {
  return [
    {
      provider: 'gemini',
      display_name: 'Gemini',
      enabled: true,
      priority: 10,
      request_mode: 'api-key',
      model: env.GEMINI_MODEL ?? 'gemini-1.5-flash',
      base_url: env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
      api_key: env.GEMINI_API_KEY ?? null,
      api_token: null,
      account_id: null,
      source: 'environment',
    },
    {
      provider: 'workers-ai',
      display_name: 'Cloudflare Workers AI',
      enabled: true,
      priority: 20,
      request_mode: getWorkersEnvMode(env),
      model: env.WORKERS_AI_MODEL ?? '@cf/meta/llama-3.1-8b-instruct-fast',
      base_url: env.WORKERS_AI_BASE_URL ?? 'https://api.cloudflare.com/client/v4',
      api_key: null,
      api_token: env.WORKERS_AI_API_TOKEN ?? null,
      account_id: env.WORKERS_AI_ACCOUNT_ID ?? null,
      source: 'environment',
    },
  ]
}

function createEnvHint(label: string, configured: boolean) {
  return configured ? `${label} configured via environment variable` : null
}

function buildEnvAdminConfigs(env: AiConfigEnv): AdminAiProviderConfig[] {
  return [
    {
      provider: 'gemini',
      display_name: 'Gemini',
      enabled: true,
      priority: 10,
      request_mode: 'api-key',
      model: env.GEMINI_MODEL ?? 'gemini-1.5-flash',
      base_url: env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
      account_id: null,
      api_key_hint: createEnvHint('Gemini API key', Boolean(env.GEMINI_API_KEY)),
      api_key_configured: Boolean(env.GEMINI_API_KEY),
      api_token_hint: null,
      api_token_configured: false,
      source: 'environment',
      updated_by: null,
      updated_at: null,
    },
    {
      provider: 'workers-ai',
      display_name: 'Cloudflare Workers AI',
      enabled: true,
      priority: 20,
      request_mode: getWorkersEnvMode(env),
      model: env.WORKERS_AI_MODEL ?? '@cf/meta/llama-3.1-8b-instruct-fast',
      base_url: env.WORKERS_AI_BASE_URL ?? 'https://api.cloudflare.com/client/v4',
      account_id: env.WORKERS_AI_ACCOUNT_ID ?? null,
      api_key_hint: null,
      api_key_configured: false,
      api_token_hint:
        getWorkersEnvMode(env) === 'rest'
          ? createEnvHint('Workers AI API token', Boolean(env.WORKERS_AI_API_TOKEN))
          : env.AI
            ? 'Using Cloudflare AI binding'
            : null,
      api_token_configured: getWorkersEnvMode(env) === 'rest'
        ? Boolean(env.WORKERS_AI_API_TOKEN)
        : Boolean(env.AI),
      source: 'environment',
      updated_by: null,
      updated_at: null,
    },
  ]
}

async function supabaseFetch<T>(env: AiConfigEnv, path: string, init?: RequestInit): Promise<T> {
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

function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function encodeBase64(value: Uint8Array) {
  let binary = ''
  for (const byte of value) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

let importedMasterKeyPromise: Promise<CryptoKey> | null = null

async function getMasterKey(env: AiConfigEnv) {
  if (!env.ADMIN_ENCRYPTION_KEY) {
    throw new Error('Missing ADMIN_ENCRYPTION_KEY')
  }

  if (!importedMasterKeyPromise) {
    const rawKey = decodeBase64(env.ADMIN_ENCRYPTION_KEY)

    if (rawKey.byteLength !== 32) {
      throw new Error('ADMIN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.')
    }

    importedMasterKeyPromise = crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  return importedMasterKeyPromise
}

async function encryptSecret(env: AiConfigEnv, plaintext: string) {
  const key = await getMasterKey(env)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded,
    ),
  )

  return `${encodeBase64(iv)}.${encodeBase64(ciphertext)}`
}

async function decryptSecret(env: AiConfigEnv, value: string | null) {
  if (!value) {
    return null
  }

  const [ivPart, cipherPart] = value.split('.')
  if (!ivPart || !cipherPart) {
    throw new Error('Encrypted secret payload is malformed.')
  }

  const key = await getMasterKey(env)
  const iv = decodeBase64(ivPart)
  const ciphertext = decodeBase64(cipherPart)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )

  return new TextDecoder().decode(plaintext)
}

function buildHint(value: string) {
  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`
  }

  return `${value.slice(0, 4)}***${value.slice(-4)}`
}

async function listStoredConfigs(env: AiConfigEnv) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return []
  }

  const rows = await supabaseFetch<StoredAiConfigRow[]>(
    env,
    '/rest/v1/admin_ai_provider_configs?select=*&order=priority.asc,provider.asc',
    { method: 'GET' },
  )

  return rows
}

function mergeRuntimeConfigs(
  defaults: RuntimeAiProviderConfig[],
  stored: RuntimeAiProviderConfig[],
) {
  const merged = new Map<AiProvider, RuntimeAiProviderConfig>()

  for (const config of defaults) {
    merged.set(config.provider, config)
  }

  for (const config of stored) {
    merged.set(config.provider, config)
  }

  return Array.from(merged.values()).sort((left, right) => left.priority - right.priority)
}

function mergeAdminConfigs(
  defaults: AdminAiProviderConfig[],
  stored: AdminAiProviderConfig[],
) {
  const merged = new Map<AiProvider, AdminAiProviderConfig>()

  for (const config of defaults) {
    merged.set(config.provider, config)
  }

  for (const config of stored) {
    merged.set(config.provider, config)
  }

  return Array.from(merged.values()).sort((left, right) => left.priority - right.priority)
}

async function toRuntimeConfig(env: AiConfigEnv, row: StoredAiConfigRow): Promise<RuntimeAiProviderConfig> {
  return {
    provider: row.provider,
    display_name: row.display_name,
    enabled: row.enabled,
    priority: row.priority,
    request_mode: normalizeRequestMode(row.request_mode, row.provider),
    model: row.model,
    base_url: row.base_url,
    api_key: await decryptSecret(env, row.api_key_ciphertext),
    api_token: await decryptSecret(env, row.api_token_ciphertext),
    account_id: row.account_id,
    source: 'database',
  }
}

function toRedactedAdminConfig(row: StoredAiConfigRow): AdminAiProviderConfig {
  return {
    provider: row.provider,
    display_name: row.display_name,
    enabled: row.enabled,
    priority: row.priority,
    request_mode: normalizeRequestMode(row.request_mode, row.provider),
    model: row.model,
    base_url: row.base_url,
    account_id: row.account_id,
    api_key_hint: row.api_key_hint,
    api_key_configured: Boolean(row.api_key_ciphertext),
    api_token_hint: row.api_token_hint,
    api_token_configured: Boolean(row.api_token_ciphertext),
    source: 'database',
    updated_by: row.updated_by,
    updated_at: row.updated_at,
  }
}

export function clearAiConfigCache() {
  runtimeConfigCache = null
}

export async function getAdminAiProviderConfigs(env: AiConfigEnv) {
  const defaults = buildEnvAdminConfigs(env)
  const storedRows = await listStoredConfigs(env).catch(() => [])
  const storedConfigs = storedRows.map(toRedactedAdminConfig)

  return mergeAdminConfigs(defaults, storedConfigs)
}

export async function resolveRuntimeAiProviderConfigs(env: AiConfigEnv, forceRefresh = false) {
  const cacheTtlMs = parsePositiveInteger(env.AI_CONFIG_CACHE_TTL_SECONDS, 60) * 1_000
  const now = Date.now()

  if (!forceRefresh && runtimeConfigCache && runtimeConfigCache.expiresAt > now) {
    return runtimeConfigCache.configs
  }

  const defaults = buildEnvFallbackConfigs(env)
  const storedRows = await listStoredConfigs(env).catch(() => [])

  let storedConfigs: RuntimeAiProviderConfig[] = []

  if (storedRows.length > 0 && env.ADMIN_ENCRYPTION_KEY) {
    storedConfigs = await Promise.all(storedRows.map((row) => toRuntimeConfig(env, row)))
  }

  const merged = mergeRuntimeConfigs(defaults, storedConfigs)
  runtimeConfigCache = {
    expiresAt: now + cacheTtlMs,
    configs: merged,
  }

  return merged
}

async function getStoredConfigByProvider(env: AiConfigEnv, provider: AiProvider) {
  const rows = await supabaseFetch<StoredAiConfigRow[]>(
    env,
    `/rest/v1/admin_ai_provider_configs?provider=eq.${provider}&select=*&limit=1`,
    { method: 'GET' },
  )

  return rows[0] ?? null
}

export async function upsertAdminAiProviderConfig(env: AiConfigEnv, payload: UpsertAiProviderPayload) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service configuration is required for admin AI config storage.')
  }

  if (!env.ADMIN_ENCRYPTION_KEY) {
    throw new Error('ADMIN_ENCRYPTION_KEY is required to securely store AI provider secrets.')
  }

  const existing = await getStoredConfigByProvider(env, payload.provider)
  const fallback = buildEnvFallbackConfigs(env).find((config) => config.provider === payload.provider)

  const resolvedDisplayName =
    payload.displayName?.trim() ||
    existing?.display_name ||
    fallback?.display_name ||
    payload.provider

  const resolvedEnabled = payload.enabled ?? existing?.enabled ?? true
  const resolvedPriority = payload.priority ?? existing?.priority ?? fallback?.priority ?? 100
  const resolvedRequestMode = normalizeRequestMode(
    payload.requestMode ?? existing?.request_mode ?? fallback?.request_mode,
    payload.provider,
  )
  const resolvedModel = payload.model?.trim() || existing?.model || fallback?.model

  if (!resolvedModel) {
    throw new Error('Model is required.')
  }

  const nextApiKeyCiphertext = payload.clearApiKey
    ? null
    : payload.apiKey?.trim()
      ? await encryptSecret(env, payload.apiKey.trim())
      : existing?.api_key_ciphertext ?? null

  const nextApiTokenCiphertext = payload.clearApiToken
    ? null
    : payload.apiToken?.trim()
      ? await encryptSecret(env, payload.apiToken.trim())
      : existing?.api_token_ciphertext ?? null

  const nextApiKeyHint = payload.clearApiKey
    ? null
    : payload.apiKey?.trim()
      ? buildHint(payload.apiKey.trim())
      : existing?.api_key_hint ?? null

  const nextApiTokenHint = payload.clearApiToken
    ? null
    : payload.apiToken?.trim()
      ? buildHint(payload.apiToken.trim())
      : existing?.api_token_hint ?? null

  const row = {
    provider: payload.provider,
    display_name: resolvedDisplayName,
    enabled: resolvedEnabled,
    priority: resolvedPriority,
    request_mode: resolvedRequestMode,
    model: resolvedModel,
    base_url:
      payload.baseUrl === undefined
        ? existing?.base_url ?? fallback?.base_url ?? null
        : payload.baseUrl?.trim() || null,
    account_id:
      payload.accountId === undefined
        ? existing?.account_id ?? fallback?.account_id ?? null
        : payload.accountId?.trim() || null,
    api_key_ciphertext: nextApiKeyCiphertext,
    api_key_hint: nextApiKeyCiphertext ? nextApiKeyHint : null,
    api_token_ciphertext: nextApiTokenCiphertext,
    api_token_hint: nextApiTokenCiphertext ? nextApiTokenHint : null,
    metadata: {
      ui_managed: true,
    },
    updated_by: payload.updatedBy?.trim() || 'admin-console',
  }

  await supabaseFetch(
    env,
    '/rest/v1/admin_ai_provider_configs?on_conflict=provider',
    {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([row]),
    },
  )

  clearAiConfigCache()
  return getAdminAiProviderConfigs(env)
}

async function digestString(value: string) {
  const encoded = new TextEncoder().encode(value)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoded))
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index]
  }

  return diff === 0
}

export async function isAuthorizedAdminRequest(request: Request, env: AiConfigEnv) {
  const expectedToken = env.ADMIN_API_TOKEN?.trim()
  if (!expectedToken) {
    return false
  }

  const authorization = request.headers.get('Authorization') ?? ''
  const bearerToken = authorization.replace(/^Bearer\s+/i, '').trim()

  if (!bearerToken) {
    return false
  }

  const [expectedDigest, receivedDigest] = await Promise.all([
    digestString(expectedToken),
    digestString(bearerToken),
  ])

  return timingSafeEqual(expectedDigest, receivedDigest)
}
