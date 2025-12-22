import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from "@/components/ui/toaster"
import { useAppSelector } from "./store/hooks"
import Home from './pages/Home'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import VerifyEmail from './pages/VerifyEmail'
import Services from './pages/Services'
import MyServices from './pages/MyServices'
import CreateService from './pages/CreateService'
import ServiceDetail from './pages/ServiceDetail'
import ChatList from './pages/ChatList'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
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

function App() {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated)

  return (
    <Router>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={isAuthenticated ? <Dashboard /> : <Home />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/services" element={<Services />} />
                <Route path="/my-services" element={<MyServices />} />
                <Route path="/services/new" element={<CreateService />} />
                <Route path="/services/:id" element={<ServiceDetail />} />
                <Route path="/chat" element={<ChatList />} />
                <Route path="/chat/:id" element={<ChatList />} />
                <Route path="/profile" element={<Profile />} />
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
    </Router>
  )
}

export default App

