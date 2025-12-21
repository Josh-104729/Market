import { ReactNode } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { logout } from '../store/slices/authSlice'
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  FolderTree,
  Briefcase,
  FileText,
  Wallet,
  ArrowUpRight,
  Gavel,
  Megaphone,
  LogOut,
  Menu,
} from "lucide-react"

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
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/categories', label: 'Categories', icon: FolderTree },
    { path: '/services', label: 'Services', icon: Briefcase },
    { path: '/blog', label: 'Blog', icon: FileText },
    { path: '/temp-wallets', label: 'Temp Wallets', icon: Wallet },
    { path: '/withdraws', label: 'Withdraws', icon: ArrowUpRight },
    { path: '/disputes', label: 'Disputes', icon: Gavel },
    { path: '/broadcast', label: 'Broadcast', icon: Megaphone },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold group-hover:scale-105 transition-transform">
                O
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground hidden sm:block">
                OmniMart Admin
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  variant={location.pathname === item.path ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate(item.path)}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium text-foreground leading-none">
                {user?.userName || 'Admin'}
              </span>
              <span className="text-xs text-muted-foreground">
                {user?.email}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-muted-foreground border-border"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4">
          {children}
        </div>
      </main>
    </div>
  )
}

export default Layout
