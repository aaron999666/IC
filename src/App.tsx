import { NavLink, Route, Routes } from 'react-router-dom'
import BomPage from './pages/BomPage'
import DashboardPage from './pages/DashboardPage'
import DataHubPage from './pages/DataHubPage'
import HomePage from './pages/HomePage'
import MarketPage from './pages/MarketPage'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/market', label: 'Buyer RFQ' },
  { to: '/dashboard', label: 'Seller Inventory' },
  { to: '/bom', label: 'AI BOM' },
  { to: '/data-hub', label: 'Data Center' },
]

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand-mark" to="/">
          <span>IC</span>
          <div>
            <strong>MatchRail</strong>
            <small>pure brokerage for chip trade</small>
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
          <span>Escrow-ready</span>
          <span>RLS-first</span>
          <span>Cloudflare edge</span>
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
