import { NavLink, Route, Routes } from 'react-router-dom'
import BomPage from './pages/BomPage'
import DashboardPage from './pages/DashboardPage'
import DataHubPage from './pages/DataHubPage'
import HomePage from './pages/HomePage'
import MarketPage from './pages/MarketPage'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/market', label: 'Market Board' },
  { to: '/dashboard', label: 'Ops Desk' },
  { to: '/bom', label: 'AI BOM' },
  { to: '/data-hub', label: 'Data Spine' },
]

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand-mark" to="/">
          <img src="/iccorehub-mark.svg" alt="ICCoreHub logo" />
          <div className="brand-copy">
            <strong>芯枢 IC</strong>
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
      </header>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/bom" element={<BomPage />} />
        <Route path="/data-hub" element={<DataHubPage />} />
      </Routes>
    </div>
  )
}

export default App
