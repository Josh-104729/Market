import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGlobe, faPalette, faChartLine, faPen, faVideo, faMobileAlt, faStar, faSearch } from '@fortawesome/free-solid-svg-icons'
import { useAppSelector } from '../store/hooks'
import { categoryApi, Category } from '../services/api'
import { renderIcon } from '../utils/iconHelper'

function Home() {
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await categoryApi.getAll()
        setCategories(data)
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()
  }, [])

  const featuredServices = [
    { id: 1, title: 'Professional Website Design', price: '$299', rating: 4.9, reviews: 127, icon: faGlobe },
    { id: 2, title: 'Logo Design Package', price: '$99', rating: 4.8, reviews: 89, icon: faPalette },
    { id: 3, title: 'SEO Optimization', price: '$199', rating: 4.7, reviews: 156, icon: faChartLine },
    { id: 4, title: 'Content Writing', price: '$49', rating: 4.9, reviews: 203, icon: faPen },
    { id: 5, title: 'Video Editing', price: '$149', rating: 4.6, reviews: 67, icon: faVideo },
    { id: 6, title: 'Social Media Management', price: '$179', rating: 4.8, reviews: 134, icon: faMobileAlt },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              {isAuthenticated ? `Welcome back, ${user?.firstName || 'User'}!` : 'Find the Perfect Service for Your Business'}
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              Connect with talented professionals and get your projects done
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <input
                type="text"
                placeholder="Search for services..."
                className="px-6 py-4 rounded-lg text-gray-900 w-full sm:w-96 focus:outline-none focus:ring-2 focus:ring-white"
              />
              <button className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center space-x-2">
                <FontAwesomeIcon icon={faSearch} />
                <span>Search</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Browse by Category</h2>
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No categories available</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-6">
            {categories.map((category) => (
              <div
                key={category.id}
                className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-blue-500"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {category.icon && (
                      <div className="text-4xl mb-2 text-blue-600">
                        {renderIcon(category.icon)}
                      </div>
                    )}
                    <h3 className="font-semibold text-gray-900">
                      {category.title}
                    </h3>
                  </div>
                  {category.serviceCount !== undefined && (
                    <div className="text-right ml-4">
                      <div className="text-3xl font-bold text-blue-600">
                        {category.serviceCount}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {category.serviceCount === 1 ? 'service' : 'services'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Featured Services */}
      <div className="bg-white py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Featured Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredServices.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden border border-gray-200"
              >
                <div className="h-48 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <FontAwesomeIcon icon={service.icon} className="text-6xl text-blue-600" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{service.title}</h3>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-1">
                      <FontAwesomeIcon icon={faStar} className="text-yellow-400" />
                      <span className="font-semibold text-gray-900">{service.rating}</span>
                      <span className="text-gray-500 text-sm">({service.reviews})</span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">{service.price}</span>
                  </div>
                  <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">10K+</div>
              <div className="text-blue-100">Active Services</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">5K+</div>
              <div className="text-blue-100">Happy Clients</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">2K+</div>
              <div className="text-blue-100">Expert Sellers</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">98%</div>
              <div className="text-blue-100">Satisfaction Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home

