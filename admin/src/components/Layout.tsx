import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons'
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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold text-white drop-shadow-lg">Black Market Admin</h2>
            <div className="flex items-center space-x-4">
              <span className="text-blue-100 text-sm md:text-base">
                {user?.email || 'Admin'}
              </span>
              <button
                onClick={handleLogout}
                className="text-white bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg flex items-center space-x-2"
              >
                <FontAwesomeIcon icon={faSignOutAlt} />
                <span>Logout</span>
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

