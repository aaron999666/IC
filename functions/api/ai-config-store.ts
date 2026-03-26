interface AiBinding {
  run(model: string, input: unknown): Promise<unknown>
}

export type AiProvider = 'gemini' | 'workers-ai'
export type AiRequestMode = 'api-key' | 'binding' | 'rest'
export type AiConfigAuditAction = 'save' | 'test'
export type AiConfigAuditOutcome = 'success' | 'failure'

export interface AiConfigEnv {
  AI?: AiBinding
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  ADMIN_ENCRYPTION_KEY?: string
  AI_CONFIG_CACHE_TTL_SECONDS?: string
  SUPABASE_ADMIN_ROLES?: string
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
  last_test_status: AiConfigAuditOutcome | null
  last_test_message: string | null
  last_test_latency_ms: number | null
  last_tested_at: string | null
  created_at: string
  updated_at: string
}

interface StoredAiConfigAuditRow {
  id: number
  provider: AiProvider
  action: AiConfigAuditAction
  outcome: AiConfigAuditOutcome
  operator_name: string | null
  change_note: string | null
  config_snapshot: Record<string, unknown> | null
  message: string | null
  latency_ms: number | null
  created_at: string
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
  last_test_status: AiConfigAuditOutcome | null
  last_test_message: string | null
  last_test_latency_ms: number | null
  last_tested_at: string | null
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

export interface AiConfigAuditLog {
  id: number
  provider: AiProvider
  action: AiConfigAuditAction
  outcome: AiConfigAuditOutcome
  operator_name: string | null
  change_note: string | null
  config_snapshot: Record<string, unknown>
  message: string | null
  latency_ms: number | null
  created_at: string
}

export interface RecordAiConfigAuditEventInput {
  provider: AiProvider
  action: AiConfigAuditAction
  outcome: AiConfigAuditOutcome
  operatorName?: string | null
  changeNote?: string | null
  configSnapshot?: Record<string, unknown>
  message?: string | null
  latencyMs?: number | null
}

export class AiConfigValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiConfigValidationError'
  }
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

function trimOptional(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

function normalizePriority(value: number | undefined, fallback: number) {
  if (value === undefined) {
    return fallback
  }

  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new AiConfigValidationError('Priority must be an integer between 1 and 999.')
  }

  return value
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

function validateUrl(value: string | null, label: string) {
  if (!value) {
    return
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('invalid protocol')
    }
  } catch {
    throw new AiConfigValidationError(`${label} must be a valid URL.`)
  }
}

function validateDisplayName(value: string) {
  if (!value.trim()) {
    throw new AiConfigValidationError('Display name is required.')
  }

  if (value.trim().length > 80) {
    throw new AiConfigValidationError('Display name must stay under 80 characters.')
  }
}

function validateModel(value: string) {
  if (!value.trim()) {
    throw new AiConfigValidationError('Model is required.')
  }

  if (value.trim().length > 160) {
    throw new AiConfigValidationError('Model must stay under 160 characters.')
  }
}

function validateOperatorName(value: string | null | undefined) {
  const trimmed = trimOptional(value)
  if (!trimmed) {
    return null
  }

  if (trimmed.length > 80) {
    throw new AiConfigValidationError('Operator name must stay under 80 characters.')
  }

  return trimmed
}

function validateChangeNote(value: string | null | undefined) {
  const trimmed = trimOptional(value)
  if (!trimmed) {
    return null
  }

  if (trimmed.length > 280) {
    throw new AiConfigValidationError('Change note must stay under 280 characters.')
  }

  return trimmed
}

function validateRequestMode(provider: AiProvider, requestMode: AiRequestMode) {
  if (provider === 'gemini' && requestMode !== 'api-key') {
    throw new AiConfigValidationError('Gemini only supports `api-key` mode in this console.')
  }

  if (provider === 'workers-ai' && requestMode === 'api-key') {
    throw new AiConfigValidationError('Workers AI request mode must be `binding` or `rest`.')
  }
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
      last_test_status: null,
      last_test_message: null,
      last_test_latency_ms: null,
      last_tested_at: null,
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
      last_test_status: null,
      last_test_message: null,
      last_test_latency_ms: null,
      last_tested_at: null,
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
    last_test_status: row.last_test_status,
    last_test_message: row.last_test_message,
    last_test_latency_ms: row.last_test_latency_ms,
    last_tested_at: row.last_tested_at,
  }
}

function toAuditLog(row: StoredAiConfigAuditRow): AiConfigAuditLog {
  return {
    id: row.id,
    provider: row.provider,
    action: row.action,
    outcome: row.outcome,
    operator_name: row.operator_name,
    change_note: row.change_note,
    config_snapshot: row.config_snapshot ?? {},
    message: row.message,
    latency_ms: row.latency_ms,
    created_at: row.created_at,
  }
}

async function getStoredConfigByProvider(env: AiConfigEnv, provider: AiProvider) {
  const rows = await supabaseFetch<StoredAiConfigRow[]>(
    env,
    `/rest/v1/admin_ai_provider_configs?provider=eq.${provider}&select=*&limit=1`,
    { method: 'GET' },
  )

  return rows[0] ?? null
}

function buildConfigSnapshot(config: RuntimeAiProviderConfig) {
  return {
    provider: config.provider,
    display_name: config.display_name,
    enabled: config.enabled,
    priority: config.priority,
    request_mode: config.request_mode,
    model: config.model,
    base_url: config.base_url,
    account_id_configured: Boolean(config.account_id),
    api_key_configured: Boolean(config.api_key),
    api_token_configured: Boolean(config.api_token),
    source: config.source,
  }
}

export function buildAiConfigAuditSnapshotFromPayload(payload: UpsertAiProviderPayload) {
  return {
    provider: payload.provider,
    display_name: trimOptional(payload.displayName),
    enabled: payload.enabled ?? null,
    priority: payload.priority ?? null,
    request_mode: payload.requestMode ?? null,
    model: trimOptional(payload.model),
    base_url_configured: Boolean(trimOptional(payload.baseUrl)),
    account_id_configured: Boolean(trimOptional(payload.accountId)),
    api_key_supplied: Boolean(trimOptional(payload.apiKey)),
    api_token_supplied: Boolean(trimOptional(payload.apiToken)),
    clear_api_key: Boolean(payload.clearApiKey),
    clear_api_token: Boolean(payload.clearApiToken),
  }
}

function validateResolvedConfig(config: RuntimeAiProviderConfig) {
  validateDisplayName(config.display_name)
  validateModel(config.model)
  validateUrl(config.base_url, 'Base URL')
  validateRequestMode(config.provider, config.request_mode)

  if (config.provider === 'workers-ai' && config.request_mode === 'rest' && !config.account_id) {
    throw new AiConfigValidationError('Workers AI REST mode requires an account ID.')
  }
}

export function buildAiConfigAuditSnapshot(config: RuntimeAiProviderConfig) {
  return buildConfigSnapshot(config)
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

export async function listAdminAiConfigAuditLogs(env: AiConfigEnv, limit = 24) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return []
  }

  const safeLimit = Math.min(Math.max(limit, 1), 100)
  const rows = await supabaseFetch<StoredAiConfigAuditRow[]>(
    env,
    `/rest/v1/admin_ai_config_audit_logs?select=*&order=created_at.desc,id.desc&limit=${safeLimit}`,
    { method: 'GET' },
  )

  return rows.map(toAuditLog)
}

export async function recordAiConfigAuditEvent(env: AiConfigEnv, event: RecordAiConfigAuditEventInput) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return
  }

  const operatorName = validateOperatorName(event.operatorName)
  const changeNote = validateChangeNote(event.changeNote)

  await supabaseFetch(
    env,
    '/rest/v1/admin_ai_config_audit_logs',
    {
      method: 'POST',
      headers: {
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([
        {
          provider: event.provider,
          action: event.action,
          outcome: event.outcome,
          operator_name: operatorName,
          change_note: changeNote,
          config_snapshot: event.configSnapshot ?? {},
          message: trimOptional(event.message) ?? null,
          latency_ms: event.latencyMs ?? null,
        },
      ]),
    },
  )
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

export async function resolveDraftRuntimeAiProviderConfig(env: AiConfigEnv, payload: UpsertAiProviderPayload) {
  const existing = await getStoredConfigByProvider(env, payload.provider).catch(() => null)
  const fallback = buildEnvFallbackConfigs(env).find((config) => config.provider === payload.provider)

  const resolvedDisplayName =
    trimOptional(payload.displayName) ||
    existing?.display_name ||
    fallback?.display_name ||
    payload.provider

  const resolvedEnabled = payload.enabled ?? existing?.enabled ?? fallback?.enabled ?? true
  const resolvedPriority = normalizePriority(
    payload.priority,
    existing?.priority ?? fallback?.priority ?? 100,
  )
  const resolvedRequestMode = normalizeRequestMode(
    payload.requestMode ?? existing?.request_mode ?? fallback?.request_mode,
    payload.provider,
  )
  const resolvedModel =
    trimOptional(payload.model) ||
    existing?.model ||
    fallback?.model ||
    ''

  const resolvedBaseUrl =
    payload.baseUrl === undefined
      ? existing?.base_url ?? fallback?.base_url ?? null
      : trimOptional(payload.baseUrl)

  const resolvedAccountId =
    payload.accountId === undefined
      ? existing?.account_id ?? fallback?.account_id ?? null
      : trimOptional(payload.accountId)

  const resolvedApiKey = payload.clearApiKey
    ? null
    : trimOptional(payload.apiKey) ??
      (existing?.api_key_ciphertext && env.ADMIN_ENCRYPTION_KEY
        ? await decryptSecret(env, existing.api_key_ciphertext)
        : null) ??
      fallback?.api_key ??
      null

  const resolvedApiToken = payload.clearApiToken
    ? null
    : trimOptional(payload.apiToken) ??
      (existing?.api_token_ciphertext && env.ADMIN_ENCRYPTION_KEY
        ? await decryptSecret(env, existing.api_token_ciphertext)
        : null) ??
      fallback?.api_token ??
      null

  const runtimeConfig: RuntimeAiProviderConfig = {
    provider: payload.provider,
    display_name: resolvedDisplayName,
    enabled: resolvedEnabled,
    priority: resolvedPriority,
    request_mode: resolvedRequestMode,
    model: resolvedModel,
    base_url: resolvedBaseUrl,
    api_key: resolvedApiKey,
    api_token: resolvedApiToken,
    account_id: resolvedAccountId,
    source: existing ? 'database' : 'environment',
  }

  validateResolvedConfig(runtimeConfig)
  return runtimeConfig
}

export async function upsertAdminAiProviderConfig(env: AiConfigEnv, payload: UpsertAiProviderPayload) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service configuration is required for admin AI config storage.')
  }

  if (!env.ADMIN_ENCRYPTION_KEY) {
    throw new Error('ADMIN_ENCRYPTION_KEY is required to securely store AI provider secrets.')
  }

  const resolvedRuntime = await resolveDraftRuntimeAiProviderConfig(env, payload)
  const existing = await getStoredConfigByProvider(env, payload.provider)

  const nextApiKeyCiphertext = payload.clearApiKey
    ? null
    : trimOptional(payload.apiKey)
      ? await encryptSecret(env, trimOptional(payload.apiKey) ?? '')
      : existing?.api_key_ciphertext ?? null

  const nextApiTokenCiphertext = payload.clearApiToken
    ? null
    : trimOptional(payload.apiToken)
      ? await encryptSecret(env, trimOptional(payload.apiToken) ?? '')
      : existing?.api_token_ciphertext ?? null

  const nextApiKeyHint = payload.clearApiKey
    ? null
    : trimOptional(payload.apiKey)
      ? buildHint(trimOptional(payload.apiKey) ?? '')
      : existing?.api_key_hint ?? null

  const nextApiTokenHint = payload.clearApiToken
    ? null
    : trimOptional(payload.apiToken)
      ? buildHint(trimOptional(payload.apiToken) ?? '')
      : existing?.api_token_hint ?? null

  const row = {
    provider: payload.provider,
    display_name: resolvedRuntime.display_name,
    enabled: resolvedRuntime.enabled,
    priority: resolvedRuntime.priority,
    request_mode: resolvedRuntime.request_mode,
    model: resolvedRuntime.model,
    base_url: resolvedRuntime.base_url,
    account_id: resolvedRuntime.account_id,
    api_key_ciphertext: nextApiKeyCiphertext,
    api_key_hint: nextApiKeyCiphertext ? nextApiKeyHint : null,
    api_token_ciphertext: nextApiTokenCiphertext,
    api_token_hint: nextApiTokenCiphertext ? nextApiTokenHint : null,
    metadata: {
      ui_managed: true,
      last_saved_via: 'admin-console',
    },
    updated_by: validateOperatorName(payload.updatedBy) ?? 'admin-console',
    last_test_status: existing?.last_test_status ?? null,
    last_test_message: existing?.last_test_message ?? null,
    last_test_latency_ms: existing?.last_test_latency_ms ?? null,
    last_tested_at: existing?.last_tested_at ?? null,
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

export async function updateAdminAiProviderTestStatus(
  env: AiConfigEnv,
  provider: AiProvider,
  outcome: AiConfigAuditOutcome,
  message: string,
  latencyMs: number | null,
  testedAt: string,
) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service configuration is required for provider test status updates.')
  }

  await supabaseFetch(
    env,
    `/rest/v1/admin_ai_provider_configs?provider=eq.${provider}`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        last_test_status: outcome,
        last_test_message: trimOptional(message),
        last_test_latency_ms: latencyMs,
        last_tested_at: testedAt,
      }),
    },
  )
}
