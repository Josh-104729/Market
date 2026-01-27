import { ReactNode, useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { logout, updateUser } from '../store/slices/authSlice'
import { showToast } from '../utils/toast'
import { getSocket, disconnectSocket } from '../services/socket'
import { Message, paymentApi, Balance, Notification, authApi } from '../services/api'
import { Socket } from 'socket.io-client'
import Footer from './Footer'
import NotificationDropdown from './NotificationDropdown'
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ShieldAlert, Wallet, ArrowDownLeft, ArrowUpRight, History } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const [balance, setBalance] = useState<Balance | null>(null)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const [profileHydrated, setProfileHydrated] = useState(false)
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0)

  const handleSignOut = () => {
    // Disconnect socket before logout
    disconnectSocket()
    dispatch(logout())
    showToast.info('You have been logged out')
    navigate('/signin')
  }

  // If the websocket reports auth expiry/invalid token, force logout so the app can recover cleanly.
  // Note: This is a backup handler. The main handler is in App.tsx for global coverage.
  useEffect(() => {
    const onAuthExpired = () => {
      // Disconnect socket before logout
      disconnectSocket()
      dispatch(logout())
      showToast.info('Your session expired. Please sign in again.')
      navigate('/signin')
    }
    window.addEventListener('auth-expired', onAuthExpired as any)
    return () => window.removeEventListener('auth-expired', onAuthExpired as any)
  }, [dispatch, navigate])

  const refreshBalance = useCallback(() => {
    if (isAuthenticated && user) {
      paymentApi.getBalance()
        .then(setBalance)
        .catch((error) => {
          console.error('Failed to fetch balance:', error)
        })
    }
  }, [isAuthenticated, user])

  // Hydrate full user profile (incl. avatar) after refresh / older sessions where signin didn't include avatar.
  useEffect(() => {
    if (!isAuthenticated || !user || profileHydrated) return

    authApi.getProfile()
      .then((profile) => {
        dispatch(updateUser(profile))
      })
      .catch((error) => {
        // Not fatal; user can still browse. 401 will be handled by auth flow elsewhere.
        console.error('Failed to hydrate profile:', error)
      })
      .finally(() => setProfileHydrated(true))
  }, [dispatch, isAuthenticated, profileHydrated, user])

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

    const fetchUnreadCount = async () => {
      try {
        const conversations = await conversationApi.getAll()
        const total = conversations.reduce((sum, conv) => {
          const unread = typeof conv.unreadCount === 'number' ? conv.unreadCount : 0
          return sum + unread
        }, 0)
        setTotalUnreadMessages(total)
      } catch (error) {
        console.error('Failed to fetch unread messages count:', error)
      }
    }

    // Fetch initial unread count
    fetchUnreadCount()

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
        
        // Update unread count
        setTotalUnreadMessages((prev) => prev + 1)
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

    const handleMessagesRead = () => {
      // Refresh unread count when messages are read
      fetchUnreadCount()
    }

    socket.on('new_message', handleNewMessage)
    socket.on('balance_updated', handleBalanceUpdate)
    socket.on('new_notification', handleNewNotification)
    socket.on('messages_read', handleMessagesRead)

    // Listen for conversation viewed events to update unread count
    const handleConversationViewed = () => {
      fetchUnreadCount()
    }
    window.addEventListener('conversation-viewed', handleConversationViewed)

    return () => {
      if (socketRef.current) {
        socketRef.current.off('new_message', handleNewMessage)
        socketRef.current.off('balance_updated', handleBalanceUpdate)
        socketRef.current.off('new_notification', handleNewNotification)
        socketRef.current.off('messages_read', handleMessagesRead)
      }
      window.removeEventListener('conversation-viewed', handleConversationViewed)
    }
  }, [isAuthenticated, user, location.pathname, navigate])

  const title = useMemo(() => {
    const path = location.pathname
    if (path === "/" || path === "/dashboard") return "Dashboard"
    if (path.startsWith("/feed")) return "Feed"
    if (path.startsWith("/services/new")) return "Create Service"
    if (path.startsWith("/services")) return "Services"
    if (path.startsWith("/my-services")) return "My Services"
    if (path.startsWith("/chat")) return "Chat"
    if (path.startsWith("/profile")) return "Profile"
    if (path.startsWith("/settings/security")) return "Security"
    if (path.startsWith("/charge")) return "Charge"
    if (path.startsWith("/withdraw")) return "Withdraw"
    if (path.startsWith("/transactions")) return "Transactions"
    if (path.startsWith("/notifications")) return "Notifications"
    if (path.startsWith("/referral")) return "Referral"
    return "Dashboard"
  }, [location.pathname])

  const headerRight = useMemo(() => {
    if (!isAuthenticated || !user) return null
    return (
      <div className="flex items-center gap-2">
        {twoFactorEnabled === false && (
          <Button
            variant="outline"
            size="sm"
            className="hidden md:flex gap-2 border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 hover:text-yellow-800"
            onClick={() => navigate("/settings/security")}
          >
            <ShieldAlert className="w-4 h-4 text-yellow-600" />
            Enable 2FA
          </Button>
        )}

        <NotificationDropdown userId={user.id} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex gap-2 items-center rounded-full px-4"
            >
              <Wallet className="w-4 h-4 text-primary" />
              <span className="font-semibold">
                {balance ? `${Number(balance.amount).toFixed(2)} USD` : "0.00 USD"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Wallet</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/charge")} className="gap-2">
              <ArrowDownLeft className="w-4 h-4" /> Charge
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/withdraw")} className="gap-2">
              <ArrowUpRight className="w-4 h-4" /> Withdraw
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/transactions")} className="gap-2">
              <History className="w-4 h-4" /> Transactions
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />
      </div>
    )
  }, [balance, isAuthenticated, navigate, twoFactorEnabled, user])

  // If not logged in, don't show the dashboard shell.
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="min-h-screen">{children}</main>
        {!location.pathname.startsWith('/chat/') && <Footer />}
      </div>
    )
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar
        user={{
          name:
            `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
            user.userName ||
            user.email,
          email: user.email,
          avatar: (user as any).avatar || "",
        }}
        onLogout={handleSignOut}
        unreadMessagesCount={totalUnreadMessages}
      />
      <SidebarInset>
        <SiteHeader title={title} right={headerRight} />
        <div className="flex flex-1 flex-col">
          <div className="container mx-auto px-4 py-4">{children}</div>
        </div>
        {!location.pathname.startsWith('/chat/') && <Footer />}
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
