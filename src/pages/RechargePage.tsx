import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { BILLING_PORTAL_URL } from '../lib/billing'
import { getPointsBalance } from '../lib/operations'
import { buildWebPageSchema, useSeo } from '../lib/seo'

function formatPoints(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function RechargePage() {
  const title = '积分充值中心 | 芯汇 ICCoreHub'
  const description = '查看当前积分余额，并跳转到国内备案支付入口完成法币充值。'

  useSeo({
    title,
    description,
    path: '/recharge',
    robots: 'noindex, nofollow, max-image-preview:large',
    schema: buildWebPageSchema('/recharge', title, description),
  })

  const { isConfigured, selectedCompanyId, selectedCompanyName } = useAuth()
  const [balance, setBalance] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConfigured || !selectedCompanyId) {
      return
    }

    const companyId = selectedCompanyId
    let isCancelled = false

    async function loadBalance() {
      try {
        const nextBalance = await getPointsBalance(companyId)
        if (!isCancelled) {
          setBalance(nextBalance)
        }
      } catch (error) {
        if (!isCancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load current points balance.')
        }
      }
    }

    void loadBalance()

    return () => {
      isCancelled = true
    }
  }, [isConfigured, selectedCompanyId])

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

      <section className="split-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">PAYMENT FLOW</span>
            <h2>How this rail is split</h2>
          </div>
          <ul className="plain-list">
            <li>主站继续处理现货搜索、BOM 解析和积分消费，不直接碰法币支付流程。</li>
            <li>充值入口跳转到国内备案服务器承接的 `pay.iccorehub.com`，适合后续接支付宝、微信或对公转账。</li>
            <li>支付成功后由国内服务回写积分账本，当前企业即可在工作台和解锁流程里立即消费积分。</li>
          </ul>
          <div className="form-toolbar">
            <a
              className="primary-action inline-link-button"
              href={BILLING_PORTAL_URL}
              target="_blank"
              rel="noreferrer"
            >
              Open pay.iccorehub.com
            </a>
          </div>
          {loadError ? <p className="inline-error">{loadError}</p> : null}
        </article>

        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">POINTS USE</span>
            <h2>Where points get consumed</h2>
          </div>
          <div className="audit-list">
            <article className="audit-item">
              <div className="audit-item-topline">
                <div>
                  <strong>联系方式解锁</strong>
                  <span>搜索结果中的真实电话 / 微信</span>
                </div>
                <span>50 pts / lane</span>
              </div>
              <p>适合采购员急找现货时，直接联系真实华强北供应商源头。</p>
            </article>
            <article className="audit-item">
              <div className="audit-item-topline">
                <div>
                  <strong>AI BOM 解析超额行数</strong>
                  <span>免费行数之外的计算量</span>
                </div>
                <span>按行计费</span>
              </div>
              <p>适合复杂 BOM 单批量清洗、纠错和标准化入库。</p>
            </article>
          </div>
        </article>
      </section>
    </main>
  )
}

export default RechargePage
