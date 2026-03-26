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
    label: 'Weekly escrow GMV',
    value: 'RMB 28.4M',
    note: '91.2% released in 72h',
  },
  {
    label: 'Buyer RFQs matched',
    value: '3,904',
    note: 'avg first quote in 11 min',
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
    seller: 'Delta Logic HK',
    rating: 'AAA',
    mpn: 'STM32F103C8T6',
    brand: 'STMicroelectronics',
    package: 'LQFP-48',
    lot: '2418+',
    stock: '32,400',
    price: '7.28 / pcs',
    escrow: 'Supported',
    location: 'Shenzhen',
  },
  {
    seller: 'NexWave Components',
    rating: 'AA+',
    mpn: 'STM32F103C8T6',
    brand: 'STMicroelectronics',
    package: 'LQFP-48',
    lot: '2422+',
    stock: '11,200',
    price: '7.45 / pcs',
    escrow: 'Supported',
    location: 'Hong Kong',
  },
  {
    seller: 'Blue Peak Semi',
    rating: 'AAA',
    mpn: 'GD32F103C8T6',
    brand: 'GigaDevice',
    package: 'LQFP-48',
    lot: '2501+',
    stock: '48,000',
    price: '4.12 / pcs',
    escrow: 'Supported',
    location: 'Suzhou',
  },
  {
    seller: 'Orbit Source BV',
    rating: 'AA',
    mpn: 'MAX3232ESE+T',
    brand: 'Analog Devices',
    package: 'SOIC-16',
    lot: '2437+',
    stock: '9,850',
    price: '2.61 / pcs',
    escrow: 'Manual release',
    location: 'Rotterdam',
  },
  {
    seller: 'Asterix Semiconductor',
    rating: 'AAA',
    mpn: 'TPS7A4701RGWT',
    brand: 'Texas Instruments',
    package: 'VQFN-20',
    lot: '2411+',
    stock: '6,480',
    price: '13.90 / pcs',
    escrow: 'Supported',
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
    title: 'Private quote rails',
    body: 'Attach seller inventory, RFQ threads and escrow orders through RLS so sensitive pricing never leaks laterally.',
  },
]

export const schemaEntities: SchemaEntity[] = [
  { table: 'chip_family', detail: 'canonical family, vendor, lifecycle, datasheet anchors' },
  { table: 'chip_sku', detail: 'full ordering code, package, temperature, tape-tube-tray metadata' },
  { table: 'cross_reference', detail: 'replacement score, compatibility rationale, risk tags, validation source' },
  { table: 'seller_inventory', detail: 'seller mapping, lot code, stock, MOQ, sync freshness, warehouse region' },
  { table: 'rfq_thread', detail: 'buyer intent, target price, urgency, matched sellers, response SLA' },
  { table: 'quote', detail: 'private offer, escrow support, incoterms, visibility scoped by RLS' },
  { table: 'escrow_order', detail: 'payment hold, QC checkpoint, release milestone, dispute state' },
  { table: 'points_ledger', detail: 'earn/spend records for reveal, top slot, BOM compute, insights' },
]

export const rfqQueue: QueueItem[] = [
  {
    title: 'Automotive RFQ: TPS5430DDAR x 18,000',
    meta: 'target close in 3h · escrow required',
    status: 'Priority',
  },
  {
    title: 'Industrial MCU shortage list x 12 lines',
    meta: 'buyer accepts domestic substitution',
    status: 'Open',
  },
  {
    title: 'Medical supply BOM refresh',
    meta: 'needs traceable lot and COO',
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
