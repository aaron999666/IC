import { useDeferredValue, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supplierRows } from '../data/mock'
import { useAuth } from '../lib/auth'
import { unlockInventoryContact } from '../lib/operations'
import { hasSupabasePublicSearch, searchPublicInventory } from '../lib/publicInventory'
import { buildWebPageSchema, useSeo } from '../lib/seo'
import type { SupplierRow } from '../types'

type RevealedContact = {
  seller_company_name: string
  contact_person: string
  phone_number: string
  wechat_id: string | null
  remaining_points: number
}

function MarketPage() {
  const title = '现货搜索 | 芯汇 ICCoreHub'
  const description = '搜索芯汇 ICCoreHub 的公开现货板，查看脱敏库存、批次、价格区间、信用评级与替代料建议。'
  useSeo({
    title,
    description,
    path: '/market',
    schema: buildWebPageSchema('/market', title, description, 'CollectionPage'),
  })

  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') ?? 'STM32F103C8T6'
  const [query, setQuery] = useState(initialQuery)
  const [liveRows, setLiveRows] = useState<SupplierRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [revealError, setRevealError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [revealingInventoryId, setRevealingInventoryId] = useState<string | null>(null)
  const [revealedContacts, setRevealedContacts] = useState<Record<string, RevealedContact>>({})
  const deferredQuery = useDeferredValue(query)
  const { session, selectedCompanyId } = useAuth()

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    if (!hasSupabasePublicSearch) {
      return
    }

    let isCancelled = false

    async function loadLiveRows() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const rows = await searchPublicInventory(initialQuery, 24)

        if (!isCancelled) {
          setLiveRows(rows)
        }
      } catch (error) {
        if (!isCancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load live inventory.')
          setLiveRows([])
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadLiveRows()

    return () => {
      isCancelled = true
    }
  }, [initialQuery])

  const normalizedQuery = deferredQuery.trim().toLowerCase()
  const filteredRows = hasSupabasePublicSearch
    ? liveRows
    : supplierRows.filter((row) => {
        if (!normalizedQuery) {
          return true
        }

        return [row.mpn, row.brand, row.package, row.location]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      })

  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Public market board</p>
          <h1>High-density supply view with seller identity redacted by default.</h1>
        </div>
        <form
          className="toolbar-search"
          onSubmit={(event) => {
            event.preventDefault()
            const nextQuery = query.trim()
            setSearchParams(nextQuery ? { q: nextQuery } : {})
          }}
        >
          <input
            type="search"
            value={query}
            placeholder="Search part number or brand"
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Filter live supply"
          />
          <button type="submit">{isLoading ? 'Loading...' : 'Run search'}</button>
        </form>
      </section>

      <section className="split-grid market-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">SEARCH</span>
            <h2>Result table</h2>
          </div>
          <div className="result-toolbar">
            <span>{filteredRows.length} matched listings</span>
            <span>Contact reveal: 50 pts</span>
            <span>{hasSupabasePublicSearch ? 'Supabase public RPC live' : 'Local demo dataset fallback'}</span>
            <span>{session ? 'Signed-in reveal lane ready' : 'Sign in to unlock contacts'}</span>
          </div>
          {loadError ? <p className="inline-error">{loadError}</p> : null}
          {revealError ? <p className="inline-error">{revealError}</p> : null}
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source lane</th>
                  <th>Credit</th>
                  <th>MPN</th>
                  <th>Brand</th>
                  <th>Package</th>
                  <th>D/C</th>
                  <th>Stock</th>
                  <th>Price</th>
                  <th>Access</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const revealed = row.inventoryId ? revealedContacts[row.inventoryId] : null

                  return (
                    <tr key={`${row.inventoryId ?? row.seller}-${row.mpn}`}>
                      <td>
                        <strong>{revealed?.seller_company_name ?? row.seller}</strong>
                        <span>{row.location}</span>
                      </td>
                      <td>{row.rating}</td>
                      <td>{row.mpn}</td>
                      <td>{row.brand}</td>
                      <td>{row.package}</td>
                      <td>{row.lot}</td>
                      <td>{row.stock}</td>
                      <td>{row.price}</td>
                      <td>
                        {revealed
                          ? `${revealed.contact_person} · ${revealed.phone_number}${revealed.wechat_id ? ` · ${revealed.wechat_id}` : ''}`
                          : row.channel}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="table-action"
                          disabled={!row.inventoryId || revealingInventoryId === row.inventoryId}
                          onClick={async () => {
                            if (!row.inventoryId) {
                              setRevealError('Demo fallback rows cannot reveal live contact data.')
                              return
                            }

                            if (!session) {
                              setRevealError('Sign in with Supabase Auth before unlocking seller contact data.')
                              return
                            }

                            if (!selectedCompanyId) {
                              setRevealError('Select a company context before unlocking a seller contact.')
                              return
                            }

                            setRevealError(null)
                            setRevealingInventoryId(row.inventoryId)

                            try {
                              const revealedContact = await unlockInventoryContact(row.inventoryId, selectedCompanyId)
                              setRevealedContacts((current) => ({
                                ...current,
                                [row.inventoryId!]: {
                                  seller_company_name: revealedContact.seller_company_name,
                                  contact_person: revealedContact.contact_person,
                                  phone_number: revealedContact.phone_number,
                                  wechat_id: revealedContact.wechat_id,
                                  remaining_points: revealedContact.remaining_points,
                                },
                              }))
                            } catch (error) {
                              setRevealError(error instanceof Error ? error.message : 'Failed to unlock seller contact.')
                            } finally {
                              setRevealingInventoryId(null)
                            }
                          }}
                        >
                          {revealed
                            ? `Unlocked · ${revealed.remaining_points} pts left`
                            : revealingInventoryId === row.inventoryId
                              ? 'Unlocking...'
                              : 'Reveal contact'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="content-card sidebar-card">
          <div className="panel-heading">
            <span className="panel-code">EDGE</span>
            <h2>Match intelligence</h2>
          </div>
          <div className="stack-block">
            <h3>Suggested substitute</h3>
            <p>GD32F103C8T6</p>
            <span>package-compatible, lower unit cost, domestic availability strong</span>
          </div>
          <div className="stack-block">
            <h3>Reference price lane</h3>
            <p>CNY 7.28 - 7.45 / pcs</p>
            <span>based on the lowest public lane visible in the board</span>
          </div>
          <div className="stack-block">
            <h3>Reveal guardrail</h3>
            <p>Phone and WeChat stay server-side until point deduction passes.</p>
            <span>public search never exposes direct seller identity by default</span>
          </div>
        </aside>
      </section>
    </main>
  )
}

export default MarketPage
