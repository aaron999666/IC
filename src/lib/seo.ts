import { useEffect } from 'react'

export const SITE_NAME = '芯汇 ICCoreHub'
export const SITE_DOMAIN = 'iccorehub.com'
export const SITE_URL = 'https://iccorehub.com'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-cover.svg`
export const DEFAULT_DESCRIPTION =
  '芯汇(ICCoreHub.com)是新一代智能电子元器件数据中枢。我们提供精准的AI BOM单清洗解析、全网千万级现货库存查询与供需信息匹配。平台采用纯信息撮合模式，不碰资金与实物，用积分打破行业信息壁垒，让买卖双方高效直连。'

type SchemaNode = Record<string, unknown>

type SeoConfig = {
  title: string
  description: string
  path: string
  robots?: string
  type?: string
  image?: string
  schema?: SchemaNode | SchemaNode[]
}

function absoluteUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return new URL(normalized, SITE_URL).toString()
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let node = document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null

  if (!node) {
    node = document.createElement('meta')
    node.setAttribute(attribute, key)
    document.head.appendChild(node)
  }

  node.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let node = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null

  if (!node) {
    node = document.createElement('link')
    node.setAttribute('rel', rel)
    document.head.appendChild(node)
  }

  node.setAttribute('href', href)
}

function upsertJsonLd(schema: SchemaNode | SchemaNode[] | undefined) {
  const scriptId = 'route-jsonld'
  const existing = document.head.querySelector(`#${scriptId}`)

  if (!schema) {
    existing?.remove()
    return
  }

  const nodes = Array.isArray(schema) ? schema : [schema]
  const payload = nodes.length === 1 ? nodes[0] : nodes

  let script = existing as HTMLScriptElement | null

  if (!script) {
    script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = scriptId
    document.head.appendChild(script)
  }

  script.textContent = JSON.stringify(payload)
}

export function useSeo(config: SeoConfig) {
  useEffect(() => {
    const canonical = absoluteUrl(config.path)
    const image = config.image ?? DEFAULT_OG_IMAGE
    const robots = config.robots ?? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    const type = config.type ?? 'website'

    document.documentElement.lang = 'zh-CN'
    document.title = config.title

    upsertMeta('name', 'description', config.description)
    upsertMeta('name', 'robots', robots)
    upsertMeta('name', 'googlebot', robots)
    upsertMeta('property', 'og:title', config.title)
    upsertMeta('property', 'og:description', config.description)
    upsertMeta('property', 'og:url', canonical)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:locale', 'zh_CN')
    upsertMeta('property', 'og:image', image)
    upsertMeta('property', 'og:image:alt', `${SITE_NAME} brand image`)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', config.title)
    upsertMeta('name', 'twitter:description', config.description)
    upsertMeta('name', 'twitter:image', image)
    upsertLink('canonical', canonical)
    upsertJsonLd(config.schema)
  }, [config.description, config.image, config.path, config.robots, config.schema, config.title, config.type])
}

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: ['ICCoreHub', '芯汇', 'ICCoreHub.com'],
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/iccorehub-mark.svg`,
    description: DEFAULT_DESCRIPTION,
    knowsAbout: [
      'IC芯片现货搜索',
      'AI BOM解析',
      '电子元器件数据清洗',
      '替代料匹配',
      '积分驱动信息撮合',
    ],
  }
}

export function buildWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    alternateName: SITE_DOMAIN,
    description: DEFAULT_DESCRIPTION,
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/market?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildWebPageSchema(path: string, title: string, description: string, pageType = 'WebPage') {
  return {
    '@context': 'https://schema.org',
    '@type': pageType,
    '@id': `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name: title,
    description,
    isPartOf: {
      '@id': `${SITE_URL}/#website`,
    },
    about: {
      '@id': `${SITE_URL}/#organization`,
    },
  }
}

export function buildFaqSchema(
  path: string,
  items: Array<{ question: string; answer: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${absoluteUrl(path)}#faq`,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}
