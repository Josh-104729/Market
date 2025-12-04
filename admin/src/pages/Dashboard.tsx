import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolder, faUsers, faBox, faShoppingCart } from '@fortawesome/free-solid-svg-icons'

function Dashboard() {
  const menuItems = [
    {
      title: 'Categories',
      description: 'Manage service categories',
      icon: faFolder,
      link: '/categories',
      gradient: 'from-blue-500 to-blue-600',
      available: true,
    },
    {
      title: 'Users',
      description: 'Manage user accounts',
      icon: faUsers,
      link: '#',
      gradient: 'from-purple-500 to-purple-600',
      available: false,
    },
    {
      title: 'Products',
      description: 'Manage products',
      icon: faBox,
      link: '#',
      gradient: 'from-pink-500 to-pink-600',
      available: false,
    },
    {
      title: 'Orders',
      description: 'Manage orders',
      icon: faShoppingCart,
      link: '#',
      gradient: 'from-green-500 to-green-600',
      available: false,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg">
              Admin Dashboard
            </h1>
            <p className="text-xl text-blue-100">
              Welcome to the Black Market Admin Panel
            </p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {menuItems.map((item) => {
            const content = (
              <div
                className={`bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-blue-500 ${
                  item.available
                    ? 'cursor-pointer transform hover:-translate-y-1'
                    : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                  <FontAwesomeIcon icon={item.icon} className="text-3xl text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
                {!item.available && (
                  <span className="inline-block mt-3 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                    Coming Soon
                  </span>
                )}
              </div>
            )

            return item.available ? (
              <Link key={item.title} to={item.link}>
                {content}
              </Link>
            ) : (
              <div key={item.title}>{content}</div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Dashboard

