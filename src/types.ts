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
  escrow: string
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
