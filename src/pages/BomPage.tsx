import { startTransition, useState } from 'react'
import type { BomParseResponse } from '../types'

const sampleBom = `老板在吗？帮我找下ST的单片机 stm32f103 c8t6，要原装，大概5k左右。
还有一个德州仪器的电源芯片，tps5430ddar，封装SOP-8，先来2000个。
对了，那个ST的单片机再加2000个，客户要加单。
随便看看有没有 max3232cdr，没写数量。`

function BomPage() {
  const [text, setText] = useState(sampleBom)
  const [result, setResult] = useState<BomParseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleParse() {
    const trimmed = text.trim()
    if (!trimmed) {
      setError('Please paste some BOM text before running the parser.')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/bom/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: trimmed }),
      })

      const payload = (await response.json().catch(() => null)) as
        | BomParseResponse
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload && 'error' in payload ? payload.error ?? 'BOM parse failed.' : 'BOM parse failed.')
      }

      startTransition(() => {
        setResult(payload as BomParseResponse)
      })
    } catch (parseError) {
      const message =
        parseError instanceof Error ? parseError.message : 'BOM parse request failed.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">AI BOM lane</p>
          <h1>Run the live dual-engine parser against dirty sourcing text.</h1>
        </div>
        <div className="note-card">
          <span>Engine lane</span>
          <strong>{result?.provider_used ?? 'Gemini first'}</strong>
          <p>{result?.fallback_used ? 'Workers AI backup used' : 'Workers AI standby'}</p>
        </div>
      </section>

      <section className="split-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">INPUT</span>
            <h2>Paste buyer chatter, spreadsheet scraps or RFQ text</h2>
          </div>
          <textarea
            className="bom-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            aria-label="BOM input"
          />
          <div className="bom-actions">
            <button type="button" className="primary-action" onClick={handleParse} disabled={isLoading}>
              {isLoading ? 'Parsing with AI...' : 'Run AI parse'}
            </button>
            <button
              type="button"
              className="ghost-link"
              onClick={() => {
                setText(sampleBom)
                setError(null)
              }}
            >
              Reset sample
            </button>
          </div>
          <div className="drop-zone compact-drop">
            <div>
              <strong>Primary: Gemini 1.5 Flash</strong>
              <span>Backup: Cloudflare Workers AI inside the same edge runtime</span>
            </div>
            <span className="inline-meta">Prompt version: {result?.prompt_version ?? 'industry-cn-v3-dual-engine'}</span>
          </div>
          {error ? <p className="inline-error">{error}</p> : null}
        </article>

        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">PARSE</span>
            <h2>Structured output</h2>
          </div>
          <div className="result-toolbar">
            <span>{result?.items.length ?? 0} normalized lines</span>
            <span>{result ? `${result.billable_lines} billable lines` : 'Ready to parse'}</span>
            <span>{result ? `${result.free_lines} free lines per request` : 'Dual-engine standby'}</span>
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Standard MPN</th>
                  <th>Brand</th>
                  <th>Qty</th>
                  <th>Package</th>
                </tr>
              </thead>
              <tbody>
                {(result?.items ?? []).map((row) => (
                  <tr key={`${row.standard_part_number}-${row.package_type ?? 'na'}`}>
                    <td>{row.standard_part_number ?? '--'}</td>
                    <td>{row.brand ?? '--'}</td>
                    <td>{row.quantity ?? '--'}</td>
                    <td>{row.package_type ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="engine-attempts">
            {(result?.providers_tried ?? []).map((attempt) => (
              <div
                key={`${attempt.provider}-${attempt.model}`}
                className={attempt.ok ? 'attempt-chip attempt-chip-success' : 'attempt-chip attempt-chip-failure'}
              >
                <strong>{attempt.provider}</strong>
                <span>{attempt.model}</span>
                <small>{attempt.ok ? 'success' : attempt.error ?? 'failed'}</small>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}

export default BomPage
