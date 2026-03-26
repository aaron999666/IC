import type { SupplierRow } from '../types'

interface PublicInventoryRpcRow {
  inventory_listing_id: string
  standard_part_number: string
  brand: string
  package_type: string | null
  description: string | null
  available_quantity: number | null
  moq: number | null
  date_code: string | null
  lot_code: string | null
  currency: string | null
  display_price_min: number | null
  display_price_max: number | null
  masked_price: string | null
  seller_credit_score: number | null
  supports_escrow: boolean
  is_promoted: boolean
  promoted_until: string | null
  warehouse_country_code: string | null
  warehouse_city: string | null
  sync_freshness_at: string | null
  created_at: string
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const hasSupabasePublicSearch = Boolean(supabaseUrl && supabaseAnonKey)

function formatInteger(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--'
  }

  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function buildLocation(city: string | null, countryCode: string | null) {
  return [city, countryCode].filter(Boolean).join(', ') || '--'
}

function mapRpcRowToSupplierRow(row: PublicInventoryRpcRow): SupplierRow {
  const creditScore = row.seller_credit_score ?? 5

  return {
    seller: row.is_promoted ? 'Promoted source lane' : 'Identity hidden',
    rating: `${creditScore} / 5`,
    mpn: row.standard_part_number,
    brand: row.brand,
    package: row.package_type ?? '--',
    lot: row.date_code ?? row.lot_code ?? '--',
    stock: formatInteger(row.available_quantity),
    price: row.masked_price ?? 'Negotiable',
    channel: row.supports_escrow ? 'Protected lane' : 'Reveal-on-demand',
    location: buildLocation(row.warehouse_city, row.warehouse_country_code),
  }
}

export async function searchPublicInventory(searchTerm: string, limitCount = 20) {
  if (!hasSupabasePublicSearch || !supabaseUrl || !supabaseAnonKey) {
    return []
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/search_public_inventory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      search_term: searchTerm.trim() || null,
      limit_count: limitCount,
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | PublicInventoryRpcRow[]
    | { message?: string }
    | null

  if (!response.ok) {
    const message =
      payload && !Array.isArray(payload) ? payload.message : 'Failed to load public inventory.'

    throw new Error(message ?? 'Failed to load public inventory.')
  }

  return (payload as PublicInventoryRpcRow[]).map(mapRpcRowToSupplierRow)
}
