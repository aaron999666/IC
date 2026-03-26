import { dictionaryPipeline, schemaEntities } from '../data/mock'
import { buildWebPageSchema, useSeo } from '../lib/seo'

function DataHubPage() {
  const title = '数据中枢 | 芯汇 ICCoreHub'
  const description = '查看芯汇 ICCoreHub 的芯片数据字典、RLS 安全模型、BOM 结构化入库链路与替代料图谱设计。'
  useSeo({
    title,
    description,
    path: '/data-hub',
    schema: buildWebPageSchema('/data-hub', title, description, 'AboutPage'),
  })

  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Data center</p>
          <h1>ICCoreHub wins when canonical identity and graph edges stay cleaner than the market.</h1>
        </div>
      </section>

      <section className="split-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">PIPE</span>
            <h2>Dictionary build pipeline</h2>
          </div>
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
            <span className="panel-code">RLS</span>
            <h2>Supabase table spine</h2>
          </div>
          <div className="schema-grid">
            {schemaEntities.map((entity) => (
              <div key={entity.table} className="schema-card">
                <strong>{entity.table}</strong>
                <p>{entity.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}

export default DataHubPage
