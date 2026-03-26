import type {
  BomDictionaryRow,
  HotQuery,
  LedgerItem,
  Metric,
  PipelineStep,
  QueueItem,
  SchemaEntity,
  SupplierRow,
} from '../types'

export const heroSuggestions = [
  'STM32F103C8T6',
  'TPS7A4701RGWT',
  'MAX3232ESE+T',
  'ESP32-S3-WROOM-1',
]

export const liveMetrics: Metric[] = [
  {
    label: 'Today new live SKUs',
    value: '148,320',
    note: '+12.6% vs yesterday',
  },
  {
    label: 'Weekly contact unlocks',
    value: '12,480',
    note: 'server-side point deduction only',
  },
  {
    label: 'BOM lines normalized',
    value: '91,304',
    note: 'dual-engine parsing this week',
  },
  {
    label: 'Realtime ERP sync sellers',
    value: '427',
    note: 'earning monthly point rebates',
  },
]

export const hotQueries: HotQuery[] = [
  { mpn: 'STM32F103VET6', trend: '+28%', note: 'industrial control' },
  { mpn: 'TPS5430DDAR', trend: '+19%', note: 'power module rebuild' },
  { mpn: 'ADUM141E1BRWZ', trend: '+17%', note: 'isolation demand' },
  { mpn: 'GD32F303RET6', trend: '+14%', note: 'domestic replacement' },
  { mpn: 'XCVU9P-2FLGA2104I', trend: '+11%', note: 'AI accelerator board' },
]

export const supplierRows: SupplierRow[] = [
  {
    seller: 'Promoted source lane',
    rating: '5 / 5',
    mpn: 'STM32F103C8T6',
    brand: 'ST',
    package: 'LQFP-48',
    lot: '2418+',
    stock: '32,400',
    price: 'CNY 7.28 - 7.45',
    channel: 'Protected lane',
    location: 'Shenzhen',
  },
  {
    seller: 'Identity hidden',
    rating: '4 / 5',
    mpn: 'STM32F103C8T6',
    brand: 'ST',
    package: 'LQFP-48',
    lot: '2422+',
    stock: '11,200',
    price: 'CNY 7.40 - 7.58',
    channel: 'Reveal-on-demand',
    location: 'Hong Kong',
  },
  {
    seller: 'Identity hidden',
    rating: '5 / 5',
    mpn: 'GD32F103C8T6',
    brand: 'GIGADEVICE',
    package: 'LQFP-48',
    lot: '2501+',
    stock: '48,000',
    price: 'CNY 4.10 - 4.24',
    channel: 'Protected lane',
    location: 'Suzhou',
  },
  {
    seller: 'Identity hidden',
    rating: '4 / 5',
    mpn: 'MAX3232ESE+T',
    brand: 'ADI',
    package: 'SOIC-16',
    lot: '2437+',
    stock: '9,850',
    price: 'CNY 2.58 - 2.66',
    channel: 'Reveal-on-demand',
    location: 'Rotterdam',
  },
  {
    seller: 'Identity hidden',
    rating: '5 / 5',
    mpn: 'TPS7A4701RGWT',
    brand: 'TI',
    package: 'VQFN-20',
    lot: '2411+',
    stock: '6,480',
    price: 'CNY 13.80 - 14.10',
    channel: 'Protected lane',
    location: 'Singapore',
  },
]

export const bomDictionary: BomDictionaryRow[] = [
  {
    alias: ['STM32 F103 C8 T6', 'STM32F103C8', 'STM 32F103C8T6'],
    normalized: 'STM32F103C8T6',
    brand: 'STMicroelectronics',
    package: 'LQFP-48',
    demand: '8,000',
    availability: '3 live sellers',
    replacement: 'GD32F103C8T6',
  },
  {
    alias: ['MAX 3232ESE', 'MAX3232 ESE+T'],
    normalized: 'MAX3232ESE+T',
    brand: 'Analog Devices',
    package: 'SOIC-16',
    demand: '12,000',
    availability: '1 live seller',
    replacement: 'SP3232EEN-L/TR',
  },
  {
    alias: ['TPS 7A4701RGWT', 'TPS7A4701'],
    normalized: 'TPS7A4701RGWT',
    brand: 'Texas Instruments',
    package: 'VQFN-20',
    demand: '2,000',
    availability: '1 live seller',
    replacement: 'LT3042EDD',
  },
  {
    alias: ['ESP32S3 WROOM 1 N8R8', 'ESP32-S3-WROOM1'],
    normalized: 'ESP32-S3-WROOM-1-N8R8',
    brand: 'Espressif',
    package: 'Module',
    demand: '1,600',
    availability: '0 live sellers',
    replacement: 'ESP32-S3-WROOM-1-N16R8',
  },
]

export const dictionaryPipeline: PipelineStep[] = [
  {
    step: '01',
    title: 'Manufacturer catalog ingest',
    body: 'Normalize brand, family, ordering code, package and lifecycle from TI, ST, NXP and distributor feeds.',
  },
  {
    step: '02',
    title: 'Datasheet extraction lane',
    body: 'Use PDF parsing plus LLM-assisted validation to backfill pin count, temp grade, packaging and application hints.',
  },
  {
    step: '03',
    title: 'Cross-reference graph',
    body: 'Score domestic substitutes, package-compatible alternates and risk-tagged replacements before exposing them to buyers.',
  },
  {
    step: '04',
    title: 'Private reveal rails',
    body: 'Expose only redacted inventory publicly, then unlock contact details through RLS-scoped functions and points ledger checks.',
  },
]

export const schemaEntities: SchemaEntity[] = [
  { table: 'chip_parts', detail: 'canonical full ordering code, package, family, datasheet anchors and parameter spine' },
  { table: 'chip_part_aliases', detail: 'messy buyer text aliases normalized back to one standard part identity' },
  { table: 'inventory_listings', detail: 'seller stock, date code, price lane, sync freshness and promotion flags' },
  { table: 'company_private_profiles', detail: 'private phone and WeChat vault, never exposed in public search views' },
  { table: 'inventory_contact_unlocks', detail: 'append-only record of which buyer company unlocked which source lane' },
  { table: 'bom_parse_jobs', detail: 'AI parse requests, provider metadata, line count and charge outcome' },
  { table: 'bom_parse_lines', detail: 'normalized BOM output rows tied to the source parse job for auditability' },
  { table: 'points_ledger', detail: 'earn/spend records for reveal, top slot, BOM compute and insight access' },
]

export const rfqQueue: QueueItem[] = [
  {
    title: 'Urgent demand pulse: TPS5430DDAR x 18,000',
    meta: 'contact reveal likely within 3h',
    status: 'Priority',
  },
  {
    title: 'Industrial MCU shortage list x 12 lines',
    meta: 'buyer accepts domestic substitution',
    status: 'Open',
  },
  {
    title: 'Medical supply BOM refresh',
    meta: 'needs traceable lot and origin data',
    status: 'In review',
  },
]

export const ledgerPreview: LedgerItem[] = [
  {
    title: 'KYB completed',
    change: '+500 pts',
    note: 'trust baseline established',
  },
  {
    title: 'ERP inventory sync',
    change: '+300 pts',
    note: 'monthly freshness incentive',
  },
  {
    title: 'Seller contact reveal',
    change: '-50 pts',
    note: 'buyer purchased direct channel',
  },
  {
    title: 'BOM parse over free tier',
    change: '-22 pts',
    note: '72 lines parsed today',
  },
]
