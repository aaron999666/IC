export type Metric = {
  label: string
  value: string
  note: string
}

export type HotQuery = {
  mpn: string
  trend: string
  note: string
}

export type SupplierRow = {
  inventoryId?: string
  seller: string
  rating: string
  mpn: string
  brand: string
  package: string
  lot: string
  stock: string
  price: string
  channel: string
  location: string
}

export type BomDictionaryRow = {
  alias: string[]
  normalized: string
  brand: string
  package: string
  demand: string
  availability: string
  replacement: string
}

export type PipelineStep = {
  step: string
  title: string
  body: string
}

export type SchemaEntity = {
  table: string
  detail: string
}

export type QueueItem = {
  title: string
  meta: string
  status: string
}

export type LedgerItem = {
  title: string
  change: string
  note: string
}

export type FaqItem = {
  question: string
  answer: string
}

export type BomApiItem = {
  standard_part_number: string | null
  brand: string | null
  quantity: number | null
  package_type: string | null
}

export type BomProviderAttempt = {
  provider: string
  model: string
  ok: boolean
  error?: string
}

export type BomParseResponse = {
  request_id: string
  prompt_version: string
  provider_used: string
  provider_model: string
  fallback_used: boolean
  providers_tried: BomProviderAttempt[]
  input_lines: number
  free_lines: number
  billable_lines: number
  items: BomApiItem[]
  storage?: {
    persisted: boolean
    status: string
    job_id: string | null
    points_charged: number
    skipped_reason?: string
    error?: string
  }
}

export type AdminAiProviderConfig = {
  provider: 'gemini' | 'workers-ai'
  display_name: string
  enabled: boolean
  priority: number
  request_mode: 'api-key' | 'binding' | 'rest'
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
  last_test_status: 'success' | 'failure' | null
  last_test_message: string | null
  last_test_latency_ms: number | null
  last_tested_at: string | null
}

export type AdminAiConfigAuditLog = {
  id: number
  provider: 'gemini' | 'workers-ai'
  action: 'save' | 'test'
  outcome: 'success' | 'failure'
  operator_name: string | null
  change_note: string | null
  config_snapshot: Record<string, unknown>
  message: string | null
  latency_ms: number | null
  created_at: string
}

export type AdminAiConfigConsoleResponse = {
  configs: AdminAiProviderConfig[]
  auditLogs: AdminAiConfigAuditLog[]
}

export type AdminAiProviderTestResult = {
  provider: 'gemini' | 'workers-ai'
  model: string
  request_mode: 'api-key' | 'binding' | 'rest'
  source: 'database' | 'environment'
  latency_ms: number
  message: string
  tested_at: string
}

export type CompanyMembership = {
  company_id: string
  company_name: string
  kyb_status: string | null
  role: 'owner' | 'admin' | 'buyer' | 'seller' | 'finance' | 'ops'
}

export type PointsLedgerEntry = {
  id: string
  event_type: string
  delta: number
  reference_table: string | null
  reference_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type ContactUnlockRecord = {
  unlock_id: string
  inventory_listing_id: string
  standard_part_number: string
  brand: string
  package_type: string | null
  seller_company_name: string
  contact_person: string
  phone_number: string
  wechat_id: string | null
  seller_credit_score: number
  points_spent: number
  unlocked_at: string
}

export type RechargeOrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'cancelled'
  | 'expired'
  | 'failed'

export type RechargeOrder = {
  id: string
  order_no: string
  status: RechargeOrderStatus
  amount_cny: number
  points_amount: number
  bonus_points: number
  total_points: number
  currency: string
  payment_channel: string | null
  payment_url: string | null
  external_order_no: string | null
  external_trade_no: string | null
  note: string | null
  paid_amount_cny: number | null
  paid_at: string | null
  credited_at: string | null
  expires_at: string | null
  created_at: string
  requested_by: string | null
}
