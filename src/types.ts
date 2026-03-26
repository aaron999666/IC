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
