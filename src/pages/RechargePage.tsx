import { useEffect, useMemo, useState } from 'react'
import {
  BILLING_PORTAL_URL,
  RECHARGE_PACKAGES,
  canManageBilling,
  createRechargeOrder,
  formatMoneyCny,
  listRechargeOrders,
} from '../lib/billing'
import { useAuth } from '../lib/auth'
import { getPointsBalance } from '../lib/operations'
import { buildWebPageSchema, useSeo } from '../lib/seo'
import type { RechargeOrder } from '../types'

function formatPoints(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

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

function statusLabel(status: RechargeOrder['status']) {
  switch (status) {
    case 'pending':
      return '待支付'
    case 'processing':
      return '处理中'
    case 'paid':
      return '已到账'
    case 'cancelled':
      return '已取消'
    case 'expired':
      return '已过期'
    case 'failed':
      return '支付失败'
    default:
      return status
  }
}

function RechargePage() {
  const title = '积分充值中心 | 芯汇 ICCoreHub'
  const description = '查看当前积分余额、创建充值单，并跳转到国内备案支付入口完成法币充值。'

  useSeo({
    title,
    description,
    path: '/recharge',
    robots: 'noindex, nofollow, max-image-preview:large',
    schema: buildWebPageSchema('/recharge', title, description),
  })

  const {
    isConfigured,
    session,
    selectedCompanyId,
    selectedCompanyName,
    selectedRole,
  } = useAuth()
  const [balance, setBalance] = useState(0)
  const [orders, setOrders] = useState<RechargeOrder[]>([])
  const [selectedAmount, setSelectedAmount] = useState<number>(RECHARGE_PACKAGES[1].amountCny)
  const [paymentChannel, setPaymentChannel] = useState('alipay_qr')
  const [note, setNote] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [latestOrder, setLatestOrder] = useState<RechargeOrder | null>(null)

  const billingAccess = canManageBilling(selectedRole)

  const selectedPackage = useMemo(
    () => RECHARGE_PACKAGES.find((item) => item.amountCny === selectedAmount) ?? null,
    [selectedAmount],
  )

  useEffect(() => {
    if (!isConfigured || !session || !selectedCompanyId || !billingAccess) {
      return
    }

    const companyId = selectedCompanyId
    const accessToken = session.access_token
    let isCancelled = false

    async function loadBillingDesk() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const [nextBalance, nextOrders] = await Promise.all([
          getPointsBalance(companyId),
          listRechargeOrders(accessToken, companyId, 12),
        ])

        if (isCancelled) {
          return
        }

        setBalance(nextBalance)
        setOrders(nextOrders)
      } catch (error) {
        if (!isCancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load recharge data.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadBillingDesk()

    return () => {
      isCancelled = true
    }
  }, [billingAccess, isConfigured, selectedCompanyId, session])

  async function handleCreateOrder() {
    if (!session || !selectedCompanyId) {
      setSubmitError('Sign in and select a company before creating a recharge order.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const created = await createRechargeOrder(session.access_token, {
        companyId: selectedCompanyId,
        amountCny: selectedAmount,
        paymentChannel,
        note,
      })

      setLatestOrder(created)
      setOrders((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setNote('')
      window.open(created.payment_url ?? BILLING_PORTAL_URL, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create recharge order.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Recharge</p>
          <h1>Top up points through the domestic payment rail.</h1>
        </div>
        <div className="note-card">
          <span>Current balance</span>
          <strong>{formatPoints(balance)} pts</strong>
          <p>{selectedCompanyName ?? 'No company selected'}</p>
        </div>
      </section>

      {!billingAccess ? (
        <section className="content-card">
          <p className="inline-error">当前账号不是财务/管理员角色，暂不开放充值单创建与支付轨迹查看。</p>
          <p className="section-copy">
            充值记录属于企业敏感信息，建议使用 `owner / admin / finance / ops` 角色进入该页面。
          </p>
        </section>
      ) : null}

      <section className="split-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">PAYMENT FLOW</span>
            <h2>Create a domestic recharge order</h2>
          </div>
          <ul className="plain-list">
            <li>主站继续处理现货搜索、BOM 解析和积分消费，不直接碰法币支付流程。</li>
            <li>你在这里先生成充值单，再跳转到 `pay.iccorehub.com` 完成支付宝、微信或对公转账。</li>
            <li>国内支付服务成功回调后，会自动把积分写回 `points_ledger` 和 `points_accounts`。</li>
          </ul>
          <div className="package-grid">
            {RECHARGE_PACKAGES.map((item) => (
              <button
                key={item.amountCny}
                type="button"
                className={selectedAmount === item.amountCny ? 'package-card package-card-active' : 'package-card'}
                onClick={() => setSelectedAmount(item.amountCny)}
              >
                <strong>{item.label}</strong>
                <span>{formatPoints(item.amountCny * 10)} pts</span>
                <small>{item.note}</small>
              </button>
            ))}
          </div>
          <div className="control-grid">
            <label className="field-stack">
              <span>Payment channel</span>
              <select
                className="admin-select"
                value={paymentChannel}
                onChange={(event) => setPaymentChannel(event.target.value)}
              >
                <option value="alipay_qr">Alipay QR</option>
                <option value="wechat_qr">WeChat Pay QR</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </label>
            <label className="field-stack">
              <span>Selected package</span>
              <input
                value={`${formatMoneyCny(selectedAmount)} CNY / ${formatPoints(selectedAmount * 10)} pts`}
                readOnly
              />
            </label>
            <label className="field-stack field-span-2">
              <span>Operator note</span>
              <textarea
                className="textarea-input"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="例如：Q2 采购团队找货预算 / 财务复核单号"
              />
            </label>
          </div>
          <div className="form-toolbar">
            <button
              type="button"
              className="primary-action inline-link-button"
              onClick={() => void handleCreateOrder()}
              disabled={!billingAccess || isSubmitting}
            >
              {isSubmitting ? 'Creating order...' : 'Create recharge order'}
            </button>
            <a
              className="secondary-action inline-link-button"
              href={latestOrder?.payment_url ?? BILLING_PORTAL_URL}
              target="_blank"
              rel="noreferrer"
            >
              Open pay.iccorehub.com
            </a>
          </div>
          {selectedPackage ? (
            <p className="status-detail">
              当前套餐：<strong>{selectedPackage.label}</strong>，到账后预计增加{' '}
              <strong>{formatPoints(selectedAmount * 10)} pts</strong>。
            </p>
          ) : null}
          {submitError ? <p className="inline-error">{submitError}</p> : null}
          {latestOrder ? (
            <div className="stack-block compact-stack">
              <h3>Latest order</h3>
              <p>{latestOrder.order_no}</p>
              <span>
                {statusLabel(latestOrder.status)} · {formatMoneyCny(latestOrder.amount_cny)} CNY ·{' '}
                {formatPoints(latestOrder.total_points)} pts
              </span>
            </div>
          ) : null}
        </article>

        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">ORDER TRACK</span>
            <h2>Recent recharge orders</h2>
          </div>
          {loadError ? <p className="inline-error">{loadError}</p> : null}
          {orders.length > 0 ? (
            <div className="audit-list">
              {orders.map((order) => (
                <article key={order.id} className="audit-item">
                  <div className="audit-item-topline">
                    <div>
                      <strong>{order.order_no}</strong>
                      <span>{formatMoneyCny(order.amount_cny)} CNY · {formatPoints(order.total_points)} pts</span>
                    </div>
                    <span>{statusLabel(order.status)}</span>
                  </div>
                  <p>
                    {order.payment_channel ?? '--'} · 创建于 {formatDateTime(order.created_at)}
                    {order.paid_at ? ` · 支付于 ${formatDateTime(order.paid_at)}` : ''}
                    {order.credited_at ? ` · 入账于 ${formatDateTime(order.credited_at)}` : ''}
                  </p>
                  <div className="audit-meta">
                    <span>{order.external_trade_no ?? 'No external trade no yet'}</span>
                    <span>{order.note ?? 'No operator note'}</span>
                  </div>
                  <div className="form-toolbar">
                    <a
                      className="secondary-action inline-link-button"
                      href={order.payment_url ?? BILLING_PORTAL_URL}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Continue payment
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="status-detail">
              {isLoading ? 'Loading recharge orders...' : 'No recharge order has been created for the current company yet.'}
            </p>
          )}
        </article>
      </section>
    </main>
  )
}

export default RechargePage
