import { Link, useNavigate } from 'react-router-dom'
import { dictionaryPipeline, heroSuggestions, hotQueries, liveMetrics } from '../data/mock'

function HomePage() {
  const navigate = useNavigate()

  return (
    <main className="page home-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">ICCoreHub.com · chip data intelligence bureau</p>
          <h1>Clean dirty BOMs. Match live supply. Reveal contacts only when needed.</h1>
          <p className="hero-text">
            ICCoreHub is a pure information-flow platform for IC sourcing. The moat is
            a canonical chip dictionary, dual-engine BOM cleansing, and a points ledger
            that meters high-value access without subscriptions.
          </p>

          <form
            className="hero-search"
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              const query = String(formData.get('query') ?? '').trim()

              if (query) {
                navigate(`/market?q=${encodeURIComponent(query)}`)
              }
            }}
          >
            <input
              name="query"
              type="search"
              placeholder="Search MPN, prefix, lot code or package. Example: STM32F103C8T6"
              defaultValue={heroSuggestions[0]}
              aria-label="Search part numbers"
            />
            <button type="submit">Search public board</button>
          </form>

          <div className="hero-actions">
            <Link className="ghost-link" to="/bom">
              Open AI BOM lane
            </Link>
            <Link className="ghost-link" to="/market">
              View market board
            </Link>
          </div>

          <ul className="suggestion-row" aria-label="Suggested part numbers">
            {heroSuggestions.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className="suggestion-chip"
                  onClick={() => navigate(`/market?q=${encodeURIComponent(item)}`)}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <aside className="upload-card">
          <div className="panel-heading">
            <span className="panel-code">BOM</span>
            <h2>Drop a messy file, get a standardized sourcing sheet.</h2>
          </div>
          <p>
            Gemini 1.5 Flash runs first, Workers AI stands by as backup. First 20
            lines free, then point billing can kick in once storage is enabled.
          </p>
          <div className="drop-zone">
            <div>
              <strong>Drag BOM here</strong>
              <span>or open the parser workspace</span>
            </div>
            <Link className="ghost-link strong-link" to="/bom">
              Launch parser
            </Link>
          </div>
          <div className="upload-sample">
            <span>Sample input</span>
            <code>MAX 3232ESE, 12000</code>
            <code>STM32 F103 C8 T6, 8000</code>
            <code>TPS7A4701RGWT, 2000</code>
          </div>
        </aside>
      </section>

      <section className="metrics-grid">
        {liveMetrics.map((metric) => (
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
            <span className="panel-code">SPINE</span>
            <h2>Data dictionary before marketplace scale.</h2>
          </div>
          <p className="section-copy">
            The moat is not catalog quantity alone. It is canonical SKU identity,
            suffix-level normalization and a trustworthy substitute graph.
          </p>
          <div className="pipeline-list">
            {dictionaryPipeline.map((step) => (
              <div key={step.step} className="pipeline-item">
                <span>{step.step}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">FLOW</span>
            <h2>Points replace subscriptions.</h2>
          </div>
          <div className="ledger-lanes">
            <div>
              <h3>Earn</h3>
              <ul className="plain-list">
                <li>KYB approved: 500 pts one-time</li>
                <li>ERP sync live: 300 pts monthly</li>
                <li>Trusted data contribution: review rewards</li>
              </ul>
            </div>
            <div>
              <h3>Spend</h3>
              <ul className="plain-list">
                <li>Reveal seller contact: 50 pts</li>
                <li>Urgent RFQ top slot: 100 pts</li>
                <li>Insight chart access: 30 pts</li>
              </ul>
            </div>
          </div>
          <Link className="inline-link" to="/dashboard">
            See points ledger in the dashboard
          </Link>
        </article>
      </section>

      <section className="split-grid lower-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">HEAT</span>
            <h2>Hot searches signal real demand.</h2>
          </div>
          <ul className="hot-list">
            {hotQueries.map((query, index) => (
              <li key={query.mpn}>
                <span className="rank">0{index + 1}</span>
                <div>
                  <strong>{query.mpn}</strong>
                  <p>{query.note}</p>
                </div>
                <span className="trend">{query.trend}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="content-card emphasis-card">
          <div className="panel-heading">
            <span className="panel-code">NEXT</span>
            <h2>Built for Supabase + Cloudflare Pages.</h2>
          </div>
          <p className="section-copy">
            The MVP stays light: Cloudflare Pages for edge delivery, Supabase for the
            dictionary and vault, and server-side point checks before every sensitive
            reveal.
          </p>
          <div className="tag-row">
            <span>Canonical SKU graph</span>
            <span>Private contact vault</span>
            <span>Global edge delivery</span>
            <span>Dual-engine AI parsing</span>
          </div>
        </article>
      </section>
    </main>
  )
}

export default HomePage
