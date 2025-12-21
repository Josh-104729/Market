import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faSpinner, faEdit, faChevronLeft, faChevronRight, faStar } from '@fortawesome/free-solid-svg-icons'
import { faStar as faStarRegular, faStarHalfStroke } from '@fortawesome/free-regular-svg-icons'
import { useAppSelector } from '../store/hooks'
import { categoryApi, serviceApi, Service, Category } from '../services/api'
import { renderIcon } from '../utils/iconHelper'
import ImageWithLoader from '../components/ImageWithLoader'

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
        <FontAwesomeIcon key={`empty-${i}`} icon={faStarRegular} className="text-neutral-300" />
      ))}
    </div>
  )
}

function MyServices() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
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
    if (isAuthenticated) {
      fetchServices()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, selectedCategory, isAuthenticated])

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
      draft: 'bg-neutral-700 text-neutral-200',
      active: 'bg-green-900 text-green-200',
      blocked: 'bg-red-900 text-red-200',
    }
    return badges[status as keyof typeof badges] || badges.draft
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar - Categories */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <div className="glass-card rounded-2xl p-4 sticky top-20">
              <h2 className="text-lg font-semibold text-white mb-4">Categories</h2>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`w-full px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-between ${
                    selectedCategory === ''
                      ? 'bg-primary text-primary-foreground shadow-glow-primary'
                      : 'glass-card text-neutral-300 hover:bg-white/15'
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
                    className={`w-full px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-between ${
                      selectedCategory === category.id
                        ? 'bg-primary text-primary-foreground shadow-glow-primary'
                        : 'glass-card text-neutral-300 hover:bg-white/15'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      {category.icon && (
                        <span className={selectedCategory === category.id ? 'text-white' : 'text-blue-400'}>
                          {renderIcon(category.icon, 'text-lg')}
                        </span>
                      )}
                      <span>{category.title}</span>
                    </div>
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
          </div>

          {/* Right Content - Status Filter, Create Button, and Services */}
          <div className="flex-1 min-w-0">
            {/* Status Filter and Create Button */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
              {/* Status Filter Bar */}
              <div className="glass-card rounded-xl p-4 overflow-x-auto flex-1">
                <div className="flex items-center space-x-2 min-w-max">
                  <button
                    onClick={() => setStatusFilter('')}
                    className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
                      statusFilter === ''
                        ? 'bg-primary text-primary-foreground shadow-glow-primary'
                        : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    All Statuses
                  </button>
                  <button
                    onClick={() => setStatusFilter('draft')}
                    className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
                      statusFilter === 'draft'
                        ? 'bg-neutral-600 text-white shadow-md'
                        : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    Draft
                  </button>
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
                      statusFilter === 'active'
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setStatusFilter('blocked')}
                    className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
                      statusFilter === 'blocked'
                        ? 'bg-red-600 text-white shadow-md'
                        : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    Blocked
                  </button>
                </div>
              </div>

              {/* Create Service Button */}
              <Link
                to="/services/new"
                className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 shadow-glow-primary hover:shadow-glow-primary-lg hover:-tranneutral-y-1 transition-all whitespace-nowrap"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Create Service</span>
              </Link>
            </div>

            {/* Services Grid */}
            {loading ? (
              <div className="text-center py-20 glass-card rounded-2xl">
                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-primary mb-4" />
                <p className="text-neutral-400">Loading services...</p>
              </div>
            ) : services.length === 0 ? (
              <div className="text-center py-20 glass-card rounded-2xl">
                <p className="text-neutral-400 mb-6 text-lg">No services found</p>
                <Link
                  to="/services/new"
                  className="px-8 py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 shadow-glow-primary hover:shadow-glow-primary-lg hover:-tranneutral-y-1 transition-all"
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
                  className="glass-card rounded-2xl overflow-hidden hover:border-primary/20 transition-all hover:scale-[1.02] group"
                >
                  <div className="h-48 relative overflow-hidden">
                    {service.adImage ? (
                      <ImageWithLoader
                        src={service.adImage}
                        alt={service.title}
                        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        containerClassName="w-full h-full"
                        showBlurBackground={true}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
                        <div className="text-6xl text-blue-400">📦</div>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-semibold text-white group-hover:text-primary transition-colors line-clamp-2 flex-1">
                        {service.title}
                      </h3>
                      <span
                        className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(service.status)}`}
                      >
                        {service.status}
                      </span>
                    </div>
                    <p className="text-neutral-400 text-sm mb-4 line-clamp-2">{service.adText}</p>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <StarRating
                          rating={
                            service.averageRating !== undefined && service.averageRating > 0
                              ? service.averageRating
                              : service.rating
                                ? typeof service.rating === 'number'
                                  ? service.rating
                                  : parseFloat(service.rating as any)
                                : 0
                          }
                        />
                      </div>
                      <span className="text-2xl font-bold text-primary">
                        ${typeof service.balance === 'number'
                          ? (Math.round(service.balance * 100) / 100).toFixed(2)
                          : (Math.round(parseFloat(service.balance as any) * 100) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to={`/services/${service.id}`}
                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-colors text-center shadow-glow-primary hover:shadow-glow-primary-lg"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => navigate(`/services/${service.id}/edit`)}
                        className="px-4 py-2 glass-card border-2 border-primary/50 text-primary rounded-full font-semibold hover:bg-primary/10 transition-colors"
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
                  <div className="glass-card rounded-2xl p-6 mt-8">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-sm text-neutral-400">
                        Showing {services.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
                        {Math.min(currentPage * itemsPerPage, total)} of {total} services
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="px-4 py-2 glass-card rounded-full font-medium text-neutral-300 hover:bg-white/15 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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
                                className={`px-4 py-2 rounded-full font-medium transition-all ${
                                  currentPage === pageNum
                                    ? 'bg-primary text-primary-foreground shadow-glow-primary'
                                    : 'glass-card text-neutral-300 hover:bg-white/15'
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
                          className="px-4 py-2 glass-card rounded-full font-medium text-neutral-300 hover:bg-white/15 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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
      </div>
    </div>
  )
}

export default MyServices

