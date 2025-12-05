import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faPlus, faSpinner, faEdit, faChevronLeft, faChevronRight, faStar } from '@fortawesome/free-solid-svg-icons'
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

function MyServices() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const itemsPerPage = 12

  // Calculate total service count (sum of all category service counts)
  const totalServiceCount = categories.reduce((sum, category) => {
    return sum + (category.serviceCount || 0)
  }, 0)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }
    fetchCategories()
  }, [isAuthenticated, navigate])

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
  }, [statusFilter, selectedCategory])

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when search changes
  }, [searchTerm])

  useEffect(() => {
    if (isAuthenticated) {
      const timeoutId = setTimeout(() => {
        fetchServices()
      }, searchTerm ? 300 : 0)
      return () => clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, selectedCategory, searchTerm, isAuthenticated])

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
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      }
      if (statusFilter) {
        params.status = statusFilter
      }
      if (selectedCategory) {
        params.categoryId = selectedCategory
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim()
      }
      const response = await serviceApi.getMyServices(params)
      setServices(response.data)
      setTotal(response.total)
      setTotalPages(response.totalPages)
    } catch (error) {
      console.error('Failed to fetch services:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      blocked: 'bg-red-100 text-red-800',
    }
    return badges[status as keyof typeof badges] || badges.draft
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col space-y-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              {/* Title */}
              <div className="flex-shrink-0">
                <h1 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">My Services</h1>
                <p className="text-blue-100">Manage your services</p>
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
                  placeholder="Search your services..."
                  className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white focus:bg-white/20 transition-all"
                />
              </div>

              {/* Create Service Button */}
              <div className="flex-shrink-0">
                <Link
                  to="/services/new"
                  className="px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-2 whitespace-nowrap"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Create Service</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Filter Bar */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6 overflow-x-auto">
          <div className="flex items-center space-x-2 min-w-max">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                statusFilter === ''
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Statuses
            </button>
            <button
              onClick={() => setStatusFilter('draft')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                statusFilter === 'draft'
                  ? 'bg-gray-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Draft
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                statusFilter === 'active'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('blocked')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                statusFilter === 'blocked'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Blocked
            </button>
          </div>
        </div>

        {/* Category Filter Bar */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-8 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <div className="flex items-center space-x-2 min-w-max">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all flex items-center space-x-2 ${
                selectedCategory === ''
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>All Categories</span>
              {totalServiceCount > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    selectedCategory === ''
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-100 text-blue-700'
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
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.icon && (
                  <span className={selectedCategory === category.id ? 'text-white' : 'text-blue-600'}>
                    {renderIcon(category.icon, 'text-lg')}
                  </span>
                )}
                <span>{category.title}</span>
                {category.serviceCount !== undefined && category.serviceCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      selectedCategory === category.id
                        ? 'bg-white/20 text-white'
                        : 'bg-blue-100 text-blue-700'
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
          <div className="text-center py-20 bg-white rounded-xl shadow-md">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-600 mb-4" />
            <p className="text-gray-500">Loading services...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-md">
            <p className="text-gray-500 mb-6 text-lg">No services found</p>
            <Link
              to="/services/new"
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
            >
              Create Your First Service
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden border border-gray-200 group"
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
                      <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
                        <div className="text-6xl text-blue-600">📦</div>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 flex-1">
                        {service.title}
                      </h3>
                      <span
                        className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(service.status)}`}
                      >
                        {service.status}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{service.adText}</p>
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
                      <span className="text-2xl font-bold text-blue-600">
                        ${typeof service.balance === 'number'
                          ? (Math.round(service.balance * 100) / 100).toFixed(2)
                          : (Math.round(parseFloat(service.balance as any) * 100) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to={`/services/${service.id}`}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => navigate(`/services/${service.id}/edit`)}
                        className="px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
                        title="Edit"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white rounded-xl shadow-md p-6 mt-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-600">
                    Showing {services.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
                    {Math.min(currentPage * itemsPerPage, total)} of {total} services
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <FontAwesomeIcon icon={faChevronLeft} />
                      <span>Previous</span>
                    </button>

                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <span>Next</span>
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default MyServices

