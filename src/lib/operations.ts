import type {
  ContactUnlockRecord,
  PointsLedgerEntry,
} from '../types'
import { supabase } from './supabase'

type UnlockInventoryContactResult = {
  inventory_listing_id: string
  seller_company_id: string
  seller_company_name: string
  contact_person: string
  phone_number: string
  wechat_id: string | null
  seller_credit_score: number
  points_spent: number
  remaining_points: number
}

export async function getPointsBalance(companyId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('points_accounts')
    .select('balance')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return ((data as { balance: number } | null)?.balance ?? 0)
}

export async function getRecentPointsLedger(companyId: string, limit = 8) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('points_ledger')
    .select('id, event_type, delta, reference_table, reference_id, metadata, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []) as PointsLedgerEntry[]
}

export async function listUnlockedInventoryContacts(companyId: string, limit = 8) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase.rpc('list_unlocked_inventory_contacts', {
    p_requester_company_id: companyId,
    limit_count: limit,
  })

  if (error) {
    throw error
  }

  return (data ?? []) as ContactUnlockRecord[]
}

export async function unlockInventoryContact(inventoryListingId: string, companyId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase.rpc('unlock_inventory_contact', {
    p_target_inventory_id: inventoryListingId,
    p_requester_company_id: companyId,
  })

  if (error) {
    throw error
  }

  const row = (data?.[0] ?? null) as UnlockInventoryContactResult | null

  if (!row) {
    throw new Error('Unlock completed without returning contact details.')
  }

  return row
}

export async function getInventoryContactUnlocks(companyId: string, limit = 8) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('inventory_contact_unlocks')
    .select('id, inventory_listing_id, points_spent, created_at')
    .eq('requester_company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []) as Array<{
    id: string
    inventory_listing_id: string
    points_spent: number
    created_at: string
  }>
}
