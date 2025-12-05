import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faPlus, faStar, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { faStar as faStarRegular, faStarHalfStroke } from '@fortawesome/free-regular-svg-icons'
import { useAppSelector } from '../store/hooks'
import { categoryApi, serviceApi, Service, Category } from '../services/api'
import { renderIcon } from '../utils/iconHelper'

const StarRating = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

  return (
    <div className="flex items-center space-x-1">
      {[...Array(fullStars)].map((_, i) => (
        <FontAwesomeIcon key={`full-${i}`} icon={faStar} className="text-yellow-400" />
      ))}
      {hasHalfStar && <FontAwesomeIcon icon={faStarHalfStroke} className="text-yellow-400" />}
      {[...Array(emptyStars)].map((_, i) => (
        <FontAwesomeIcon key={`empty-${i}`} icon={faStarRegular} className="text-gray-300" />
      ))}
    </div>
  )
}

function Services() {
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  // Calculate total service count (sum of all category service counts)
  const totalServiceCount = categories.reduce((sum, category) => {
    return sum + (category.serviceCount || 0)
  }, 0)

  useEffect(() => {
    fetchCategories()
    fetchServices()
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchServices()
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTerm, selectedCategory])

  const fetchCategories = async () => {
    try {
      const data = await categoryApi.getAll()
      setCategories(data)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const fetchServices = async () => {
    try {
      setLoading(true)
      const params: any = { status: 'active' }
      if (selectedCategory) {
        params.categoryId = selectedCategory
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim()
      }
      const data = await serviceApi.getAll(params)
      setServices(data)
    } catch (error) {
      console.error('Failed to fetch services:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              {/* Title */}
              <div className="flex-shrink-0">
                <h1 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">Services</h1>
                <p className="text-blue-100">Browse and discover amazing services</p>
              </div>

              {/* Search Input - Centered */}
              <div className="relative flex-1 max-w-2xl w-full lg:mx-8">
                <FontAwesomeIcon
                  icon={faSearch}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-200"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search services by title, description, or tags..."
                  className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white focus:bg-white/20 transition-all"
                />
              </div>

              {/* Create Service Button */}
              {isAuthenticated && (
                <div className="flex-shrink-0">
                  <Link
                    to="/services/new"
                    className="px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-2 whitespace-nowrap"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    <span>Create Service</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Filter Bar */}
        <div className="bg-gray-800 rounded-xl shadow-md p-4 mb-8 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700">
          <div className="flex items-center space-x-2 min-w-max">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all flex items-center space-x-2 ${
                selectedCategory === ''
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span>All Categories</span>
              {totalServiceCount > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    selectedCategory === ''
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-600 text-blue-200'
                  }`}
                >
                  {totalServiceCount}
                </span>
              )}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all flex items-center space-x-2 ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {category.icon && (
                  <span className={selectedCategory === category.id ? 'text-white' : 'text-blue-400'}>
                    {renderIcon(category.icon, 'text-lg')}
                  </span>
                )}
                <span>{category.title}</span>
                {category.serviceCount !== undefined && category.serviceCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      selectedCategory === category.id
                        ? 'bg-white/20 text-white'
                        : 'bg-blue-600 text-blue-200'
                    }`}
                  >
                    {category.serviceCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Services Grid */}
        {loading ? (
          <div className="text-center py-20 bg-gray-800 rounded-xl shadow-md">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-400 mb-4" />
            <p className="text-gray-400">Loading services...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-20 bg-gray-800 rounded-xl shadow-md">
            <p className="text-gray-400 mb-6 text-lg">No services found</p>
            {isAuthenticated && (
              <Link
                to="/services/new"
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
              >
                Create First Service
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Link
                key={service.id}
                to={`/services/${service.id}`}
                className="bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden border border-gray-700 group"
              >
                <div className="h-48 relative overflow-hidden">
                  {service.adImage ? (
                    <>
                      {/* Blurred background */}
                      <div
                        className="absolute inset-0 bg-cover bg-center filter blur-md scale-110"
                        style={{
                          backgroundImage: `url(http://localhost:3000${service.adImage})`,
                        }}
                      />
                      {/* Actual image on top */}
                      <div className="relative h-full flex items-center justify-center">
                        <img
                          src={`http://localhost:3000${service.adImage}`}
                          alt={service.title}
                          className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
                      <div className="text-6xl text-blue-400">📦</div>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-semibold text-gray-100 group-hover:text-blue-400 transition-colors line-clamp-2">
                      {service.title}
                    </h3>
                  </div>
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">{service.adText}</p>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <StarRating
                        rating={
                          service.rating
                            ? typeof service.rating === 'number'
                              ? service.rating
                              : parseFloat(service.rating as any)
                            : 0
                        }
                      />
                    </div>
                    <span className="text-2xl font-bold text-blue-400">
                      ${typeof service.balance === 'number' 
                        ? (Math.round(service.balance * 100) / 100).toFixed(2)
                        : (Math.round(parseFloat(service.balance as any) * 100) / 100).toFixed(2)}
                    </span>
                  </div>
                  {service.category && (
                    <div className="text-xs text-gray-400 mb-2">Category: {service.category.title}</div>
                  )}
                  {service.tags && service.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {service.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full"
                        >
                          {tag.title}
                        </span>
                      ))}
                      {service.tags.length > 3 && (
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full">
                          +{service.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Services

