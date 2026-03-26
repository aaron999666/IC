import { useDeferredValue, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supplierRows } from '../data/mock'

function MarketPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') ?? 'STM32F103C8T6'
  const [query, setQuery] = useState(initialQuery)
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  const normalizedQuery = deferredQuery.trim().toLowerCase()
  const filteredRows = supplierRows.filter((row) => {
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
          <p className="eyebrow">Live market board</p>
          <h1>High-density result view built for sourcing speed.</h1>
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
          <button type="submit">Refresh board</button>
        </form>
      </section>

      <section className="split-grid market-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">RFQ</span>
            <h2>Result table</h2>
          </div>
          <div className="result-toolbar">
            <span>{filteredRows.length} matched sellers</span>
            <span>Contact reveal: 50 pts</span>
            <span>Escrow-preferred supply highlighted</span>
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Rating</th>
                  <th>MPN</th>
                  <th>Brand</th>
                  <th>Package</th>
                  <th>D/C</th>
                  <th>Stock</th>
                  <th>Price</th>
                  <th>Trade</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={`${row.seller}-${row.mpn}`}>
                    <td>
                      <strong>{row.seller}</strong>
                      <span>{row.location}</span>
                    </td>
                    <td>{row.rating}</td>
                    <td>{row.mpn}</td>
                    <td>{row.brand}</td>
                    <td>{row.package}</td>
                    <td>{row.lot}</td>
                    <td>{row.stock}</td>
                    <td>{row.price}</td>
                    <td>{row.escrow}</td>
                    <td>
                      <button type="button" className="table-action">
                        Reveal contact
                      </button>
                    </td>
                  </tr>
                ))}
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
            <p>RMB 7.28 - 7.45 / pcs</p>
            <span>based on live stock visible in the marketplace skeleton</span>
          </div>
          <div className="stack-block">
            <h3>Compliance gate</h3>
            <p>Escrow + traceable lot recommended</p>
            <span>critical for high-value or export-controlled programs</span>
          </div>
        </aside>
      </section>
    </main>
  )
}

export default MarketPage
