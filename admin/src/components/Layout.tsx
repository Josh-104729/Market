import { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen">
      <nav className="bg-blue-600 border-b border-blue-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Black Market Admin</h2>
            <div className="space-x-4">
              <a href="/" className="text-blue-100 hover:text-white">Dashboard</a>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}

export default Layout

