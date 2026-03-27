import type { ReactElement } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import AdminAiPage from './pages/AdminAiPage'
import AuthPage from './pages/AuthPage'
import BomPage from './pages/BomPage'
import DashboardPage from './pages/DashboardPage'
import DataHubPage from './pages/DataHubPage'
import HomePage from './pages/HomePage'
import MarketPage from './pages/MarketPage'
import RechargePage from './pages/RechargePage'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/market', label: 'Market Board' },
  { to: '/dashboard', label: 'Ops Desk' },
  { to: '/bom', label: 'AI BOM' },
  { to: '/data-hub', label: 'Data Spine' },
]

function RequireAuth({ children }: { children: ReactElement }) {
  const { isReady, isConfigured, session } = useAuth()
  const location = useLocation()

  if (!isConfigured) {
    return children
  }

  if (!isReady) {
    return (
      <main className="page">
        <section className="content-card">
          <p className="eyebrow">Auth</p>
          <h1>Checking private access...</h1>
        </section>
      </main>
    )
  }

  if (!session) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />
  }

  return children
}

function RequireAdminRole({ children }: { children: ReactElement }) {
  const { isReady, isConfigured, isAdmin, session } = useAuth()
  const location = useLocation()

  if (!isConfigured) {
    return children
  }

  if (!isReady) {
    return (
      <main className="page">
        <section className="content-card">
          <p className="eyebrow">Admin</p>
          <h1>Verifying admin role...</h1>
        </section>
      </main>
    )
  }

  if (!session) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />
  }

  if (!isAdmin) {
    return (
      <main className="page">
        <section className="content-card">
          <p className="eyebrow">Admin</p>
          <h1>Access requires owner, admin or ops role.</h1>
          <p className="section-copy">
            当前登录账号已经进入私有后台，但没有平台管理权限。
          </p>
        </section>
      </main>
    )
  }

  return children
}

function TopbarSessionControls() {
  const {
    isConfigured,
    isReady,
    memberships,
    selectedCompanyId,
    selectedCompanyName,
    user,
    signOut,
    setSelectedCompanyId,
  } = useAuth()

  return (
    <div className="session-strip">
      {isConfigured && isReady && user ? (
        <>
          {memberships.length > 1 ? (
            <select
              className="session-select"
              value={selectedCompanyId ?? ''}
              onChange={(event) => setSelectedCompanyId(event.target.value)}
              aria-label="Switch company context"
            >
              {memberships.map((membership) => (
                <option key={membership.company_id} value={membership.company_id}>
                  {membership.company_name} · {membership.role}
                </option>
              ))}
            </select>
          ) : selectedCompanyName ? (
            <span>{selectedCompanyName}</span>
          ) : null}
          <span>{user.email ?? 'authenticated user'}</span>
          <button type="button" className="inline-action" onClick={() => void signOut()}>
            Sign out
          </button>
        </>
      ) : (
        <NavLink className="nav-link" to="/auth">
          Sign in
        </NavLink>
      )}
    </div>
  )
}

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand-mark" to="/">
          <img src="/iccorehub-mark.svg" alt="芯汇 ICCoreHub logo" />
          <div className="brand-copy">
            <strong>芯汇 ICCoreHub</strong>
            <small>ICCoreHub.com</small>
          </div>
        </NavLink>

        <nav className="main-nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="status-strip">
          <span>Dual-engine BOM</span>
          <span>RLS vault</span>
          <span>Points ledger</span>
        </div>
        <TopbarSessionControls />
      </header>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/dashboard"
          element={(
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/recharge"
          element={(
            <RequireAuth>
              <RechargePage />
            </RequireAuth>
          )}
        />
        <Route
          path="/admin/ai"
          element={(
            <RequireAdminRole>
              <AdminAiPage />
            </RequireAdminRole>
          )}
        />
        <Route path="/bom" element={<BomPage />} />
        <Route path="/data-hub" element={<DataHubPage />} />
      </Routes>
    </div>
  )
}

export default App
