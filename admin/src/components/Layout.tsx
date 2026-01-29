import { ReactNode } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { logout } from '../store/slices/authSlice'
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  FolderTree,
  Briefcase,
  FileText,
  Wallet,
  ArrowUpRight,
  ArrowLeftRight,
  Gavel,
  ShieldAlert,
  Megaphone,
  LifeBuoy,
  Users,
  LogOut,
  MessageSquare,
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
    { path: '/users', label: 'Users', icon: Users },
    { path: '/temp-wallets', label: 'Temp Wallets', icon: Wallet },
    { path: '/withdraws', label: 'Withdraws', icon: ArrowUpRight },
    { path: '/master-wallet', label: 'Master Wallet', icon: ArrowLeftRight },
    { path: '/disputes', label: 'Disputes', icon: Gavel },
    { path: '/fraud', label: 'Fraud', icon: ShieldAlert },
    { path: '/chat-history', label: 'Chat History', icon: MessageSquare },
    { path: '/broadcast', label: 'Broadcast', icon: Megaphone },
    { path: '/helps', label: 'Helps', icon: LifeBuoy },
  ]

  const getIsActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const currentPageLabel =
    navItems.find((item) => getIsActive(item.path))?.label || 'Dashboard'

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link to="/" className="flex items-center gap-2 px-2 py-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold">
              O
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold text-sidebar-foreground">OmniMart</span>
              <span className="text-xs text-sidebar-foreground/70">Admin</span>
            </div>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={getIsActive(item.path)}
                    tooltip={item.label}
                  >
                    <Link to={item.path}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3">
            <div className="text-sm font-medium text-sidebar-foreground">
              {user?.userName || 'Admin'}
            </div>
            <div className="text-xs text-sidebar-foreground/70">{user?.email}</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full justify-start gap-2 text-sidebar-foreground/80"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="flex-1 text-sm font-medium text-foreground">{currentPageLabel}</div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
