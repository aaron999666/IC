import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { buildWebPageSchema, useSeo } from '../lib/seo'

function AuthPage() {
  const title = '登录后台 | 芯汇 ICCoreHub'
  const description = '通过 Supabase Auth 登录芯汇 ICCoreHub 的运营工作台与 AI 管理后台。'

  useSeo({
    title,
    description,
    path: '/auth',
    robots: 'noindex, nofollow, max-image-preview:large',
    schema: buildWebPageSchema('/auth', title, description),
  })

  const { isConfigured, isReady, session, signInWithPassword } = useAuth()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nextPath = searchParams.get('next') || '/dashboard'

  if (isReady && session) {
    return <Navigate to={nextPath} replace />
  }

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setError('请输入 Supabase Auth 账号邮箱和密码。')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await signInWithPassword(email.trim(), password)
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : '登录失败。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page auth-page">
      <section className="split-grid auth-grid">
        <article className="content-card">
          <p className="eyebrow">Auth</p>
          <h1>Sign in to the private operations layer.</h1>
          <p className="section-copy">
            Dashboard、积分账本、联系方式解锁记录和 AI 配置后台现在都挂在 Supabase 登录态之下。
          </p>
          {!isConfigured ? (
            <p className="inline-error">当前环境没有配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`，登录能力不可用。</p>
          ) : null}
          <div className="field-stack">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ops@iccorehub.com"
            />
          </div>
          <div className="field-stack">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your Supabase Auth password"
            />
          </div>
          <div className="form-toolbar">
            <button type="button" className="primary-action" onClick={handleSubmit} disabled={!isConfigured || isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          {error ? <p className="inline-error">{error}</p> : null}
        </article>

        <article className="content-card">
          <div className="panel-heading">
            <span className="panel-code">ACCESS MODEL</span>
            <h2>What unlocks after login</h2>
          </div>
          <ul className="plain-list">
            <li>积分余额、积分流水与联系方式解锁历史会按当前企业身份加载。</li>
            <li>`/admin/ai` 只允许拥有 `owner`、`admin` 或 `ops` 角色的成员进入。</li>
            <li>AI 配置保存和联通性测试会自动带上真实登录身份，审计日志不再依赖手填操作人。</li>
          </ul>
        </article>
      </section>
    </main>
  )
}

export default AuthPage
