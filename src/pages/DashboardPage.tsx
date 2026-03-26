import { ledgerPreview, liveMetrics, rfqQueue } from '../data/mock'
import { buildWebPageSchema, useSeo } from '../lib/seo'

function DashboardPage() {
  const title = '运营工作台 | 芯汇 ICCoreHub'
  const description = '查看库存同步、积分流水、需求队列与联系方式解锁控制台。'
  useSeo({
    title,
    description,
    path: '/dashboard',
    robots: 'noindex, nofollow, max-image-preview:large',
    schema: buildWebPageSchema('/dashboard', title, description),
  })

  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Ops desk</p>
          <h1>Manage inventory freshness, reveal history and points economics.</h1>
        </div>
      </section>

      <section className="metrics-grid dashboard-metrics">
        {liveMetrics.slice(0, 3).map((metric) => (
          <article key={metric.label} className="metric-card">
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
            <span>{metric.note}</span>
          </article>
        ))}
      </section>

      <section className="split-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">QUEUE</span>
            <h2>Live demand queue</h2>
          </div>
          <ul className="queue-list">
            {rfqQueue.map((item) => (
              <li key={item.title}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.meta}</p>
                </div>
                <span>{item.status}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">LEDGER</span>
            <h2>Points preview</h2>
          </div>
          <ul className="queue-list ledger-list">
            {ledgerPreview.map((item) => (
              <li key={item.title}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.note}</p>
                </div>
                <span>{item.change}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="split-grid lower-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">SYNC</span>
            <h2>Inventory rails</h2>
          </div>
          <ul className="plain-list">
            <li>API sync for ERP and WMS feeds, freshness tracked per warehouse.</li>
            <li>Excel import remains available for long-tail sellers and ad-hoc spot stock.</li>
            <li>Low-freshness inventory can be auto-downgraded in result ranking.</li>
          </ul>
        </article>

        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">REVEAL</span>
            <h2>Reveal controls</h2>
          </div>
          <ul className="plain-list">
            <li>Contact reveal happens only through a server-side function after points are checked.</li>
            <li>Each buyer-company unlock is append-only, so the same source lane is not double-charged.</li>
            <li>Public market views never expose private phone or WeChat fields.</li>
          </ul>
        </article>
      </section>
    </main>
  )
}

export default DashboardPage
