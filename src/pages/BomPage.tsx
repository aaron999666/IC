import { startTransition, useState } from 'react'
import RechargePromptModal from '../components/RechargePromptModal'
import { useAuth } from '../lib/auth'
import { isInsufficientPointsMessage } from '../lib/billing'
import { buildWebPageSchema, useSeo } from '../lib/seo'
import type { BomParseResponse } from '../types'

const sampleBom = `老板在吗？帮我找下ST的单片机 stm32f103 c8t6，要原装，大概5k左右。
还有一个德州仪器的电源芯片，tps5430ddar，封装SOP-8，先来2000个。
对了，那个ST的单片机再加2000个，客户要加单。
随便看看有没有 max3232cdr，没写数量。`

function BomPage() {
  const title = 'AI BOM解析 | 芯汇 ICCoreHub'
  const description = '使用芯汇 ICCoreHub 的双引擎 AI BOM 解析能力，把脏数据清洗为标准料号、数量、品牌与封装信息。'
  useSeo({
    title,
    description,
    path: '/bom',
    schema: buildWebPageSchema('/bom', title, description),
  })

  const [text, setText] = useState(sampleBom)
  const [persistResult, setPersistResult] = useState(true)
  const [chargePoints, setChargePoints] = useState(true)
  const [result, setResult] = useState<BomParseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showRechargePrompt, setShowRechargePrompt] = useState(false)
  const { selectedCompanyId, session, selectedCompanyName } = useAuth()

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
        body: JSON.stringify({
          text: trimmed,
          buyerCompanyId: selectedCompanyId || undefined,
          submittedByUserId: session?.user.id || undefined,
          persistResult,
          chargePoints,
        }),
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

      if (isInsufficientPointsMessage(message)) {
        setShowRechargePrompt(true)
      }
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
          <div className="drop-zone compact-drop">
            <div>
              <strong>{selectedCompanyName ?? 'No authenticated company context'}</strong>
              <span>{session ? `Parser requests will persist under user ${session.user.email ?? session.user.id}` : 'Sign in to persist BOM jobs and charge real points.'}</span>
            </div>
            <span className="inline-meta">
              {selectedCompanyId ? `company ${selectedCompanyId}` : 'No company selected'}
            </span>
          </div>
          <div className="checkbox-row">
            <label>
              <input
                type="checkbox"
                checked={persistResult}
                onChange={(event) => setPersistResult(event.target.checked)}
              />
              Persist result to Supabase
            </label>
            <label>
              <input
                type="checkbox"
                checked={chargePoints}
                onChange={(event) => setChargePoints(event.target.checked)}
              />
              Charge billable lines to points ledger
            </label>
          </div>
          <div className="bom-actions">
            <button type="button" className="primary-action" onClick={handleParse} disabled={isLoading}>
              {isLoading ? 'Parsing with AI...' : 'Run AI parse'}
            </button>
            <button
              type="button"
              className="ghost-link"
              onClick={() => {
                setText(sampleBom)
                setPersistResult(true)
                setChargePoints(true)
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
            <span className="inline-meta">
              Prompt version: {result?.prompt_version ?? 'industry-cn-v3-dual-engine'}
            </span>
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
            <span>
              {result?.storage
                ? `${result.storage.points_charged} pts charged`
                : 'Supabase storage optional'}
            </span>
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
          {result?.storage ? (
            <p className="status-detail">
              Storage status: <strong>{result.storage.status}</strong>
              {result.storage.job_id ? ` · job ${result.storage.job_id}` : ''}
              {result.storage.skipped_reason ? ` · ${result.storage.skipped_reason}` : ''}
              {result.storage.error ? ` · ${result.storage.error}` : ''}
            </p>
          ) : null}
          <div className="engine-attempts">
            {result?.storage ? (
              <div
                className={
                  result.storage.persisted
                    ? 'attempt-chip attempt-chip-success'
                    : 'attempt-chip attempt-chip-neutral'
                }
              >
                <strong>storage</strong>
                <span>{result.storage.status}</span>
                <small>
                  {result.storage.job_id
                    ? `job ${result.storage.job_id}`
                    : result.storage.skipped_reason ?? result.storage.error ?? 'ready'}
                </small>
              </div>
            ) : null}
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

      <RechargePromptModal
        open={showRechargePrompt}
        title="积分不足，无法继续计费解析"
        body="本次 BOM 存在超出免费额度的计费行，当前企业积分不足，暂时无法完成扣费入账。完成充值后可以直接重新发起解析。"
        companyName={selectedCompanyName ?? null}
        onClose={() => setShowRechargePrompt(false)}
      />
    </main>
  )
}

export default BomPage
