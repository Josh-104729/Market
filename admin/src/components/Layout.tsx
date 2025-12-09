import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSignOutAlt, faHome, faFolder, faBriefcase, faNewspaper, faWallet, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { logout } from '../store/slices/authSlice'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.auth.user)

  const handleLogout = () => {
    dispatch(logout())
    navigate('/signin')
  }

  const navItems = [
    { path: '/', label: 'Dashboard', icon: faHome },
    { path: '/categories', label: 'Categories', icon: faFolder },
    { path: '/services', label: 'Services', icon: faBriefcase },
    { path: '/blog', label: 'Blog', icon: faNewspaper },
    { path: '/temp-wallets', label: 'Temp Wallets', icon: faWallet },
    { path: '/withdraws', label: 'Withdraws', icon: faMoneyBillWave },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0f1f 0%, #0f172a 100%)' }}>
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/20 border-b border-white/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold text-white">OmniMart Admin</h2>
            <div className="flex items-center space-x-4">
              <span className="text-slate-300 text-sm md:text-base">
                {user?.email || 'Admin'}
              </span>
              <button
                onClick={handleLogout}
                className="text-white glass-card hover:bg-white/15 px-4 py-2 rounded-full font-semibold transition-all flex items-center space-x-2"
              >
                <FontAwesomeIcon icon={faSignOutAlt} />
                <span>Logout</span>
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                  location.pathname === item.path
                    ? 'bg-primary text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <FontAwesomeIcon icon={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
      <main className="pt-32">{children}</main>
    </div>
  )
}

export default Layout

