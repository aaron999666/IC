import { ledgerPreview, liveMetrics, rfqQueue } from '../data/mock'

function DashboardPage() {
  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Seller and buyer cockpit</p>
          <h1>Manage inventory freshness, RFQ response and points economics.</h1>
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
            <h2>Live RFQ queue</h2>
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
            <span className="panel-code">ESCROW</span>
            <h2>Settlement milestones</h2>
          </div>
          <ul className="plain-list">
            <li>Buyer funds held before seller release.</li>
            <li>QC checkpoint can unlock partial release for high-risk lots.</li>
            <li>Dispute state remains isolated from public result views.</li>
          </ul>
        </article>
      </section>
    </main>
  )
}

export default DashboardPage
