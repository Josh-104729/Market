import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAppSelector } from './store/hooks'
import Dashboard from './pages/Dashboard'
import Categories from './pages/Categories'
import CategoryForm from './pages/CategoryForm'
import Services from './pages/Services'
import ServiceDetail from './pages/ServiceDetail'
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
      </Routes>
    </Router>
  )
}

export default App

