import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import { Toaster } from "@/components/ui/toaster"
import { useAppSelector, useAppDispatch } from "./store/hooks"
import { logout } from "./store/slices/authSlice"
import { disconnectSocket } from "./services/socket"
import { showToast } from "./utils/toast"
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
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  // Global handler for session expiration - works everywhere, including auth pages
  useEffect(() => {
    const handleAuthExpired = (event: CustomEvent) => {
      const reason = event.detail?.reason || 'session_expired'
      console.log('Session expired:', reason)
      
      // Disconnect socket
      disconnectSocket()
      
      // Clear auth state
      dispatch(logout())
      
      // Show notification
      showToast.info('Your session has expired. Please sign in again.')
      
      // Navigate to sign in page
      navigate('/signin', { replace: true })
    }

    window.addEventListener('auth-expired', handleAuthExpired as EventListener)
    
    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired as EventListener)
    }
  }, [dispatch, navigate])

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

