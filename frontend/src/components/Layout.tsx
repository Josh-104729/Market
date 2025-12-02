import { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const token = localStorage.getItem('accessToken')
  const user = token ? JSON.parse(localStorage.getItem('user') || '{}') : null

  const handleSignOut = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    navigate('/signin')
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xl font-bold text-white">
              Black Market
            </Link>
            <div className="space-x-4">
              <Link to="/" className="text-gray-300 hover:text-white">
                Home
              </Link>
              {user ? (
                <>
                  <span className="text-gray-300">
                    {user.firstName} {user.lastName}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-300 hover:text-white"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/signin" className="text-gray-300 hover:text-white">
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="text-gray-300 hover:text-white"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}

export default Layout

