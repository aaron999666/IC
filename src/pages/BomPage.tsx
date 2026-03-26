import { useState } from 'react'
import { bomDictionary } from '../data/mock'

const sampleBom = `STM32 F103 C8 T6, 8000
MAX 3232ESE, 12000
TPS7A4701RGWT, 2000
ESP32S3 WROOM 1 N8R8, 1600`

function normalizeToken(value: string) {
  return value.replace(/[^a-zA-Z0-9+]/g, '').toUpperCase()
}

function parseBomLine(line: string) {
  const trimmed = line.trim()

  if (!trimmed) {
    return null
  }

  const [mpnPart, quantityPart] = trimmed.split(/[,\t]/)
  const quantity = quantityPart?.trim() || '--'
  const lookupKey = normalizeToken(mpnPart ?? trimmed)

  const match = bomDictionary.find((item) => {
    const candidates = [item.normalized, ...item.alias]
    return candidates.some((candidate) => normalizeToken(candidate) === lookupKey)
  })

  return {
    input: trimmed,
    quantity,
    normalized: match?.normalized ?? 'No exact hit',
    brand: match?.brand ?? 'Manual review',
    package: match?.package ?? '--',
    availability: match?.availability ?? 'Needs crawl / datasheet extraction',
    replacement: match?.replacement ?? 'No suggestion yet',
  }
}

function BomPage() {
  const [text, setText] = useState(sampleBom)

  const parsedRows = text
    .split('\n')
    .map(parseBomLine)
    .filter((row): row is NonNullable<ReturnType<typeof parseBomLine>> => row !== null)

  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">AI BOM lane</p>
          <h1>Normalize hand-written BOM lines into searchable supply intent.</h1>
        </div>
        <div className="note-card">
          <span>Free tier</span>
          <strong>First 50 rows free</strong>
          <p>extra rows consume 1 point each</p>
        </div>
      </section>

      <section className="split-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">INPUT</span>
            <h2>Paste or drop source material</h2>
          </div>
          <textarea
            className="bom-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            aria-label="BOM input"
          />
          <div className="drop-zone compact-drop">
            <div>
              <strong>Upload Excel or CSV</strong>
              <span>file parsing hook reserved for next phase</span>
            </div>
            <button type="button" className="ghost-link strong-link">
              Connect parser
            </button>
          </div>
        </article>

        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">PARSE</span>
            <h2>Structured preview</h2>
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Input</th>
                  <th>Qty</th>
                  <th>Normalized MPN</th>
                  <th>Brand</th>
                  <th>Package</th>
                  <th>Availability</th>
                  <th>Alt</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row) => (
                  <tr key={row.input}>
                    <td>{row.input}</td>
                    <td>{row.quantity}</td>
                    <td>{row.normalized}</td>
                    <td>{row.brand}</td>
                    <td>{row.package}</td>
                    <td>{row.availability}</td>
                    <td>{row.replacement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  )
}

export default BomPage
