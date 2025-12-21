import { ReactNode, useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { logout } from '../store/slices/authSlice'
import { showToast } from '../utils/toast'
import { getSocket } from '../services/socket'
import { Message, paymentApi, Balance, Notification, authApi } from '../services/api'
import { Socket } from 'socket.io-client'
import Footer from './Footer'
import NotificationDropdown from './NotificationDropdown'
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Home,
  Rss,
  MessageSquare,
  Users,
  ChevronDown,
  Wallet,
  User,
  LogOut,
  ShieldAlert,
  Menu,
  X,
  PlusCircle,
  Briefcase,
  History,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react"

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [balance, setBalance] = useState<Balance | null>(null)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(null)
  const socketRef = useRef<Socket | null>(null)

  const handleSignOut = () => {
    dispatch(logout())
    showToast.info('You have been logged out')
    navigate('/signin')
  }

  const refreshBalance = useCallback(() => {
    if (isAuthenticated && user) {
      paymentApi.getBalance()
        .then(setBalance)
        .catch((error) => {
          console.error('Failed to fetch balance:', error)
        })
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    refreshBalance()
  }, [refreshBalance])

  const fetch2FAStatus = useCallback(() => {
    if (isAuthenticated && user) {
      authApi.twoFactor.getStatus()
        .then((status) => {
          setTwoFactorEnabled(status.enabled)
        })
        .catch((error) => {
          console.error('Failed to fetch 2FA status:', error)
          setTwoFactorEnabled(false)
        })
    } else {
      setTwoFactorEnabled(null)
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    fetch2FAStatus()
  }, [fetch2FAStatus])

  useEffect(() => {
    if (location.pathname !== '/settings/security' && isAuthenticated) {
      const timer = setTimeout(() => {
        fetch2FAStatus()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [location.pathname, isAuthenticated, fetch2FAStatus])

  useEffect(() => {
    const handleBalanceUpdate = () => {
      if (location.pathname.startsWith('/chat/')) {
        refreshBalance()
      }
    }
    window.addEventListener('balance-updated', handleBalanceUpdate)
    return () => window.removeEventListener('balance-updated', handleBalanceUpdate)
  }, [refreshBalance, location.pathname])

  useEffect(() => {
    const handle2FAStatusUpdate = () => fetch2FAStatus()
    window.addEventListener('2fa-status-updated', handle2FAStatusUpdate)
    return () => window.removeEventListener('2fa-status-updated', handle2FAStatusUpdate)
  }, [fetch2FAStatus])

  useEffect(() => {
    if (!isAuthenticated || !user) return

    const socket = getSocket()
    if (!socket) return
    socketRef.current = socket

    const handleNewMessage = (message: Message) => {
      if (message.senderId === user.id) return
      const isOnChatPage = location.pathname.startsWith('/chat/')
      const currentChatId = location.pathname.split('/chat/')[1]
      
      if (!isOnChatPage || (isOnChatPage && message.conversationId !== currentChatId)) {
        const senderName = message.sender
          ? `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || message.sender.userName || 'Someone'
          : 'Someone'
        
        showToast.info(
          <div onClick={() => navigate(`/chat/${message.conversationId}`)} className="cursor-pointer">
            <p className="font-semibold">{senderName}</p>
            <p className="text-sm truncate">{message.message}</p>
          </div>
        )
      }
    }

    const handleBalanceUpdate = (data: { balance: Balance }) => setBalance(data.balance)

    const handleNewNotification = (notification: Notification) => {
      const isOnChatPage = location.pathname.startsWith('/chat/')
      const currentChatId = location.pathname.split('/chat/')[1]
      const notificationChatId = notification.metadata?.conversationId

      if (notification.type === 'message' && notification.title === 'New Connection Request') {
        showToast.info(
          <div onClick={() => notification.metadata?.conversationId && navigate(`/chat/${notification.metadata.conversationId}`)} className="cursor-pointer">
            <p className="font-semibold">{notification.title}</p>
            <p className="text-sm">{notification.message}</p>
          </div>
        )
      } else if (notification.type === 'message' && notification.title.startsWith('New message from')) {
        if (!isOnChatPage || (isOnChatPage && notificationChatId !== currentChatId)) {
          showToast.info(
            <div onClick={() => notification.metadata?.conversationId && navigate(`/chat/${notification.metadata.conversationId}`)} className="cursor-pointer">
              <p className="font-semibold">{notification.title}</p>
              <p className="text-sm">{notification.message}</p>
            </div>
          )
        }
      } else if (notification.type === 'payment_withdraw') {
        showToast.success(
          <div>
            <p className="font-semibold">{notification.title}</p>
            <p className="text-sm">{notification.message}</p>
          </div>
        )
      } else if (['milestone_created', 'milestone_updated', 'milestone_payment_pending'].includes(notification.type)) {
        showToast.info(
          <div onClick={() => notification.metadata?.conversationId && navigate(`/chat/${notification.metadata.conversationId}`)} className="cursor-pointer">
            <p className="font-semibold">{notification.title}</p>
            <p className="text-sm">{notification.message}</p>
          </div>
        )
      }
    }

    socket.on('new_message', handleNewMessage)
    socket.on('balance_updated', handleBalanceUpdate)
    socket.on('new_notification', handleNewNotification)

    return () => {
      if (socketRef.current) {
        socketRef.current.off('new_message', handleNewMessage)
        socketRef.current.off('balance_updated', handleBalanceUpdate)
        socketRef.current.off('new_notification', handleNewNotification)
      }
    }
  }, [isAuthenticated, user, location.pathname, navigate])

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg group-hover:scale-105 transition-transform">
              O
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">OmniMart</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            <Button variant="ghost" asChild className={location.pathname === '/' ? "bg-muted" : ""}>
              <Link to="/" className="gap-2"><Home className="w-4 h-4" /> Home</Link>
            </Button>
            <Button variant="ghost" asChild className={location.pathname === '/feed' ? "bg-muted" : ""}>
              <Link to="/feed" className="gap-2"><Rss className="w-4 h-4" /> Feed</Link>
            </Button>
            {isAuthenticated && (
              <>
                <Button variant="ghost" asChild className={location.pathname.startsWith('/chat') ? "bg-muted" : ""}>
                  <Link to="/chat" className="gap-2"><MessageSquare className="w-4 h-4" /> Chat</Link>
                </Button>
                <Button variant="ghost" asChild className={location.pathname === '/referral' ? "bg-muted" : ""}>
                  <Link to="/referral" className="gap-2"><Users className="w-4 h-4" /> Referral</Link>
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  Services <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/services" className="gap-2"><Briefcase className="w-4 h-4" /> All Services</Link>
                </DropdownMenuItem>
                {isAuthenticated && (
                  <DropdownMenuItem asChild>
                    <Link to="/my-services" className="gap-2"><User className="w-4 h-4" /> My Services</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
            {isAuthenticated && user ? (
              <>
                {twoFactorEnabled === false && (
                  <Button variant="outline" size="sm" asChild className="hidden md:flex gap-2 border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 hover:text-yellow-800">
                    <Link to="/settings/security">
                      <ShieldAlert className="w-4 h-4 text-yellow-600" />
                      Enable 2FA
                    </Link>
                  </Button>
                )}

                <NotificationDropdown userId={user.id} />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="hidden md:flex gap-2 items-center rounded-full px-4 border-border">
                      <Wallet className="w-4 h-4 text-primary" />
                      <span className="font-semibold">
                        {balance ? `${Number(balance.amount).toFixed(2)} USD` : '0.00 USD'}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Wallet Balance</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/charge" className="gap-2"><ArrowDownLeft className="w-4 h-4" /> Charge</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/withdraw" className="gap-2"><ArrowUpRight className="w-4 h-4" /> Withdraw</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/transactions" className="gap-2"><History className="w-4 h-4" /> Transactions</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-muted transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                        {user.firstName?.[0] || user.email[0].toUpperCase()}
                      </div>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.firstName} {user.lastName}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="gap-2"><User className="w-4 h-4" /> Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/settings/security" className="gap-2"><ShieldAlert className="w-4 h-4" /> Security</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive gap-2">
                      <LogOut className="w-4 h-4" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" asChild>
                  <Link to="/signin">Log In</Link>
                </Button>
                <Button asChild className="rounded-full px-6">
                  <Link to="/signup">Sign Up</Link>
                </Button>
              </div>
            )}

            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-background border-b border-border animate-in slide-in-from-top duration-200">
            <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
              <Button variant="ghost" asChild className="justify-start gap-4 h-12" onClick={() => setMobileMenuOpen(false)}>
                <Link to="/"><Home className="w-5 h-5" /> Home</Link>
              </Button>
              <Button variant="ghost" asChild className="justify-start gap-4 h-12" onClick={() => setMobileMenuOpen(false)}>
                <Link to="/feed"><Rss className="w-5 h-5" /> Feed</Link>
              </Button>
              {isAuthenticated && (
                <>
                  <Button variant="ghost" asChild className="justify-start gap-4 h-12" onClick={() => setMobileMenuOpen(false)}>
                    <Link to="/chat"><MessageSquare className="w-5 h-5" /> Chat</Link>
                  </Button>
                  <Button variant="ghost" asChild className="justify-start gap-4 h-12" onClick={() => setMobileMenuOpen(false)}>
                    <Link to="/referral"><Users className="w-5 h-5" /> Referral</Link>
                  </Button>
                  <div className="h-px bg-border my-1" />
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Services</div>
                  <Button variant="ghost" asChild className="justify-start gap-4 h-12" onClick={() => setMobileMenuOpen(false)}>
                    <Link to="/services"><Briefcase className="w-5 h-5" /> All Services</Link>
                  </Button>
                  <Button variant="ghost" asChild className="justify-start gap-4 h-12" onClick={() => setMobileMenuOpen(false)}>
                    <Link to="/my-services"><User className="w-5 h-5" /> My Services</Link>
                  </Button>
                  <div className="h-px bg-border my-1" />
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account</div>
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/40 rounded-lg mb-2">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-primary" />
                      <span className="font-bold">{balance ? `${Number(balance.amount).toFixed(2)} USD` : '0.00 USD'}</span>
                    </div>
                    <Button variant="outline" size="sm" asChild onClick={() => setMobileMenuOpen(false)}>
                      <Link to="/charge">Charge</Link>
                    </Button>
                  </div>
                  <Button variant="ghost" asChild className="justify-start gap-4 h-12" onClick={() => setMobileMenuOpen(false)}>
                    <Link to="/profile"><User className="w-5 h-5" /> Profile</Link>
                  </Button>
                  <Button variant="ghost" onClick={handleSignOut} className="justify-start gap-4 h-12 text-destructive hover:text-destructive">
                    <LogOut className="w-5 h-5" /> Logout
                  </Button>
                </>
              )}
              {!isAuthenticated && (
                <div className="flex flex-col gap-2 mt-2">
                  <Button variant="outline" asChild onClick={() => setMobileMenuOpen(false)}>
                    <Link to="/signin">Log In</Link>
                  </Button>
                  <Button asChild onClick={() => setMobileMenuOpen(false)}>
                    <Link to="/signup">Sign Up</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 pt-16 md:pt-20">
        <div className="container mx-auto">
          {children}
        </div>
      </main>
      
      {!location.pathname.startsWith('/chat/') && <Footer />}
    </div>
  )
}

export default Layout
