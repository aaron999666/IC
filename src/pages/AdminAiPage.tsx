import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  loadAdminAiConsole,
  saveAdminAiProviderConfig,
  testAdminAiProviderConfig,
} from '../lib/adminConsole'
import { buildWebPageSchema, useSeo } from '../lib/seo'
import type {
  AdminAiConfigAuditLog,
  AdminAiConfigConsoleResponse,
  AdminAiProviderConfig,
  AdminAiProviderTestResult,
} from '../types'

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

function createFormMap(configs: AdminAiProviderConfig[]) {
  return Object.fromEntries(configs.map((config) => [config.provider, createFormState(config)]))
}

function normalizeFormState(form: ProviderFormState) {
  return {
    ...form,
    display_name: form.display_name.trim(),
    model: form.model.trim(),
    base_url: form.base_url.trim(),
    account_id: form.account_id.trim(),
    apiKey: form.apiKey.trim(),
    apiToken: form.apiToken.trim(),
  }
}

function areFormsEqual(left: ProviderFormState, right: ProviderFormState) {
  return JSON.stringify(normalizeFormState(left)) === JSON.stringify(normalizeFormState(right))
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return 'Not recorded yet'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function validateUrl(value: string) {
  if (!value.trim()) {
    return true
  }

  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function buildProviderIssues(
  form: ProviderFormState,
  config: AdminAiProviderConfig,
  allForms: Record<string, ProviderFormState>,
) {
  const issues: string[] = []
  const normalizedDisplayName = form.display_name.trim()
  const normalizedModel = form.model.trim()
  const normalizedBaseUrl = form.base_url.trim()
  const normalizedAccountId = form.account_id.trim()
  const normalizedApiKey = form.apiKey.trim()
  const normalizedApiToken = form.apiToken.trim()

  if (!normalizedDisplayName) {
    issues.push('Display name is required.')
  } else if (normalizedDisplayName.length > 80) {
    issues.push('Display name must stay under 80 characters.')
  }

  if (!Number.isInteger(form.priority) || form.priority < 1 || form.priority > 999) {
    issues.push('Priority must be an integer between 1 and 999.')
  }

  if (!normalizedModel) {
    issues.push('Model is required.')
  } else if (normalizedModel.length > 160) {
    issues.push('Model must stay under 160 characters.')
  }

  if (normalizedBaseUrl && !validateUrl(normalizedBaseUrl)) {
    issues.push('Base URL must be a valid HTTP or HTTPS URL.')
  }

  if (form.provider === 'gemini' && form.request_mode !== 'api-key') {
    issues.push('Gemini only supports API key mode in this console.')
  }

  if (form.provider === 'workers-ai' && form.request_mode === 'api-key') {
    issues.push('Workers AI must use binding or REST mode.')
  }

  if (form.provider === 'workers-ai' && form.request_mode === 'rest' && !normalizedAccountId) {
    issues.push('Workers AI REST mode requires an account ID.')
  }

  if (form.provider === 'gemini' && form.enabled && !normalizedApiKey && !config.api_key_configured) {
    issues.push('No Gemini API key is stored in admin config yet. Runtime would have to rely on an environment fallback.')
  }

  if (
    form.provider === 'workers-ai' &&
    form.enabled &&
    form.request_mode === 'rest' &&
    !normalizedApiToken &&
    !config.api_token_configured
  ) {
    issues.push('No Workers AI REST token is stored in admin config yet.')
  }

  const enabledPriorityOwners = Object.values(allForms)
    .filter((candidate) => candidate.enabled && candidate.priority === form.priority)
    .map((candidate) => candidate.provider)

  if (form.enabled && enabledPriorityOwners.length > 1) {
    issues.push('Another enabled provider already uses this priority. Keep primary and backup order unique.')
  }

  return issues
}

function providerLabel(provider: ProviderFormState['provider']) {
  return provider === 'gemini' ? 'Gemini' : 'Cloudflare Workers AI'
}

function providerShortLabel(provider: ProviderFormState['provider']) {
  return provider === 'gemini' ? 'Gemini' : 'Workers AI'
}

function latestAuditForProvider(auditLogs: AdminAiConfigAuditLog[], provider: ProviderFormState['provider']) {
  return auditLogs.find((item) => item.provider === provider) ?? null
}

function latestTestAuditForProvider(auditLogs: AdminAiConfigAuditLog[], provider: ProviderFormState['provider']) {
  return auditLogs.find((item) => item.provider === provider && item.action === 'test') ?? null
}

function latestSaveAuditForProvider(auditLogs: AdminAiConfigAuditLog[], provider: ProviderFormState['provider']) {
  return auditLogs.find((item) => item.provider === provider && item.action === 'save') ?? null
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

  const { isConfigured, isReady, session, user } = useAuth()
  const accessToken = session?.access_token ?? null
  const [changeNote, setChangeNote] = useState('')
  const [configs, setConfigs] = useState<AdminAiProviderConfig[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAiConfigAuditLog[]>([])
  const [forms, setForms] = useState<Record<string, ProviderFormState>>({})
  const [testResults, setTestResults] = useState<Record<string, AdminAiProviderTestResult>>({})
  const [status, setStatus] = useState('Load the secure AI console with your current Supabase admin session.')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [savingProvider, setSavingProvider] = useState<string | null>(null)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)

  const hasLoaded = configs.length > 0
  const orderedConfigs = useMemo(
    () => [...configs].sort((left, right) => left.priority - right.priority),
    [configs],
  )
  const baselineForms = useMemo(() => createFormMap(configs), [configs])
  const providerIssues = useMemo(
    () =>
      Object.fromEntries(
        orderedConfigs.map((config) => [
          config.provider,
          forms[config.provider] ? buildProviderIssues(forms[config.provider], config, forms) : [],
        ]),
      ) as Record<string, string[]>,
    [forms, orderedConfigs],
  )

  const dirtyProviders = useMemo(
    () =>
      orderedConfigs
        .filter((config) => forms[config.provider] && !areFormsEqual(forms[config.provider], baselineForms[config.provider]))
        .map((config) => config.provider),
    [baselineForms, forms, orderedConfigs],
  )

  const topology = useMemo(() => {
    const activeProviders = Object.values(forms)
      .filter((config) => config.enabled)
      .sort((left, right) => left.priority - right.priority)

    return {
      primary: activeProviders[0] ?? null,
      backup: activeProviders[1] ?? null,
      activeCount: activeProviders.length,
    }
  }, [forms])

  const globalWarnings = useMemo(() => {
    const warnings: string[] = []

    if (hasLoaded && topology.activeCount === 0) {
      warnings.push('Both providers are currently disabled. BOM parsing would stop entirely.')
    }

    if (hasLoaded && topology.activeCount === 1) {
      warnings.push('Only one provider is enabled. Add a backup engine before go-live.')
    }

    if (hasLoaded && !user?.email) {
      warnings.push('Current session does not expose an email identity. Audit logs will fall back to the user id.')
    }

    if (hasLoaded && dirtyProviders.length > 0) {
      warnings.push(`${dirtyProviders.length} provider draft${dirtyProviders.length > 1 ? 's are' : ' is'} not saved yet.`)
    }

    return warnings
  }, [dirtyProviders.length, hasLoaded, topology.activeCount, user?.email])

  function applyConsoleData(payload: AdminAiConfigConsoleResponse) {
    startTransition(() => {
      setConfigs(payload.configs ?? [])
      setForms(createFormMap(payload.configs ?? []))
      setAuditLogs(payload.auditLogs ?? [])
    })
  }

  const loadConfigs = useCallback(async () => {
    if (!accessToken) {
      setError('Current Supabase session is missing an access token.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const payload = await loadAdminAiConsole(accessToken, 24)
      applyConsoleData(payload)
      setStatus('Secure configuration loaded through Supabase Auth. Secrets remain write-only, tests are server-side, and audit logs are available below.')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load secure AI provider settings.')
    } finally {
      setIsLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (!isConfigured || !isReady || !accessToken) {
      return
    }

    void loadConfigs()
  }, [accessToken, isConfigured, isReady, loadConfigs])

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

  function resetProvider(provider: ProviderFormState['provider']) {
    const baseline = baselineForms[provider]
    if (!baseline) {
      return
    }

    setForms((current) => ({
      ...current,
      [provider]: { ...baseline },
    }))
    setStatus(`Reset ${providerLabel(provider)} draft back to the last saved state.`)
  }

  async function saveProvider(provider: ProviderFormState['provider']) {
    const form = forms[provider]
    const issues = providerIssues[provider] ?? []

    if (!accessToken) {
      setError('Current Supabase session is missing an access token.')
      return
    }

    if (!form) {
      setError('Provider form state is missing.')
      return
    }

    if (issues.length > 0) {
      setError(`Fix ${providerLabel(provider)} validation issues before saving.`)
      return
    }

    setSavingProvider(provider)
    setError(null)

    try {
      const payload = await saveAdminAiProviderConfig(accessToken, {
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
          changeNote: changeNote || undefined,
      })

      applyConsoleData(payload)
      setStatus(`Saved ${providerLabel(provider)}. Secret material stayed server-side, and the change was written to the audit log.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save provider configuration.')
    } finally {
      setSavingProvider(null)
    }
  }

  async function testProvider(provider: ProviderFormState['provider']) {
    const form = forms[provider]
    const issues = providerIssues[provider] ?? []

    if (!accessToken) {
      setError('Current Supabase session is missing an access token.')
      return
    }

    if (!form) {
      setError('Provider form state is missing.')
      return
    }

    if (issues.some((issue) => issue.includes('required') || issue.includes('valid') || issue.includes('must'))) {
      setError(`Fix ${providerLabel(provider)} validation issues before running a health test.`)
      return
    }

    setTestingProvider(provider)
    setError(null)

    try {
      const payload = await testAdminAiProviderConfig(accessToken, {
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
          changeNote: changeNote || undefined,
      })

      const testResult = payload.result as AdminAiProviderTestResult

      startTransition(() => {
        setTestResults((current) => ({
          ...current,
          [provider]: testResult,
        }))
        if (payload.configs) {
          setConfigs(payload.configs)
          setForms(createFormMap(payload.configs))
        }
        if (payload.auditLogs) {
          setAuditLogs(payload.auditLogs)
        }
      })

      setStatus(
        `${providerLabel(provider)} test passed in ${testResult.latency_ms} ms using ${testResult.request_mode} mode.`,
      )
    } catch (testError) {
      const message = testError instanceof Error ? testError.message : 'Provider connectivity test failed.'
      setError(message)

      try {
        const payload = await loadAdminAiConsole(accessToken, 24)
        applyConsoleData(payload)
      } catch {
        // Leave the latest local audit log list intact.
      }
    } finally {
      setTestingProvider(null)
    }
  }

  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Admin AI</p>
          <h1>Operate primary and backup engines like a real production console.</h1>
        </div>
        <div className="note-card">
          <span>Auth gate</span>
          <strong>Supabase admin session</strong>
          <p>Only authenticated members with owner, admin or ops role can enter this console and hit the server-side test/save routes.</p>
        </div>
      </section>

      <section className="split-grid">
        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">ACCESS</span>
            <h2>Secure console session</h2>
          </div>
          <p className="section-copy">
            This page only writes secrets to the server, never reads them back, and now uses your current Supabase access token instead of a bootstrap bearer secret.
          </p>
          <div className="stack-block compact-stack">
            <strong>Session identity</strong>
            <p>{user?.email ?? 'No active session'}</p>
            <span>{isConfigured ? 'Supabase Auth is configured for this deployment.' : 'Supabase Auth is not configured in this environment.'}</span>
          </div>
          <div className="form-toolbar">
            <button type="button" className="primary-action" onClick={loadConfigs} disabled={isLoading || !accessToken}>
              {isLoading ? 'Loading secure console...' : 'Load secure console'}
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
            <span className="panel-code">GOVERNANCE</span>
            <h2>Operator and audit context</h2>
          </div>
          <div className="control-grid">
            <div className="stack-block compact-stack">
              <strong>Audit actor</strong>
              <p>{user?.email ?? 'No active session'}</p>
              <span>The backend records the operator from the verified Supabase identity, so this field can no longer be spoofed from the browser.</span>
            </div>
            <div className="field-stack field-span-2">
              <label htmlFor="change-note">Change note</label>
              <textarea
                id="change-note"
                className="textarea-input"
                value={changeNote}
                onChange={(event) => setChangeNote(event.target.value)}
                placeholder="Why are you rotating a key or changing fallback order?"
              />
              <span className="field-hint">Keep the intent concise. This makes post-incident reviews much easier.</span>
            </div>
          </div>
        </article>
      </section>

      {hasLoaded ? (
        <>
          <section className="summary-grid">
            <article className="content-card summary-card">
              <span className="panel-code">ROUTING</span>
              <strong>{topology.primary ? providerShortLabel(topology.primary.provider) : 'No primary'}</strong>
              <p>Primary engine</p>
              <span>{topology.primary ? `${topology.primary.model} · priority ${topology.primary.priority}` : 'Enable at least one provider.'}</span>
            </article>
            <article className="content-card summary-card">
              <span className="panel-code">FAILOVER</span>
              <strong>{topology.backup ? providerShortLabel(topology.backup.provider) : 'No backup'}</strong>
              <p>Backup engine</p>
              <span>{topology.backup ? `${topology.backup.model} · priority ${topology.backup.priority}` : 'Add a second enabled provider for resilience.'}</span>
            </article>
            <article className="content-card summary-card">
              <span className="panel-code">DRAFT</span>
              <strong>{dirtyProviders.length}</strong>
              <p>Unsaved provider drafts</p>
              <span>{dirtyProviders.length > 0 ? `Pending: ${dirtyProviders.join(', ')}` : 'Console is in sync with stored config.'}</span>
            </article>
            <article className="content-card summary-card">
              <span className="panel-code">AUDIT</span>
              <strong>{auditLogs.length}</strong>
              <p>Recent admin events</p>
              <span>{auditLogs[0] ? `${auditLogs[0].action} · ${auditLogs[0].outcome} · ${formatTimestamp(auditLogs[0].created_at)}` : 'No audit rows yet.'}</span>
            </article>
          </section>

          {globalWarnings.length > 0 ? (
            <section className="content-card warning-card">
              <div className="panel-heading">
                <span className="panel-code">CHECKS</span>
                <h2>Operational warnings</h2>
              </div>
              <ul className="warning-list">
                {globalWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="admin-grid">
            {orderedConfigs.map((config) => {
              const form = forms[config.provider]
              if (!form) {
                return null
              }

              const saving = savingProvider === config.provider
              const testing = testingProvider === config.provider
              const issues = providerIssues[config.provider] ?? []
              const isDirty = dirtyProviders.includes(config.provider)
              const latestAudit = latestAuditForProvider(auditLogs, config.provider)
              const latestTestAudit = latestTestAuditForProvider(auditLogs, config.provider)
              const latestSaveAudit = latestSaveAuditForProvider(auditLogs, config.provider)
              const latestTestResult = testResults[config.provider]

              return (
                <article key={config.provider} className="content-card admin-card">
                  <div className="provider-header">
                    <div className="panel-heading">
                      <span className="panel-code">{config.provider.toUpperCase()}</span>
                      <h2>{config.display_name}</h2>
                    </div>
                    <span className={`status-badge ${form.enabled ? 'status-badge-live' : 'status-badge-muted'}`}>
                      {form.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <div className="pill-row">
                    <span className="suggestion-chip">Source: {config.source}</span>
                    <span className="suggestion-chip">Priority: {form.priority}</span>
                    <span className="suggestion-chip">
                      Secret: {config.api_key_configured || config.api_token_configured ? 'configured' : 'environment or empty'}
                    </span>
                    <span className="suggestion-chip">
                      Last test: {config.last_tested_at ? `${config.last_test_status ?? 'n/a'} · ${formatTimestamp(config.last_tested_at)}` : 'not run'}
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
                    {config.provider === 'workers-ai' ? (
                      <label>
                        <input
                          type="checkbox"
                          checked={form.request_mode === 'binding'}
                          onChange={(event) =>
                            updateForm(config.provider, 'request_mode', event.target.checked ? 'binding' : 'rest')
                          }
                        />
                        Prefer binding mode
                      </label>
                    ) : null}
                  </div>

                  {config.provider === 'workers-ai' ? (
                    <div className="control-grid">
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
                        <span className="field-hint">Binding is leaner. REST is better when you need explicit account-level credentials.</span>
                      </div>
                      <div className="field-stack">
                        <label>Cloudflare account ID</label>
                        <input
                          type="text"
                          value={form.account_id}
                          onChange={(event) => updateForm(config.provider, 'account_id', event.target.value)}
                          placeholder="Required only for REST mode"
                        />
                      </div>
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
                      <span className="secret-note">Current state: {config.api_key_hint ?? 'No stored secret in admin DB.'}</span>
                    </div>
                  ) : null}

                  {config.provider === 'workers-ai' ? (
                    <div className="field-stack">
                      <label>Workers AI API token</label>
                      <input
                        type="password"
                        value={form.apiToken}
                        onChange={(event) => updateForm(config.provider, 'apiToken', event.target.value)}
                        placeholder={config.api_token_hint ?? 'Enter a new API token to replace the current one'}
                      />
                      <span className="secret-note">
                        Current state: {config.api_token_hint ?? 'No stored token in admin DB.'}
                      </span>
                    </div>
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

                  {issues.length > 0 ? (
                    <ul className="warning-list compact-warning-list">
                      {issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="status-detail">This provider draft passes client-side checks and is ready to test or save.</p>
                  )}

                  <div className="provider-meta-grid">
                    <div className="stack-block compact-stack">
                      <strong>Latest saved change</strong>
                      <p>{latestSaveAudit ? `${latestSaveAudit.outcome} · ${formatTimestamp(latestSaveAudit.created_at)}` : 'No save audit yet'}</p>
                      <span>{latestSaveAudit?.operator_name ? `by ${latestSaveAudit.operator_name}` : 'Operator not recorded yet'}</span>
                    </div>
                    <div className="stack-block compact-stack">
                      <strong>Latest health check</strong>
                      <p>{config.last_test_latency_ms !== null ? `${config.last_test_latency_ms} ms` : latestTestResult ? `${latestTestResult.latency_ms} ms` : latestTestAudit ? latestTestAudit.outcome : 'Not tested'}</p>
                      <span>
                        {config.last_test_message ?? latestTestResult?.message ?? latestTestAudit?.message ?? 'Run a test before promoting this provider in production.'}
                      </span>
                    </div>
                  </div>

                  <div className="form-toolbar">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => testProvider(config.provider)}
                      disabled={testing}
                    >
                      {testing ? 'Testing provider...' : 'Test draft config'}
                    </button>
                    <button
                      type="button"
                      className="primary-action"
                      onClick={() => saveProvider(config.provider)}
                      disabled={saving}
                    >
                      {saving ? 'Saving secure config...' : `Save ${providerShortLabel(config.provider)}`}
                    </button>
                    <button type="button" className="ghost-link" onClick={() => resetProvider(config.provider)}>
                      {isDirty ? 'Reset draft' : 'Reset'}
                    </button>
                    <span className={`status-badge ${isDirty ? 'status-badge-warn' : 'status-badge-muted'}`}>
                      {isDirty ? 'Unsaved changes' : 'In sync'}
                    </span>
                  </div>

                  <p className="status-detail">
                    Last update: {formatTimestamp(config.updated_at)}
                    {config.updated_by ? ` · by ${config.updated_by}` : ''}
                    {latestAudit ? ` · latest audit ${latestAudit.action}/${latestAudit.outcome}` : ''}
                  </p>
                </article>
              )
            })}
          </section>

          <section className="content-card audit-card">
            <div className="panel-heading">
              <span className="panel-code">AUDIT LOG</span>
              <h2>Recent admin configuration events</h2>
            </div>
            <p className="section-copy">
              Save and test actions are both recorded so we can trace who changed fallback order, when a key rotation happened, and when a provider started failing.
            </p>
            {auditLogs.length > 0 ? (
              <div className="audit-list">
                {auditLogs.map((log) => (
                  <article key={log.id} className="audit-item">
                    <div className="audit-item-topline">
                      <div>
                        <strong>{providerShortLabel(log.provider)}</strong>
                        <span>{log.action.toUpperCase()} · {log.outcome}</span>
                      </div>
                      <span>{formatTimestamp(log.created_at)}</span>
                    </div>
                    <p>{log.message ?? 'No message recorded.'}</p>
                    <div className="audit-meta">
                      <span>{log.operator_name ? `Operator: ${log.operator_name}` : 'Operator missing'}</span>
                      <span>{log.change_note ? `Note: ${log.change_note}` : 'No change note'}</span>
                      <span>{log.latency_ms !== null ? `Latency: ${log.latency_ms} ms` : 'Latency: n/a'}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="status-detail">No audit events are stored yet.</p>
            )}
          </section>
        </>
      ) : null}
    </main>
  )
}

export default AdminAiPage
