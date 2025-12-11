import { ReactNode, useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faSignOutAlt, faUserCircle, faBars, faWallet } from '@fortawesome/free-solid-svg-icons'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { logout } from '../store/slices/authSlice'
import { showToast } from '../utils/toast'
import { getSocket } from '../services/socket'
import { Message, paymentApi, Balance } from '../services/api'
import { Socket } from 'socket.io-client'
import Footer from './Footer'
import NotificationDropdown from './NotificationDropdown'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [balanceDropdownOpen, setBalanceDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [balance, setBalance] = useState<Balance | null>(null)
  const servicesDropdownRef = useRef<HTMLDivElement>(null)
  const userDropdownRef = useRef<HTMLDivElement>(null)
  const balanceDropdownRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)

  const handleSignOut = () => {
    dispatch(logout())
    showToast.info('You have been logged out')
    navigate('/signin')
  }

  // Fetch balance function
  const refreshBalance = useCallback(() => {
    if (isAuthenticated && user) {
      paymentApi.getBalance()
        .then(setBalance)
        .catch((error) => {
          console.error('Failed to fetch balance:', error)
        })
    }
  }, [isAuthenticated, user])

  // Fetch balance on mount and when auth changes
  useEffect(() => {
    refreshBalance()
  }, [refreshBalance])

  // Listen for balance update events (from Chat page when milestones are created/released)
  useEffect(() => {
    const handleBalanceUpdate = () => {
      // Only refresh if we're on the chat page
      if (location.pathname.startsWith('/chat/')) {
        refreshBalance()
      }
    }

    window.addEventListener('balance-updated', handleBalanceUpdate)
    return () => {
      window.removeEventListener('balance-updated', handleBalanceUpdate)
    }
  }, [refreshBalance, location.pathname])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (servicesDropdownRef.current && !servicesDropdownRef.current.contains(event.target as Node)) {
        setServicesDropdownOpen(false)
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false)
      }
      if (balanceDropdownRef.current && !balanceDropdownRef.current.contains(event.target as Node)) {
        setBalanceDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuOpen) {
        const target = event.target as HTMLElement
        if (!target.closest('.mobile-menu-container')) {
          setMobileMenuOpen(false)
        }
      }
    }

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [mobileMenuOpen])

  // Set up global socket listener for incoming messages
  useEffect(() => {
    if (!isAuthenticated || !user) {
      return
    }

    const socket = getSocket()
    if (!socket) {
      return
    }

    socketRef.current = socket

    const handleNewMessage = (message: Message) => {
      if (message.senderId === user.id) {
        return
      }

      const isOnChatPage = location.pathname.startsWith('/chat/')
      const currentChatId = location.pathname.split('/chat/')[1]
      
      if (!isOnChatPage || (isOnChatPage && message.conversationId !== currentChatId)) {
        const senderName = message.sender
          ? `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || message.sender.userName || 'Someone'
          : 'Someone'
        
        const messagePreview = message.message.length > 50 
          ? message.message.substring(0, 50) + '...'
          : message.message

        const toastContent = (
          <div 
            onClick={() => navigate(`/chat/${message.conversationId}`)}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="font-semibold text-white">{senderName}</div>
            <div className="text-sm opacity-90 text-gray-200 mt-1">{messagePreview}</div>
          </div>
        )
        
        showToast.info(toastContent, {
          onClick: () => navigate(`/chat/${message.conversationId}`),
          autoClose: 5000,
        })
      }
    }

    socket.on('new_message', handleNewMessage)

    return () => {
      if (socketRef.current) {
        socketRef.current.off('new_message', handleNewMessage)
      }
    }
  }, [isAuthenticated, user, location.pathname, navigate])

  return (
    <div className="min-h-screen flex flex-col" style={{ 
      backgroundColor: '#0a0f1f',
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.15) 0px, transparent 50%)'
    }}>
      {/* Fixed Header with Rounded Container */}
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 py-3">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="backdrop-blur-xl bg-[rgba(2,4,8,0.7)] border border-white/10 rounded-full shadow-2xl">
            <div className="flex items-center justify-between h-16 md:h-20 px-6">
              {/* Logo */}
              <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-lg shadow-primary/20 ring-1 ring-white/10 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white fill-white">
                    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path>
                  </svg>
                </div>
                <div className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="text-lg sm:text-xl font-bold tracking-tight text-white">OmniMart</span>
                </div>
              </Link>
              
              {/* Navigation Links - Desktop */}
              <div className="hidden lg:flex items-center gap-8">
                <Link to="/" className="text-sm font-medium transition-colors text-white">
                  Home
                </Link>
                <Link to="/feed" className="text-sm font-medium transition-colors text-slate-400 hover:text-white">
                  Feed
                </Link>
                <div 
                  className="relative group" 
                  ref={servicesDropdownRef}
                  onMouseEnter={() => setServicesDropdownOpen(true)}
                  onMouseLeave={() => setServicesDropdownOpen(false)}
                >
                  <button
                    className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    Services
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </button>
                  <div className={`absolute top-full right-0 mt-2 w-48 transition-all duration-200 ${servicesDropdownOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                    <div className="backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                      <Link
                        to="/services"
                        onClick={() => setServicesDropdownOpen(false)}
                        className="block px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        All Services
                      </Link>
                      {isAuthenticated && (
                        <Link
                          to="/my-services"
                          onClick={() => setServicesDropdownOpen(false)}
                          className="block px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          My Services
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side Actions */}
              <div className="flex items-center gap-4">
                {isAuthenticated && user ? (
                  <>
                    {/* Notifications */}
                    <NotificationDropdown userId={user.id} />
                    {/* Balance Dropdown */}
                    <div className="hidden md:block relative" ref={balanceDropdownRef}>
                      <button
                        onClick={() => setBalanceDropdownOpen(!balanceDropdownOpen)}
                        className="flex items-center space-x-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 to-emerald-600/20 border border-primary/30 hover:border-primary/50 transition-all"
                      >
                        <FontAwesomeIcon icon={faWallet} className="text-primary" />
                        <span className="text-sm font-semibold text-white">
                          {balance ? `${Number(balance.amount).toFixed(2)} USDT` : '0.00 USDT'}
                        </span>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className={`text-xs text-slate-400 transition-transform ${balanceDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {balanceDropdownOpen && (
                        <div className="absolute top-full right-0 mt-2 w-48 backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl py-2 z-50">
                          <Link
                            to="/charge"
                            onClick={() => setBalanceDropdownOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            Charge
                          </Link>
                          <Link
                            to="/withdraw"
                            onClick={() => setBalanceDropdownOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            Withdraw
                          </Link>
                          <Link
                            to="/transactions"
                            onClick={() => setBalanceDropdownOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            Transactions
                          </Link>
                        </div>
                      )}
                    </div>
                    {/* User Menu */}
                    <div className="hidden md:block relative" ref={userDropdownRef}>
                      <button
                        onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                        className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {user.firstName?.[0] || user.email[0].toUpperCase()}
                        </div>
                        <div className="hidden sm:block text-left">
                          <p className="text-sm font-medium text-white">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className={`text-xs text-slate-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {userDropdownOpen && (
                        <div className="absolute top-full right-0 mt-2 w-48 backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl py-2 z-50">
                          <Link
                            to="/profile"
                            onClick={() => setUserDropdownOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center space-x-2"
                          >
                            <FontAwesomeIcon icon={faUserCircle} className="text-sm" />
                            <span>Profile</span>
                          </Link>
                          <button
                            onClick={() => {
                              setUserDropdownOpen(false)
                              handleSignOut()
                            }}
                            className="w-full text-left px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center space-x-2"
                          >
                            <FontAwesomeIcon icon={faSignOutAlt} className="text-sm" />
                            <span>Logout</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Link 
                      to="/signin" 
                      className="hidden md:block text-sm font-medium text-white hover:text-primary transition-colors"
                    >
                      Log In
                    </Link>
                    <Link
                      to="/signup"
                      className="hidden md:inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_50px_rgba(16,185,129,0.6)] hover:-translate-y-1 h-9 rounded-full px-4"
                    >
                      Sign Up
                    </Link>
                  </>
                )}
                
                {/* Mobile Menu Button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors"
                  aria-label="Toggle menu"
                >
                  <FontAwesomeIcon icon={faBars} />
                </button>
              </div>
            </div>
          </div>
        </nav>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-2 mx-4 backdrop-blur-xl bg-[rgba(13,17,28,0.9)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden mobile-menu-container">
            <div className="px-4 py-3 space-y-2">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2 text-sm font-medium text-white hover:bg-white/5 transition-colors"
              >
                Home
              </Link>
              <Link
                to="/feed"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Feed
              </Link>
              <Link
                to="/services"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                All Services
              </Link>
              {isAuthenticated && (
                <>
                  <div className="px-4 py-2 border-b border-white/10">
                    <div className="flex items-center space-x-2">
                      <FontAwesomeIcon icon={faWallet} className="text-primary" />
                      <span className="text-sm font-semibold text-white">
                        {balance ? `${Number(balance.amount).toFixed(2)} USDT` : '0.00 USDT'}
                      </span>
                    </div>
                  </div>
                  <Link
                    to="/charge"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Charge
                  </Link>
                  <Link
                    to="/withdraw"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Withdraw
                  </Link>
                  <Link
                    to="/transactions"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Transactions
                  </Link>
                  <Link
                    to="/my-services"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    My Services
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleSignOut()
                    }}
                    className="w-full text-left px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Logout
                  </button>
                </>
              )}
              {!isAuthenticated && (
                <>
                  <Link
                    to="/signin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 text-sm font-medium text-white hover:bg-white/5 transition-colors"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      
      {/* Main Content with padding for fixed header */}
      <main className="flex-1 pt-24 md:pt-28">{children}</main>
      {!location.pathname.startsWith('/chat/') && <Footer />}
    </div>
  )
}

export default Layout
