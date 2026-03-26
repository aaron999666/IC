import { startTransition, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildWebPageSchema, useSeo } from '../lib/seo'
import type { AdminAiProviderConfig } from '../types'

type ProviderFormState = {
  provider: 'gemini' | 'workers-ai'
  display_name: string
  enabled: boolean
  priority: number
  request_mode: 'api-key' | 'binding' | 'rest'
  model: string
  base_url: string
  account_id: string
  apiKey: string
  apiToken: string
  clearApiKey: boolean
  clearApiToken: boolean
}

function createFormState(config: AdminAiProviderConfig): ProviderFormState {
  return {
    provider: config.provider,
    display_name: config.display_name,
    enabled: config.enabled,
    priority: config.priority,
    request_mode: config.request_mode,
    model: config.model,
    base_url: config.base_url ?? '',
    account_id: config.account_id ?? '',
    apiKey: '',
    apiToken: '',
    clearApiKey: false,
    clearApiToken: false,
  }
}

function AdminAiPage() {
  const title = 'AI模型配置后台 | 芯汇 ICCoreHub'
  const description = '管理员后台：安全配置 Gemini 与 Cloudflare Workers AI 的模型、模式、优先级与密钥。'

  useSeo({
    title,
    description,
    path: '/admin/ai',
    robots: 'noindex, nofollow, max-image-preview:large',
    schema: buildWebPageSchema('/admin/ai', title, description),
  })

  const [adminToken, setAdminToken] = useState('')
  const [configs, setConfigs] = useState<AdminAiProviderConfig[]>([])
  const [forms, setForms] = useState<Record<string, ProviderFormState>>({})
  const [status, setStatus] = useState<string>('Enter a bootstrap admin token to load secure provider settings.')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [savingProvider, setSavingProvider] = useState<string | null>(null)

  const hasLoaded = configs.length > 0
  const orderedConfigs = useMemo(
    () => [...configs].sort((left, right) => left.priority - right.priority),
    [configs],
  )

  async function loadConfigs() {
    const token = adminToken.trim()
    if (!token) {
      setError('Admin bearer token is required before loading the secure AI configuration.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/ai-config', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const payload = (await response.json().catch(() => null)) as
        | { configs?: AdminAiProviderConfig[]; error?: string }
        | null

      if (!response.ok || !payload?.configs) {
        throw new Error(payload?.error ?? 'Failed to load secure AI provider settings.')
      }

      startTransition(() => {
        setConfigs(payload.configs ?? [])
        setForms(
          Object.fromEntries((payload.configs ?? []).map((config) => [config.provider, createFormState(config)])),
        )
        setStatus('Secure configuration loaded. API secrets remain write-only and never return to the browser.')
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load secure AI provider settings.')
    } finally {
      setIsLoading(false)
    }
  }

  function updateForm<K extends keyof ProviderFormState>(
    provider: ProviderFormState['provider'],
    key: K,
    value: ProviderFormState[K],
  ) {
    setForms((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        [key]: value,
      },
    }))
  }

  async function saveProvider(provider: ProviderFormState['provider']) {
    const token = adminToken.trim()
    const form = forms[provider]

    if (!token) {
      setError('Admin bearer token is required before saving secure AI provider settings.')
      return
    }

    if (!form) {
      setError('Provider form state is missing.')
      return
    }

    setSavingProvider(provider)
    setError(null)

    try {
      const response = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          displayName: form.display_name,
          enabled: form.enabled,
          priority: form.priority,
          requestMode: form.request_mode,
          model: form.model,
          baseUrl: form.base_url || null,
          accountId: form.account_id || null,
          apiKey: form.apiKey || undefined,
          apiToken: form.apiToken || undefined,
          clearApiKey: form.clearApiKey,
          clearApiToken: form.clearApiToken,
          updatedBy: 'dashboard-admin',
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; configs?: AdminAiProviderConfig[]; error?: string }
        | null

      if (!response.ok || !payload?.configs) {
        throw new Error(payload?.error ?? 'Failed to save provider configuration.')
      }

      startTransition(() => {
        setConfigs(payload.configs ?? [])
        setForms(
          Object.fromEntries((payload.configs ?? []).map((config) => [config.provider, createFormState(config)])),
        )
        setStatus(`Saved ${provider} configuration. Secrets stay encrypted at rest and are not returned to the client.`)
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save provider configuration.')
    } finally {
      setSavingProvider(null)
    }
  }

  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Admin AI</p>
          <h1>Securely control primary and backup model providers without leaking secrets.</h1>
        </div>
        <div className="note-card">
          <span>Security posture</span>
          <strong>Write-only secrets</strong>
          <p>Browser only sends updates. API keys never come back in responses.</p>
        </div>
      </section>

      <section className="split-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">AUTH</span>
            <h2>Bootstrap admin access</h2>
          </div>
          <p className="section-copy">
            This console uses a server-side bearer token as the current bootstrap admin gate.
            It keeps the secret out of the built frontend bundle and can later be replaced by
            Supabase auth plus role checks.
          </p>
          <div className="field-stack">
            <label htmlFor="admin-token">Admin bearer token</label>
            <input
              id="admin-token"
              type="password"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              placeholder="Paste the secure admin token for this session"
            />
          </div>
          <div className="bom-actions">
            <button type="button" className="primary-action" onClick={loadConfigs} disabled={isLoading}>
              {isLoading ? 'Loading secure config...' : 'Load secure config'}
            </button>
            <Link className="ghost-link" to="/dashboard">
              Back to ops desk
            </Link>
          </div>
          <p className="status-detail">{status}</p>
          {error ? <p className="inline-error">{error}</p> : null}
        </article>

        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">MODEL</span>
            <h2>What this page controls</h2>
          </div>
          <ul className="plain-list">
            <li>Enable or disable Gemini and Workers AI independently.</li>
            <li>Change model names, request mode and fallback order by priority.</li>
            <li>Store API keys and API tokens encrypted in Supabase using a server-side master key.</li>
            <li>Keep all secret material off the client and out of public search APIs.</li>
          </ul>
        </article>
      </section>

      {hasLoaded ? (
        <section className="admin-grid">
          {orderedConfigs.map((config) => {
            const form = forms[config.provider]
            if (!form) {
              return null
            }

            const saving = savingProvider === config.provider
            const needsWorkersToken = form.provider === 'workers-ai' && form.request_mode === 'rest'

            return (
              <article key={config.provider} className="content-card admin-card">
                <div className="panel-heading">
                  <span className="panel-code">{config.provider.toUpperCase()}</span>
                  <h2>{config.display_name}</h2>
                </div>

                <div className="pill-row">
                  <span className="suggestion-chip">Source: {config.source}</span>
                  <span className="suggestion-chip">Priority: {config.priority}</span>
                  <span className="suggestion-chip">
                    Secret: {config.api_key_configured || config.api_token_configured ? 'configured' : 'empty'}
                  </span>
                </div>

                <div className="control-grid">
                  <div className="field-stack">
                    <label>Display name</label>
                    <input
                      type="text"
                      value={form.display_name}
                      onChange={(event) => updateForm(config.provider, 'display_name', event.target.value)}
                    />
                  </div>
                  <div className="field-stack">
                    <label>Priority</label>
                    <input
                      type="number"
                      value={form.priority}
                      onChange={(event) =>
                        updateForm(config.provider, 'priority', Number.parseInt(event.target.value || '0', 10) || 0)
                      }
                    />
                  </div>
                  <div className="field-stack">
                    <label>Model</label>
                    <input
                      type="text"
                      value={form.model}
                      onChange={(event) => updateForm(config.provider, 'model', event.target.value)}
                    />
                  </div>
                  <div className="field-stack">
                    <label>Base URL</label>
                    <input
                      type="text"
                      value={form.base_url}
                      onChange={(event) => updateForm(config.provider, 'base_url', event.target.value)}
                    />
                  </div>
                </div>

                <div className="checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(event) => updateForm(config.provider, 'enabled', event.target.checked)}
                    />
                    Provider enabled
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={form.request_mode === 'binding'}
                      onChange={(event) =>
                        updateForm(config.provider, 'request_mode', event.target.checked ? 'binding' : 'rest')
                      }
                      disabled={config.provider !== 'workers-ai'}
                    />
                    Use binding mode
                  </label>
                </div>

                {config.provider === 'workers-ai' ? (
                  <div className="field-stack">
                    <label>Request mode</label>
                    <select
                      className="admin-select"
                      value={form.request_mode}
                      onChange={(event) =>
                        updateForm(config.provider, 'request_mode', event.target.value as ProviderFormState['request_mode'])
                      }
                    >
                      <option value="binding">binding</option>
                      <option value="rest">rest</option>
                    </select>
                  </div>
                ) : null}

                {config.provider === 'gemini' ? (
                  <div className="field-stack">
                    <label>Gemini API key</label>
                    <input
                      type="password"
                      value={form.apiKey}
                      onChange={(event) => updateForm(config.provider, 'apiKey', event.target.value)}
                      placeholder={config.api_key_hint ?? 'Enter a new API key to replace the current one'}
                    />
                    <span className="secret-note">
                      Current state: {config.api_key_hint ?? 'No stored secret'}.
                    </span>
                  </div>
                ) : null}

                {config.provider === 'workers-ai' ? (
                  <>
                    <div className="field-stack">
                      <label>Cloudflare account ID</label>
                      <input
                        type="text"
                        value={form.account_id}
                        onChange={(event) => updateForm(config.provider, 'account_id', event.target.value)}
                        placeholder="Required only when request mode is rest"
                      />
                    </div>
                    <div className="field-stack">
                      <label>Workers AI API token</label>
                      <input
                        type="password"
                        value={form.apiToken}
                        onChange={(event) => updateForm(config.provider, 'apiToken', event.target.value)}
                        placeholder={config.api_token_hint ?? 'Enter a new API token to replace the current one'}
                      />
                      <span className="secret-note">
                        Current state: {config.api_token_hint ?? 'No stored secret'}.
                        {needsWorkersToken ? ' REST mode requires both account ID and API token.' : ' Binding mode keeps token storage unnecessary.'}
                      </span>
                    </div>
                  </>
                ) : null}

                <div className="checkbox-row">
                  {config.provider === 'gemini' ? (
                    <label className="danger-toggle">
                      <input
                        type="checkbox"
                        checked={form.clearApiKey}
                        onChange={(event) => updateForm(config.provider, 'clearApiKey', event.target.checked)}
                      />
                      Clear stored Gemini key
                    </label>
                  ) : null}
                  {config.provider === 'workers-ai' ? (
                    <label className="danger-toggle">
                      <input
                        type="checkbox"
                        checked={form.clearApiToken}
                        onChange={(event) => updateForm(config.provider, 'clearApiToken', event.target.checked)}
                      />
                      Clear stored Workers token
                    </label>
                  ) : null}
                </div>

                <div className="bom-actions">
                  <button
                    type="button"
                    className="primary-action"
                    onClick={() => saveProvider(config.provider)}
                    disabled={saving}
                  >
                    {saving ? 'Saving secure config...' : `Save ${config.display_name}`}
                  </button>
                </div>

                <p className="status-detail">
                  Last update: {config.updated_at ?? 'not stored yet'}
                  {config.updated_by ? ` · by ${config.updated_by}` : ''}
                </p>
              </article>
            )
          })}
        </section>
      ) : null}
    </main>
  )
}

export default AdminAiPage
