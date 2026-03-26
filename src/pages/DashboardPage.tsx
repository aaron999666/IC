import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { loadAdminAiConsole } from '../lib/adminConsole'
import {
  getPointsBalance,
  getRecentPointsLedger,
  listUnlockedInventoryContacts,
} from '../lib/operations'
import { buildWebPageSchema, useSeo } from '../lib/seo'
import type {
  AdminAiProviderConfig,
  ContactUnlockRecord,
  PointsLedgerEntry,
} from '../types'

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '--'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatPoints(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function formatLedgerDelta(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatPoints(value)} pts`
}

function DashboardPage() {
  const title = '运营工作台 | 芯汇 ICCoreHub'
  const description = '查看积分余额、联系方式解锁历史、最近扣费流水和 AI 管理后台状态。'

  useSeo({
    title,
    description,
    path: '/dashboard',
    robots: 'noindex, nofollow, max-image-preview:large',
    schema: buildWebPageSchema('/dashboard', title, description),
  })

  const {
    isConfigured,
    isReady,
    session,
    selectedCompanyId,
    selectedCompanyName,
    selectedRole,
    isAdmin,
  } = useAuth()

  const [pointsBalance, setPointsBalance] = useState<number>(0)
  const [ledgerEntries, setLedgerEntries] = useState<PointsLedgerEntry[]>([])
  const [unlockHistory, setUnlockHistory] = useState<ContactUnlockRecord[]>([])
  const [adminConfigs, setAdminConfigs] = useState<AdminAiProviderConfig[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConfigured || !isReady || !session || !selectedCompanyId) {
      return
    }

    const companyId = selectedCompanyId
    const accessToken = session.access_token
    let isCancelled = false

    async function loadPrivateDashboard() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const [balance, ledger, unlocks, adminConsole] = await Promise.all([
          getPointsBalance(companyId),
          getRecentPointsLedger(companyId, 8),
          listUnlockedInventoryContacts(companyId, 8),
          isAdmin && accessToken
            ? loadAdminAiConsole(accessToken, 8)
            : Promise.resolve({ configs: [], auditLogs: [] }),
        ])

        if (isCancelled) {
          return
        }

        setPointsBalance(balance)
        setLedgerEntries(ledger)
        setUnlockHistory(unlocks)
        setAdminConfigs(adminConsole.configs)
      } catch (error) {
        if (!isCancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load private dashboard data.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadPrivateDashboard()

    return () => {
      isCancelled = true
    }
  }, [isAdmin, isConfigured, isReady, selectedCompanyId, session])

  const enabledProviders = adminConfigs
    .filter((config) => config.enabled)
    .sort((left, right) => left.priority - right.priority)

  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Ops desk</p>
          <h1>Run points, contact reveal and AI routing from one private console.</h1>
        </div>
        <div className="note-card">
          <span>Company context</span>
          <strong>{selectedCompanyName ?? 'No company selected'}</strong>
          <p>{selectedRole ? `Role: ${selectedRole}` : 'Select a company membership to load private data.'}</p>
        </div>
      </section>

      {!isConfigured ? (
        <section className="content-card">
          <p className="inline-error">当前环境没有配置 Supabase 前端变量，后台私有能力无法加载。</p>
        </section>
      ) : null}

      {loadError ? (
        <section className="content-card">
          <p className="inline-error">{loadError}</p>
        </section>
      ) : null}

      <section className="summary-grid">
        <article className="content-card summary-card">
          <span className="panel-code">POINTS</span>
          <strong>{formatPoints(pointsBalance)}</strong>
          <p>Current company balance</p>
          <span>{isLoading ? 'Loading private ledger...' : 'Real balance from `points_accounts`.'}</span>
        </article>
        <article className="content-card summary-card">
          <span className="panel-code">UNLOCKS</span>
          <strong>{unlockHistory.length}</strong>
          <p>Recent contact reveals</p>
          <span>{unlockHistory[0] ? `${unlockHistory[0].standard_part_number} · ${formatDateTime(unlockHistory[0].unlocked_at)}` : 'No private reveal history yet.'}</span>
        </article>
        <article className="content-card summary-card">
          <span className="panel-code">LEDGER</span>
          <strong>{ledgerEntries.length}</strong>
          <p>Recent ledger rows</p>
          <span>{ledgerEntries[0] ? `${ledgerEntries[0].event_type} · ${formatLedgerDelta(ledgerEntries[0].delta)}` : 'No points events yet.'}</span>
        </article>
        <article className="content-card summary-card">
          <span className="panel-code">AI</span>
          <strong>{enabledProviders[0]?.display_name ?? 'No primary'}</strong>
          <p>Current primary engine</p>
          <span>{enabledProviders[0] ? `${enabledProviders[0].model} · ${enabledProviders[0].last_test_status ?? 'untested'}` : 'Admin console available for AI routing.'}</span>
        </article>
      </section>

      <section className="split-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">LEDGER</span>
            <h2>Recent points activity</h2>
          </div>
          {ledgerEntries.length > 0 ? (
            <ul className="queue-list ledger-list">
              {ledgerEntries.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.event_type}</strong>
                    <p>{item.reference_table ? `${item.reference_table} · ${formatDateTime(item.created_at)}` : formatDateTime(item.created_at)}</p>
                  </div>
                  <span>{formatLedgerDelta(item.delta)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="status-detail">No points ledger rows are visible for the current company yet.</p>
          )}
        </article>

        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">REVEAL</span>
            <h2>Unlocked contact history</h2>
          </div>
          {unlockHistory.length > 0 ? (
            <div className="audit-list">
              {unlockHistory.map((item) => (
                <article key={item.unlock_id} className="audit-item">
                  <div className="audit-item-topline">
                    <div>
                      <strong>{item.standard_part_number}</strong>
                      <span>{item.brand} · {item.package_type ?? '--'}</span>
                    </div>
                    <span>{formatDateTime(item.unlocked_at)}</span>
                  </div>
                  <p>{item.seller_company_name} · {item.contact_person} · {item.phone_number}{item.wechat_id ? ` · WeChat ${item.wechat_id}` : ''}</p>
                  <div className="audit-meta">
                    <span>{formatPoints(item.points_spent)} pts spent</span>
                    <span>Credit {item.seller_credit_score} / 5</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="status-detail">No contact has been unlocked by the current company yet.</p>
          )}
        </article>
      </section>

      <section className="split-grid lower-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">AI CONTROL</span>
            <h2>Provider routing snapshot</h2>
          </div>
          {enabledProviders.length > 0 ? (
            <div className="audit-list">
              {enabledProviders.map((config) => (
                <article key={config.provider} className="audit-item">
                  <div className="audit-item-topline">
                    <div>
                      <strong>{config.display_name}</strong>
                      <span>{config.model}</span>
                    </div>
                    <span>Priority {config.priority}</span>
                  </div>
                  <p>{config.last_test_message ?? 'No connectivity test recorded yet.'}</p>
                  <div className="audit-meta">
                    <span>Mode: {config.request_mode}</span>
                    <span>Last test: {config.last_tested_at ? formatDateTime(config.last_tested_at) : 'not run'}</span>
                    <span>Status: {config.last_test_status ?? 'unknown'}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="status-detail">AI provider routing data becomes visible here for admin-role operators.</p>
          )}
          {isAdmin ? (
            <Link className="inline-link" to="/admin/ai">
              Open AI provider admin console
            </Link>
          ) : null}
        </article>

        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">WORKFLOW</span>
            <h2>Operational loop</h2>
          </div>
          <ul className="plain-list">
            <li>Buyers unlock seller contacts from the market board through a server-side RPC with points deduction.</li>
            <li>The same company then sees the deducted points and the unlocked contact in this dashboard.</li>
            <li>Admin-role operators can switch to `/admin/ai` to tune primary and backup engines, then come back here to watch the latest test status.</li>
          </ul>
        </article>
      </section>
    </main>
  )
}

export default DashboardPage
