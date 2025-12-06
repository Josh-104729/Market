import { ReactNode, useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faList, faUser, faSignOutAlt, faUserCircle, faWallet } from '@fortawesome/free-solid-svg-icons'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { logout } from '../store/slices/authSlice'
import { fetchWallet, connectWallet, refreshBalance, setBalance } from '../store/slices/walletSlice'
import { walletApi } from '../services/api'
import { getUSDTBalance } from '../utils/tronWeb'
import { showToast } from '../utils/toast'
import { getSocket } from '../services/socket'
import { Message } from '../services/api'
import { Socket } from 'socket.io-client'
import Footer from './Footer'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const { wallet, balance, isConnecting, isConnected } = useAppSelector((state) => state.wallet)
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false)
  const servicesDropdownRef = useRef<HTMLDivElement>(null)
  const userDropdownRef = useRef<HTMLDivElement>(null)
  const walletDropdownRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)

  const handleSignOut = () => {
    dispatch(logout())
    showToast.info('You have been logged out')
    navigate('/signin')
  }

  const handleConnectWallet = async () => {
    try {
      await dispatch(connectWallet()).unwrap()
    } catch (error) {
      // Error already handled in thunk
    }
  }

  const handleRefreshBalance = async () => {
    if (wallet?.walletAddress) {
      try {
        await dispatch(refreshBalance(wallet.walletAddress)).unwrap()
        showToast.success('Balance refreshed')
      } catch (error) {
        showToast.error('Failed to refresh balance')
      }
    }
  }

  // Fetch wallet on mount if authenticated
  useEffect(() => {
    if (isAuthenticated && !wallet) {
      dispatch(fetchWallet())
    }
  }, [isAuthenticated, dispatch, wallet])

  // Fetch balance if wallet is connected but balance is not loaded
  useEffect(() => {
    if (isConnected && wallet && (balance === null || balance === undefined)) {
      // Try to get balance from backend first
      walletApi.getMyWallet().then((w) => {
        if (w && w.balance !== undefined && w.balance !== null) {
          dispatch(setBalance(w.balance))
        } else if (wallet.walletAddress) {
          // Fallback to TronLink if backend doesn't have balance
          getUSDTBalance(wallet.walletAddress)
            .then((bal) => dispatch(setBalance(bal)))
            .catch((err) => console.error('Failed to fetch balance:', err))
        }
      }).catch((err) => console.error('Failed to fetch wallet:', err))
    }
  }, [isConnected, wallet, balance, dispatch])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (servicesDropdownRef.current && !servicesDropdownRef.current.contains(event.target as Node)) {
        setServicesDropdownOpen(false)
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false)
      }
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target as Node)) {
        setWalletDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

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

    // Listen for new messages globally
    const handleNewMessage = (message: Message) => {
      // Don't show notification if message is from current user
      if (message.senderId === user.id) {
        return
      }

      // Check if user is currently on the chat page for this conversation
      const isOnChatPage = location.pathname.startsWith('/chat/')
      const currentChatId = location.pathname.split('/chat/')[1]
      
      // Only show toast if not on chat page, or if on a different chat page
      if (!isOnChatPage || (isOnChatPage && message.conversationId !== currentChatId)) {
        // Get sender name
        const senderName = message.sender
          ? `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || message.sender.userName || 'Someone'
          : 'Someone'
        
        // Truncate message if too long
        const messagePreview = message.message.length > 50 
          ? message.message.substring(0, 50) + '...'
          : message.message

        // Show toast notification with click handler to navigate to chat
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

    // Set up listener - socket.on can be called even if not connected yet
    socket.on('new_message', handleNewMessage)

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.off('new_message', handleNewMessage)
      }
    }
  }, [isAuthenticated, user, location.pathname, navigate])

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <nav className="bg-gray-800 shadow-md sticky top-0 z-50 border-b border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">M</span>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                MarketPlace
              </span>
            </Link>
            
            <div className="hidden md:flex items-center space-x-8">
              <Link to="/" className="text-gray-300 hover:text-blue-400 font-medium transition-colors">
                Home
              </Link>
              <Link to="/feed" className="text-gray-300 hover:text-blue-400 font-medium transition-colors">
                Feed
              </Link>
              <div className="relative" ref={servicesDropdownRef}>
                <button
                  onClick={() => setServicesDropdownOpen(!servicesDropdownOpen)}
                  className="text-gray-300 hover:text-blue-400 font-medium transition-colors flex items-center space-x-1"
                >
                  <span>Services</span>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`text-xs transition-transform ${servicesDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {servicesDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-2 z-50">
                    <Link
                      to="/services"
                      onClick={() => setServicesDropdownOpen(false)}
                      className="block px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-blue-400 transition-colors flex items-center space-x-2"
                    >
                      <FontAwesomeIcon icon={faList} className="text-sm" />
                      <span>All Services</span>
                    </Link>
                    {isAuthenticated && (
                      <Link
                        to="/my-services"
                        onClick={() => setServicesDropdownOpen(false)}
                        className="block px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-blue-400 transition-colors flex items-center space-x-2"
                      >
                        <FontAwesomeIcon icon={faUser} className="text-sm" />
                        <span>My Services</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {isAuthenticated && user ? (
                <>
                  {/* Wallet Info */}
                  <div className="relative" ref={walletDropdownRef}>
                    {isConnected && wallet ? (
                      <button
                        onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
                        className="flex items-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        <FontAwesomeIcon icon={faWallet} className="text-blue-400" />
                        <div className="text-left hidden sm:block">
                          <div className="text-xs text-gray-400">Wallet</div>
                          <div className="text-sm font-medium text-white">
                            {wallet.walletAddress.slice(0, 6)}...{wallet.walletAddress.slice(-4)}
                          </div>
                          {(balance !== null && balance !== undefined) ? (
                            <div className="text-xs text-green-400">
                              {balance.toFixed(2)} USDT
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              Loading...
                            </div>
                          )}
                        </div>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className={`text-xs text-gray-400 transition-transform ${walletDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    ) : (
                      <button
                        onClick={handleConnectWallet}
                        disabled={isConnecting}
                        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg transition-all shadow-md disabled:opacity-50"
                      >
                        <FontAwesomeIcon icon={faWallet} />
                        <span className="text-sm font-medium text-white">
                          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                        </span>
                      </button>
                    )}
                    {walletDropdownOpen && wallet && (
                      <div className="absolute top-full right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-2 z-50">
                        <div className="px-4 py-2 border-b border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">Wallet Address</div>
                          <div className="text-sm text-white font-mono break-all">
                            {wallet.walletAddress}
                          </div>
                        </div>
                        <div className="px-4 py-2 border-b border-gray-700">
                          <div className="text-xs text-gray-400 mb-1">Balance</div>
                          <div className="text-lg font-semibold text-green-400">
                            {(balance !== null && balance !== undefined) ? `${balance.toFixed(2)} USDT` : 'Loading...'}
                          </div>
                        </div>
                        <button
                          onClick={handleRefreshBalance}
                          className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-blue-400 transition-colors text-sm"
                        >
                          Refresh Balance
                        </button>
                        <Link
                          to="/transactions"
                          onClick={() => setWalletDropdownOpen(false)}
                          className="block px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-blue-400 transition-colors text-sm"
                        >
                          Transaction History
                        </Link>
                        <a
                          href={`https://tronscan.org/#/address/${wallet.walletAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-blue-400 transition-colors text-sm"
                        >
                          View on TronScan
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button className="p-2 text-gray-300 hover:text-blue-400 relative">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">0</span>
                    </button>
                  </div>
                  <div className="relative" ref={userDropdownRef}>
                    <button
                      onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                      className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {user.firstName?.[0] || user.email[0].toUpperCase()}
                      </div>
                      <div className="hidden sm:block text-left">
                        <p className="text-sm font-medium text-gray-300">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className={`text-xs text-gray-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {userDropdownOpen && (
                      <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-2 z-50">
                        <Link
                          to="/profile"
                          onClick={() => setUserDropdownOpen(false)}
                          className="block px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-blue-400 transition-colors flex items-center space-x-2"
                        >
                          <FontAwesomeIcon icon={faUserCircle} className="text-sm" />
                          <span>Profile</span>
                        </Link>
                        <button
                          onClick={() => {
                            setUserDropdownOpen(false)
                            handleSignOut()
                          }}
                          className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-blue-400 transition-colors flex items-center space-x-2"
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
                    className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-blue-400 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

export default Layout

