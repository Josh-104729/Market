import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { logout } from '../store/slices/authSlice'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.auth.user)

  const handleLogout = () => {
    dispatch(logout())
    navigate('/signin')
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-blue-600 border-b border-blue-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Black Market Admin</h2>
            <div className="flex items-center space-x-4">
              <span className="text-blue-100">
                {user?.email || 'Admin'}
              </span>
              <button
                onClick={handleLogout}
                className="text-blue-100 hover:text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}

export default Layout

