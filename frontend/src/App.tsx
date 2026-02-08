import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import { Toaster } from "@/components/ui/toaster"
import { useAppSelector, useAppDispatch } from "./store/hooks"
import { logout, setUser } from "./store/slices/authSlice"
import { disconnectSocket } from "./services/socket"
import { showToast } from "./utils/toast"
import { authApi } from "./services/api"
import { TermsModal } from "./components/TermsModal"
import Home from './pages/Home'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Services from './pages/Services'
import MyServices from './pages/MyServices'
import CreateService from './pages/CreateService'
import ServiceDetail from './pages/ServiceDetail'
import ChatList from './pages/ChatList'
import Feed from './pages/Feed'
import FeedDetail from './pages/FeedDetail'
import Profile from './pages/Profile'
import UserProfile from './pages/UserProfile'
import Charge from './pages/Charge'
import ChargeDetail from './pages/ChargeDetail'
import Withdraw from './pages/Withdraw'
import WithdrawDetail from './pages/WithdrawDetail'
import Transactions from './pages/Transactions'
import Notifications from './pages/Notifications'
import SecuritySettings from './pages/SecuritySettings'
import Referral from './pages/Referral'
import Layout from './components/Layout'
import Dashboard from "./pages/Dashboard"
import PrivacyPolicy from "./pages/PrivacyPolicy"
import TermsOfService from "./pages/TermsOfService"
import CookiePolicy from "./pages/CookiePolicy"
import Support from "./pages/Support"

function AppContent() {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated)
  const user = useAppSelector((state) => state.auth.user)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [isInitializing, setIsInitializing] = useState(true)
  const [showTermsModal, setShowTermsModal] = useState(false)

  // Initialize auth: fetch user from server if token exists
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('accessToken')
      
      if (!token) {
        setIsInitializing(false)
        return
      }

      try {
        // Fetch user profile from server
        const user = await authApi.getProfile()
        
        // Check if user is blocked
        if (user.status !== 'active') {
          // User is blocked, log them out
          dispatch(logout())
          disconnectSocket()
          showToast.error('Your account is blocked')
          navigate('/signin', { replace: true })
          setIsInitializing(false)
          return
        }

        // User is active, set user data
        dispatch(setUser(user))
      } catch (error: any) {
        // Token is invalid or expired
        console.error('Failed to fetch user profile:', error)
        dispatch(logout())
        disconnectSocket()
        // Don't show toast here - let the auth flow handle it
      } finally {
        setIsInitializing(false)
      }
    }

    initializeAuth()
  }, [dispatch, navigate])

  // Show terms modal when user logs in and hasn't accepted terms
  // Modal stays open until terms are accepted
  useEffect(() => {
    if (isAuthenticated && user && !user.termsAcceptedAt) {
      setShowTermsModal(true)
    } else if (user?.termsAcceptedAt) {
      // Close modal only when terms are accepted
      setShowTermsModal(false)
    }
  }, [isAuthenticated, user])

  // Global handler for session expiration - works everywhere, including auth pages
  useEffect(() => {
    const handleAuthExpired = (event: CustomEvent) => {
      const reason = event.detail?.reason || 'session_expired'
      console.log('Session expired:', reason)
      
      // Disconnect socket
      disconnectSocket()
      
      // Preserve current path as redirect parameter before logout
      const currentPath = window.location.pathname + window.location.search
      
      // Clear auth state
      dispatch(logout())
      
      // Show notification
      showToast.info('Your session has expired. Please sign in again.')
      
      // Navigate to sign in page with redirect parameter
      // Only add redirect if not already on an auth page
      if (!currentPath.startsWith('/signin') && !currentPath.startsWith('/signup') && 
          !currentPath.startsWith('/verify-email') && !currentPath.startsWith('/forgot-password') && 
          !currentPath.startsWith('/reset-password')) {
        navigate(`/signin?redirect=${encodeURIComponent(currentPath)}`, { replace: true })
      } else {
        navigate('/signin', { replace: true })
      }
    }

    window.addEventListener('auth-expired', handleAuthExpired as EventListener)
    
    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired as EventListener)
    }
  }, [dispatch, navigate])

  // Show loading state while initializing auth
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={isAuthenticated ? <Dashboard /> : <Home />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/feed/:id" element={<FeedDetail />} />
                <Route path="/services" element={<Services />} />
                <Route path="/my-services" element={<MyServices />} />
                <Route path="/services/new" element={<CreateService />} />
                <Route path="/services/:id" element={<ServiceDetail />} />
                <Route path="/chat" element={<ChatList />} />
                <Route path="/chat/:id" element={<ChatList />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:userId" element={<UserProfile />} />
                <Route path="/settings/security" element={<SecuritySettings />} />
                <Route path="/charge" element={<Charge />} />
                <Route path="/charge/:walletAddress" element={<ChargeDetail />} />
                <Route path="/withdraw" element={<Withdraw />} />
                <Route path="/withdraw/:transactionId" element={<WithdrawDetail />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/referral" element={<Referral />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/cookies" element={<CookiePolicy />} />
                <Route path="/support" element={<Support />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
      <Toaster />
      {isAuthenticated && (
        <TermsModal
          open={showTermsModal}
          onOpenChange={setShowTermsModal}
        />
      )}
    </>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App

