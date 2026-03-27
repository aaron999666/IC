import crypto from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import http from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(fileURLToPath(import.meta.url))

loadEnvFile(join(rootDir, '.env'))

const config = {
  host: process.env.HOST || '0.0.0.0',
  port: Number.parseInt(process.env.PORT || '8788', 10),
  mainSitePublicUrl: (process.env.MAIN_SITE_PUBLIC_URL || 'https://iccorehub.com').replace(/\/$/, ''),
  mainSiteCallbackUrl:
    (process.env.MAIN_SITE_CALLBACK_URL || 'https://iccorehub.com/api/billing/callback').replace(/\/$/, ''),
  billingPortalPublicUrl:
    (process.env.BILLING_PORTAL_PUBLIC_URL || 'https://pay.iccorehub.com').replace(/\/$/, ''),
  supabaseUrl: (process.env.SUPABASE_URL || '').trim(),
  supabaseServiceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  billingWebhookSecret: (process.env.BILLING_WEBHOOK_SECRET || '').trim(),
  domesticGatewaySecret: (process.env.DOMESTIC_GATEWAY_SECRET || '').trim(),
  billingEnableMockPayment: (process.env.BILLING_ENABLE_MOCK_PAYMENT || 'false').trim().toLowerCase() === 'true',
}

const htmlShell = (title, body, options = {}) => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="robots" content="noindex,nofollow" />
    ${options.autoRefreshSeconds ? `<meta http-equiv="refresh" content="${options.autoRefreshSeconds}" />` : ''}
    <style>
      :root {
        color-scheme: light;
        --bg: #eef4f9;
        --surface: rgba(248, 251, 255, 0.94);
        --surface-strong: #ffffff;
        --text: #162436;
        --text-soft: #546679;
        --line: rgba(22, 36, 54, 0.12);
        --accent: #2d6f9f;
        --accent-soft: rgba(45, 111, 159, 0.12);
        --signal: #112034;
        --warn: #8a4b15;
        --danger: #b33a20;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top right, rgba(45, 111, 159, 0.16), transparent 24%),
          linear-gradient(180deg, #f6f9fc 0%, #e9f0f6 100%);
      }
      .shell {
        width: min(100%, 1120px);
        margin: 0 auto;
        padding: 28px 18px 40px;
      }
      .topbar, .card, .hero {
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--surface);
        box-shadow: 0 24px 80px rgba(17, 32, 52, 0.12);
      }
      .topbar {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: center;
        padding: 16px 18px;
        margin-bottom: 20px;
      }
      .brand strong {
        display: block;
        font-size: 1.1rem;
      }
      .brand small, .muted, .meta, .hero p, .card p, .card li, .status-note {
        color: var(--text-soft);
      }
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
        gap: 20px;
      }
      .hero, .card {
        padding: 24px;
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 12px;
        color: var(--accent);
        font-size: 0.78rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .eyebrow::before {
        content: "";
        width: 26px;
        height: 1px;
        background: currentColor;
      }
      h1, h2, h3 { margin: 0; line-height: 1.05; }
      h1 { font-size: clamp(2.3rem, 5vw, 4rem); letter-spacing: -0.05em; margin-bottom: 16px; }
      h2 { font-size: 1.45rem; letter-spacing: -0.03em; margin-bottom: 12px; }
      h3 { font-size: 1.05rem; margin-bottom: 8px; }
      .stack { display: grid; gap: 16px; }
      .summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .chip, .status-pill {
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.72);
      }
      .chip {
        display: inline-flex;
        align-items: center;
        padding: 8px 12px;
      }
      .summary .chip {
        display: grid;
        gap: 6px;
        padding: 14px;
        border-radius: 18px;
      }
      .summary strong { font-size: 1.18rem; }
      .actions, .meta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .button, button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 16px;
        border-radius: 16px;
        border: 1px solid transparent;
        background: var(--signal);
        color: #fff;
        font: inherit;
        text-decoration: none;
        cursor: pointer;
      }
      .button.secondary, button.secondary {
        border-color: var(--line);
        background: rgba(255,255,255,0.84);
        color: var(--text);
      }
      .button.warn, button.warn {
        background: #8a4b15;
      }
      .field, .note, .status-box {
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(255,255,255,0.68);
        padding: 16px;
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 34px;
        padding: 0 14px;
        font-size: 0.8rem;
      }
      .status-pill-paid { background: rgba(12, 119, 109, 0.12); color: #0d5d55; border-color: rgba(12, 119, 109, 0.18); }
      .status-pill-pending, .status-pill-processing { background: var(--accent-soft); color: var(--accent); border-color: rgba(45, 111, 159, 0.2); }
      .status-pill-cancelled, .status-pill-expired, .status-pill-failed { background: rgba(179, 58, 32, 0.08); color: var(--danger); border-color: rgba(179, 58, 32, 0.16); }
      ul { margin: 0; padding-left: 18px; }
      code {
        padding: 2px 6px;
        border-radius: 8px;
        background: rgba(17, 32, 52, 0.06);
      }
      .footer {
        margin-top: 20px;
        padding: 18px 4px 0;
        color: var(--text-soft);
        font-size: 0.9rem;
      }
      .flash {
        padding: 14px 16px;
        border-radius: 18px;
        background: rgba(45, 111, 159, 0.08);
        border: 1px solid rgba(45, 111, 159, 0.18);
        color: var(--accent);
      }
      .danger {
        background: rgba(179, 58, 32, 0.08);
        border-color: rgba(179, 58, 32, 0.18);
        color: var(--danger);
      }
      .mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
      form { margin: 0; }
      @media (max-width: 920px) {
        .grid, .summary {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <strong>芯汇支付 ICCoreHub Pay</strong>
          <small>pay.iccorehub.com · Domestic billing rail</small>
        </div>
        <div class="meta-row">
          <span class="chip">Domestic gateway</span>
          <span class="chip">Points recharge</span>
          <span class="chip">Signed callback</span>
        </div>
      </header>
      ${body}
      <div class="footer">
        This portal is designed for domestic deployment. Keep provider keys and callback secrets on this server only.
      </div>
    </div>
  </body>
</html>`

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return
  }

  const content = readFileSync(filePath, 'utf8')

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"|"$/g, '')

    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatMoney(value) {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDateTime(value) {
  if (!value) {
    return '--'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getStatusClass(status) {
  if (status === 'paid') {
    return 'status-pill status-pill-paid'
  }

  if (status === 'pending' || status === 'processing') {
    return 'status-pill status-pill-pending'
  }

  return 'status-pill status-pill-cancelled'
}

function json(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(payload, null, 2))
}

function html(response, status, title, body, options = {}) {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(htmlShell(title, body, options))
}

function redirect(response, location) {
  response.writeHead(303, {
    Location: location,
    'Cache-Control': 'no-store',
  })
  response.end()
}

function missingConfig() {
  return !config.supabaseUrl || !config.supabaseServiceRoleKey || !config.billingWebhookSecret
}

async function readRawBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString('utf8')
}

function parseFormEncoded(rawBody) {
  const params = new URLSearchParams(rawBody)
  return Object.fromEntries(params.entries())
}

async function supabaseFetch(path, init = {}) {
  if (missingConfig()) {
    throw new Error('Missing Supabase or billing secret configuration for domestic billing portal.')
  }

  const response = await fetch(`${config.supabaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      ...(init.headers || {}),
    },
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(payload?.message || `Supabase request failed with ${response.status}`)
  }

  return payload
}

function mapOrder(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    orderNo: row.order_no,
    checkoutToken: row.checkout_token,
    companyId: row.company_id,
    status: row.status,
    amountCny: Number(row.amount_cny),
    pointsAmount: Number(row.points_amount),
    bonusPoints: Number(row.bonus_points || 0),
    totalPoints: Number(row.total_points),
    currency: row.currency || 'CNY',
    paymentChannel: row.payment_channel || null,
    externalOrderNo: row.external_order_no || null,
    externalTradeNo: row.external_trade_no || null,
    note: row.note || null,
    paidAmountCny: row.paid_amount_cny === null || row.paid_amount_cny === undefined ? null : Number(row.paid_amount_cny),
    paidAt: row.paid_at || null,
    creditedAt: row.credited_at || null,
    expiresAt: row.expires_at || null,
    createdAt: row.created_at,
  }
}

async function getOrderByCheckoutToken(token) {
  const rows = await supabaseFetch(
    `/rest/v1/recharge_orders?checkout_token=eq.${encodeURIComponent(token)}&select=id,order_no,checkout_token,company_id,status,amount_cny,points_amount,bonus_points,total_points,currency,payment_channel,external_order_no,external_trade_no,note,paid_amount_cny,paid_at,credited_at,expires_at,created_at&limit=1`,
    { method: 'GET' },
  )

  return mapOrder(rows?.[0] || null)
}

async function getOrderByOrderNo(orderNo) {
  const rows = await supabaseFetch(
    `/rest/v1/recharge_orders?order_no=eq.${encodeURIComponent(orderNo)}&select=id,order_no,checkout_token,company_id,status,amount_cny,points_amount,bonus_points,total_points,currency,payment_channel,external_order_no,external_trade_no,note,paid_amount_cny,paid_at,credited_at,expires_at,created_at&limit=1`,
    { method: 'GET' },
  )

  return mapOrder(rows?.[0] || null)
}

async function signCallbackPayload(secret, timestamp, rawBody) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')
}

async function forwardCallback(payload) {
  const rawBody = JSON.stringify(payload)
  const timestamp = `${Date.now()}`
  const signature = await signCallbackPayload(config.billingWebhookSecret, timestamp, rawBody)

  const response = await fetch(config.mainSiteCallbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ICCoreHub-Billing-Timestamp': timestamp,
      'X-ICCoreHub-Billing-Signature': signature,
    },
    body: rawBody,
  })

  const text = await response.text()
  const payloadResponse = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(payloadResponse?.error || `Main-site callback failed with ${response.status}`)
  }

  return payloadResponse
}

function renderHomePage() {
  return `
    <section class="hero stack">
      <p class="eyebrow">Domestic billing</p>
      <h1>Reference payment rail for pay.iccorehub.com.</h1>
      <p>
        这个站点负责国内支付、回调与对账，主站继续处理搜索、BOM 解析和积分消费。
        生产环境下请把支付 SDK、商户证书和签名逻辑都放在这台国内服务器。
      </p>
      <div class="summary">
        <div class="chip">
          <strong>${escapeHtml(config.mainSitePublicUrl)}</strong>
          <span class="muted">main site</span>
        </div>
        <div class="chip">
          <strong>${escapeHtml(config.mainSiteCallbackUrl)}</strong>
          <span class="muted">callback target</span>
        </div>
        <div class="chip">
          <strong>${config.billingEnableMockPayment ? 'mock enabled' : 'mock disabled'}</strong>
          <span class="muted">local test mode</span>
        </div>
      </div>
    </section>
    <section class="grid" style="margin-top:20px">
      <article class="card stack">
        <div>
          <p class="eyebrow">Routes</p>
          <h2>What this reference service exposes</h2>
        </div>
        <ul>
          <li><code>GET /checkout?token=...</code> renders a private order payment page.</li>
          <li><code>GET /status?token=...</code> renders a private order status page with auto refresh while pending.</li>
          <li><code>POST /gateway/notify</code> accepts a trusted domestic adapter payload and forwards a signed callback to the main site.</li>
          <li><code>POST /pay/mock-success</code> is for local integration testing only.</li>
        </ul>
      </article>
      <article class="card stack">
        <div>
          <p class="eyebrow">Security</p>
          <h2>Operational guardrails</h2>
        </div>
        <ul>
          <li>Checkout pages use a high-entropy <code>checkout_token</code>, not raw company IDs.</li>
          <li>Main-site callbacks are HMAC signed with <code>BILLING_WEBHOOK_SECRET</code>.</li>
          <li><code>/gateway/notify</code> requires <code>DOMESTIC_GATEWAY_SECRET</code>.</li>
          <li>Production should disable mock payment and add your gateway-specific signature verification.</li>
        </ul>
      </article>
    </section>
  `
}

function renderCheckoutPage(order, flashMessage = '') {
  const isPaid = order.status === 'paid'
  const isPending = order.status === 'pending' || order.status === 'processing'

  return `
    <section class="grid">
      <article class="hero stack">
        <div>
          <p class="eyebrow">Checkout</p>
          <h1>${escapeHtml(order.orderNo)}</h1>
          <p>当前是私有充值单支付页。你可以在这里承接支付宝、微信或人工对公转账，再通过签名回调把积分写回主站。</p>
        </div>
        ${flashMessage ? `<div class="flash">${escapeHtml(flashMessage)}</div>` : ''}
        <div class="summary">
          <div class="chip">
            <strong>${formatMoney(order.amountCny)} CNY</strong>
            <span>recharge amount</span>
          </div>
          <div class="chip">
            <strong>${escapeHtml(String(order.totalPoints))} pts</strong>
            <span>points to credit</span>
          </div>
          <div class="chip">
            <strong class="mono">${escapeHtml(order.paymentChannel || 'alipay_qr')}</strong>
            <span>payment lane</span>
          </div>
        </div>
        <div class="field">
          <div class="${getStatusClass(order.status)}">${escapeHtml(order.status.toUpperCase())}</div>
          <p class="status-note">
            创建时间 ${escapeHtml(formatDateTime(order.createdAt))} · 过期时间 ${escapeHtml(formatDateTime(order.expiresAt))}
          </p>
        </div>
        <div class="note">
          <h3>How to wire a real gateway here</h3>
          <ul>
            <li>接入支付宝当面付或微信 Native 支付，渲染真实二维码。</li>
            <li>网关异步通知到本服务后，调用 <code>/gateway/notify</code> 或直接复用同一套转发逻辑。</li>
            <li>支付成功后主站会把积分写入 <code>points_ledger</code> 和 <code>points_accounts</code>。</li>
          </ul>
        </div>
        <div class="actions">
          <a class="button secondary" href="/status?token=${encodeURIComponent(order.checkoutToken)}">Open status page</a>
          <a class="button secondary" href="${escapeHtml(config.mainSitePublicUrl)}/recharge">Back to main recharge center</a>
        </div>
      </article>
      <aside class="card stack">
        <div>
          <p class="eyebrow">Instructions</p>
          <h2>${isPaid ? 'Payment already completed' : isPending ? 'Awaiting payment or callback' : 'Order requires attention'}</h2>
        </div>
        <div class="field">
          <strong>Order note</strong>
          <p>${escapeHtml(order.note || 'No operator note')}</p>
        </div>
        <div class="field">
          <strong>Provider integration hint</strong>
          <p>把你的商户订单号映射到 <code>${escapeHtml(order.orderNo)}</code>，回调成功后带上外部流水号一起签名转发。</p>
        </div>
        ${
          config.billingEnableMockPayment && !isPaid
            ? `
              <form method="post" action="/pay/mock-success" class="stack">
                <input type="hidden" name="token" value="${escapeHtml(order.checkoutToken)}" />
                <button type="submit" class="button warn">Simulate paid callback</button>
                <span class="muted">仅用于联调。生产环境请关闭 BILLING_ENABLE_MOCK_PAYMENT。</span>
              </form>
            `
            : '<p class="muted">Mock payment is disabled. Production deployments should integrate a real domestic gateway here.</p>'
        }
      </aside>
    </section>
  `
}

function renderStatusPage(order, flashMessage = '') {
  const autoRefreshSeconds =
    order.status === 'pending' || order.status === 'processing'
      ? 8
      : undefined

  return {
    autoRefreshSeconds,
    markup: `
      <section class="hero stack">
        <div>
          <p class="eyebrow">Status</p>
          <h1>${escapeHtml(order.orderNo)}</h1>
          <p>这里用于给财务和采购查看当前充值单状态。待支付状态下页面会自动刷新，直到支付回调完成。</p>
        </div>
        ${flashMessage ? `<div class="flash">${escapeHtml(flashMessage)}</div>` : ''}
        <div class="actions">
          <span class="${getStatusClass(order.status)}">${escapeHtml(order.status.toUpperCase())}</span>
          <a class="button secondary" href="/checkout?token=${encodeURIComponent(order.checkoutToken)}">Return to checkout</a>
        </div>
      </section>
      <section class="grid" style="margin-top:20px">
        <article class="card stack">
          <div>
            <p class="eyebrow">Order</p>
            <h2>Recharge details</h2>
          </div>
          <div class="summary">
            <div class="chip">
              <strong>${formatMoney(order.amountCny)} CNY</strong>
              <span>order amount</span>
            </div>
            <div class="chip">
              <strong>${escapeHtml(String(order.totalPoints))} pts</strong>
              <span>credit target</span>
            </div>
            <div class="chip">
              <strong>${escapeHtml(order.paymentChannel || '--')}</strong>
              <span>payment channel</span>
            </div>
          </div>
          <div class="field">
            <strong>Timeline</strong>
            <p>Created: ${escapeHtml(formatDateTime(order.createdAt))}</p>
            <p>Paid: ${escapeHtml(formatDateTime(order.paidAt))}</p>
            <p>Credited: ${escapeHtml(formatDateTime(order.creditedAt))}</p>
          </div>
          <div class="field">
            <strong>External references</strong>
            <p>External order: <span class="mono">${escapeHtml(order.externalOrderNo || '--')}</span></p>
            <p>External trade: <span class="mono">${escapeHtml(order.externalTradeNo || '--')}</span></p>
          </div>
        </article>
        <article class="card stack">
          <div>
            <p class="eyebrow">Next</p>
            <h2>Operational next step</h2>
          </div>
          <ul>
            <li>如果状态还是 <code>pending</code>，检查国内支付网关是否已完成异步通知。</li>
            <li>如果状态是 <code>paid</code>，回到主站的 <code>/dashboard</code> 或 <code>/recharge</code> 查看积分到账。</li>
            <li>如果状态异常，优先核对本地支付服务日志与主站回调返回。</li>
          </ul>
          <div class="actions">
            <a class="button secondary" href="${escapeHtml(config.mainSitePublicUrl)}/dashboard">Open main ops desk</a>
            <a class="button secondary" href="${escapeHtml(config.mainSitePublicUrl)}/recharge">Open main recharge center</a>
          </div>
        </article>
      </section>
    `,
  }
}

async function handleGatewayNotify(request, response) {
  if (!config.domesticGatewaySecret) {
    return json(response, 500, {
      error: 'DOMESTIC_GATEWAY_SECRET is not configured.',
    })
  }

  if ((request.headers['x-iccorehub-domestic-secret'] || '').toString().trim() !== config.domesticGatewaySecret) {
    return json(response, 401, { error: 'Invalid domestic gateway secret.' })
  }

  const rawBody = await readRawBody(request)
  let body = null

  try {
    body = rawBody ? JSON.parse(rawBody) : null
  } catch {
    return json(response, 400, { error: 'Gateway notify body must be valid JSON.' })
  }

  const order =
    body?.token
      ? await getOrderByCheckoutToken(String(body.token))
      : body?.orderNo
        ? await getOrderByOrderNo(String(body.orderNo))
        : null

  if (!order) {
    return json(response, 404, { error: 'Recharge order not found.' })
  }

  try {
    const upstream = await forwardCallback({
      orderNo: order.orderNo,
      status: body?.status || 'paid',
      externalTradeNo: body?.externalTradeNo || null,
      externalOrderNo: body?.externalOrderNo || order.orderNo,
      paidAmountCny: Number(body?.paidAmountCny || order.amountCny),
      paymentChannel: body?.paymentChannel || order.paymentChannel || 'alipay_qr',
      source: body?.source || 'domestic_gateway_adapter',
      message: body?.message || 'Forwarded from domestic billing adapter',
      payload: body?.payload && typeof body.payload === 'object' ? body.payload : body,
    })

    return json(response, 200, {
      ok: true,
      orderNo: order.orderNo,
      upstream,
    })
  } catch (error) {
    return json(response, 502, {
      error: error instanceof Error ? error.message : 'Failed to forward callback to main site.',
    })
  }
}

async function handleMockSuccess(request, response) {
  if (!config.billingEnableMockPayment) {
    return html(
      response,
      403,
      'Mock disabled',
      `<section class="card"><p class="eyebrow">Mock</p><h2>Mock payment is disabled.</h2><p>Enable <code>BILLING_ENABLE_MOCK_PAYMENT=true</code> only for local integration tests.</p></section>`,
    )
  }

  const form = parseFormEncoded(await readRawBody(request))
  const token = (form.token || '').trim()

  if (!token) {
    return html(
      response,
      400,
      'Missing token',
      `<section class="card"><p class="eyebrow">Mock</p><h2>Missing token.</h2><p>The mock payment form requires a checkout token.</p></section>`,
    )
  }

  const order = await getOrderByCheckoutToken(token)
  if (!order) {
    return html(
      response,
      404,
      'Order not found',
      `<section class="card"><p class="eyebrow">Mock</p><h2>Recharge order not found.</h2><p>The checkout token is invalid or expired.</p></section>`,
    )
  }

  try {
    await forwardCallback({
      orderNo: order.orderNo,
      status: 'paid',
      externalTradeNo: `MOCK-${Date.now()}`,
      externalOrderNo: order.orderNo,
      paidAmountCny: order.amountCny,
      paymentChannel: order.paymentChannel || 'alipay_qr',
      source: 'pay.iccorehub.mock',
      message: 'Mock payment confirmation from domestic billing portal',
      payload: {
        mock: true,
        checkoutTokenSuffix: order.checkoutToken.slice(-6),
      },
    })

    return redirect(response, `/status?token=${encodeURIComponent(order.checkoutToken)}&flash=${encodeURIComponent('Mock callback forwarded successfully.')}`)
  } catch (error) {
    return html(
      response,
      502,
      'Mock forward failed',
      `<section class="card"><p class="eyebrow">Mock</p><h2>Failed to forward callback.</h2><p>${escapeHtml(error instanceof Error ? error.message : 'Unknown callback error.')}</p></section>`,
    )
  }
}

async function requestHandler(request, response) {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

  if (url.pathname === '/health') {
    return json(response, 200, {
      ok: true,
      service: 'iccorehub-domestic-billing',
      mainSiteCallbackUrl: config.mainSiteCallbackUrl,
      configured: !missingConfig(),
      mockPayment: config.billingEnableMockPayment,
    })
  }

  if (missingConfig()) {
    return html(
      response,
      500,
      'Configuration error',
      `<section class="card"><p class="eyebrow">Config</p><h2>Domestic billing portal is not configured.</h2><p>Set <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code> and <code>BILLING_WEBHOOK_SECRET</code> before starting this service.</p></section>`,
    )
  }

  if (request.method === 'GET' && url.pathname === '/') {
    return html(response, 200, 'ICCoreHub Pay', renderHomePage())
  }

  if (request.method === 'GET' && url.pathname === '/checkout') {
    const token = (url.searchParams.get('token') || '').trim()
    const flash = (url.searchParams.get('flash') || '').trim()

    if (!token) {
      return html(
        response,
        400,
        'Missing token',
        `<section class="card"><p class="eyebrow">Checkout</p><h2>Missing checkout token.</h2><p>Open the page with <code>/checkout?token=...</code>.</p></section>`,
      )
    }

    const order = await getOrderByCheckoutToken(token)
    if (!order) {
      return html(
        response,
        404,
        'Order not found',
        `<section class="card"><p class="eyebrow">Checkout</p><h2>Recharge order not found.</h2><p>The token may be invalid, expired or already rotated.</p></section>`,
      )
    }

    return html(
      response,
      200,
      `Checkout ${order.orderNo}`,
      renderCheckoutPage(order, flash),
    )
  }

  if (request.method === 'GET' && url.pathname === '/status') {
    const token = (url.searchParams.get('token') || '').trim()
    const orderNo = (url.searchParams.get('orderNo') || '').trim()
    const flash = (url.searchParams.get('flash') || '').trim()
    const order = token ? await getOrderByCheckoutToken(token) : orderNo ? await getOrderByOrderNo(orderNo) : null

    if (!order) {
      return html(
        response,
        404,
        'Order not found',
        `<section class="card"><p class="eyebrow">Status</p><h2>Recharge order not found.</h2><p>Provide a valid <code>token</code> or <code>orderNo</code>.</p></section>`,
      )
    }

    const page = renderStatusPage(order, flash)
    return html(response, 200, `Status ${order.orderNo}`, page.markup, {
      autoRefreshSeconds: page.autoRefreshSeconds,
    })
  }

  if (request.method === 'POST' && url.pathname === '/pay/mock-success') {
    return handleMockSuccess(request, response)
  }

  if (request.method === 'POST' && url.pathname === '/gateway/notify') {
    return handleGatewayNotify(request, response)
  }

  return html(
    response,
    404,
    'Not found',
    `<section class="card"><p class="eyebrow">Route</p><h2>Route not found.</h2><p>The path <code>${escapeHtml(url.pathname)}</code> is not handled by the domestic billing portal.</p></section>`,
  )
}

const server = http.createServer((request, response) => {
  requestHandler(request, response).catch((error) => {
    html(
      response,
      500,
      'Server error',
      `<section class="card"><p class="eyebrow">Error</p><h2>Unexpected domestic billing error.</h2><p>${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}</p></section>`,
    )
  })
})

server.listen(config.port, config.host, () => {
  console.log(`[iccorehub-domestic-billing] listening on http://${config.host}:${config.port}`)
  console.log(`[iccorehub-domestic-billing] main-site callback -> ${config.mainSiteCallbackUrl}`)
})
