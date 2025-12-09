import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useAppSelector } from './store/hooks'
import Dashboard from './pages/Dashboard'
import Categories from './pages/Categories'
import CategoryForm from './pages/CategoryForm'
import Services from './pages/Services'
import ServiceDetail from './pages/ServiceDetail'
import Blog from './pages/Blog'
import TempWallets from './pages/TempWallets'
import Withdraws from './pages/Withdraws'
import SignIn from './pages/SignIn'
import Layout from './components/Layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/signin" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated)
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />
}

function App() {
  return (
    <>
      <Router>
        <Routes>
        <Route path="/signin" element={
          <PublicRoute>
            <SignIn />
          </PublicRoute>
        } />
        <Route path="/" element={
          <PrivateRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/categories" element={
          <PrivateRoute>
            <Layout>
              <Categories />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/categories/new" element={
          <PrivateRoute>
            <Layout>
              <CategoryForm />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/categories/:id/edit" element={
          <PrivateRoute>
            <Layout>
              <CategoryForm />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/services" element={
          <PrivateRoute>
            <Layout>
              <Services />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/services/:id" element={
          <PrivateRoute>
            <Layout>
              <ServiceDetail />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/blog" element={
          <PrivateRoute>
            <Layout>
              <Blog />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/temp-wallets" element={
          <PrivateRoute>
            <Layout>
              <TempWallets />
            </Layout>
          </PrivateRoute>
        } />
        <Route path="/withdraws" element={
          <PrivateRoute>
            <Layout>
              <Withdraws />
            </Layout>
          </PrivateRoute>
        } />
        </Routes>
      </Router>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </>
  )
}

export default App

