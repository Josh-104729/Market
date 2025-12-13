import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faPlus, faStar, faSpinner, faTh, faTable, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { faStar as faStarRegular, faStarHalfStroke } from '@fortawesome/free-regular-svg-icons'
import { useAppSelector } from '../store/hooks'
import { categoryApi, serviceApi, Service, Category } from '../services/api'
import { renderIcon } from '../utils/iconHelper'

type ViewMode = 'card' | 'table'

const STORAGE_KEY = 'services_view_mode'

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
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(12)

  // Load view mode from localStorage, default to 'card'
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return (saved === 'card' || saved === 'table') ? saved : 'card'
  })

  // Calculate total service count (sum of all category service counts)
  const totalServiceCount = categories.reduce((sum, category) => {
    return sum + (category.serviceCount || 0)
  }, 0)

  useEffect(() => {
    fetchCategories()
  }, [])

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode)
  }, [viewMode])

  // Reset to page 1 when filters or page size change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedCategory, itemsPerPage])

  // Debounced search effect - only triggers fetch after user stops typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchServices()
    }, searchTerm ? 500 : 0) // 500ms debounce for search, immediate for other filters
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm, selectedCategory, itemsPerPage])

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
        status: 'active',
        page: currentPage,
        limit: itemsPerPage,
      }
      if (selectedCategory) {
        params.categoryId = selectedCategory
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim()
      }
      const response = await serviceApi.getAllPaginated(params)
      setServices(response.data)
      setTotal(response.total)
      setTotalPages(response.totalPages)
    } catch (error) {
      console.error('Failed to fetch services:', error)
    } finally {
      setLoading(false)
    }
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
                  className={`w-full px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-between ${selectedCategory === ''
                      ? 'bg-primary text-primary-foreground shadow-glow-primary'
                      : 'glass-card text-slate-300 hover:bg-white/15'
                    }`}
                >
                  <span>All Categories</span>
                  {totalServiceCount > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${selectedCategory === ''
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
                    className={`w-full px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-between ${selectedCategory === category.id
                        ? 'bg-primary text-primary-foreground shadow-glow-primary'
                        : 'glass-card text-slate-300 hover:bg-white/15'
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
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${selectedCategory === category.id
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

          {/* Right Content - Search, Create Button, and Services */}
          <div className="flex-1 min-w-0">
            {/* Search Input, View Mode Switch, and Create Button */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              <div className="relative flex-1">
                <FontAwesomeIcon
                  icon={faSearch}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search services by title, description, or tags..."
                  className="w-full pl-12 pr-4 py-3 glass-card rounded-full text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>

              {/* View Mode Switch */}
              <div className="flex items-center gap-2 glass-card rounded-full p-1">
                <button
                  onClick={() => setViewMode('card')}
                  className={`p-2 rounded-full transition-all ${viewMode === 'card'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-slate-400 hover:text-white'
                    }`}
                  title="Card View"
                >
                  <FontAwesomeIcon icon={faTh} />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-full transition-all ${viewMode === 'table'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-slate-400 hover:text-white'
                    }`}
                  title="Table View"
                >
                  <FontAwesomeIcon icon={faTable} />
                </button>
              </div>

              {isAuthenticated && (
                <Link
                  to="/services/new"
                  className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 shadow-glow-primary hover:shadow-glow-primary-lg hover:-translate-y-1 transition-all whitespace-nowrap"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Create Service</span>
                </Link>
              )}
            </div>

            {/* Services Display */}
            {loading ? (
              <div className="text-center py-20 glass-card rounded-2xl">
                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-primary mb-4" />
                <p className="text-slate-400">Loading services...</p>
              </div>
            ) : services.length === 0 ? (
              <div className="text-center py-20 glass-card rounded-2xl">
                <p className="text-slate-400 mb-6 text-lg">No services found</p>
                {isAuthenticated && (
                  <Link
                    to="/services/new"
                    className="px-8 py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 shadow-glow-primary hover:shadow-glow-primary-lg hover:-translate-y-1 transition-all"
                  >
                    Create First Service
                  </Link>
                )}
              </div>
            ) : viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((service) => (
                  <Link
                    key={service.id}
                    to={`/services/${service.id}`}
                    className="glass-card rounded-2xl overflow-hidden hover:border-primary/20 transition-all hover:scale-[1.02] group"
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
                        <h3 className="text-xl font-semibold text-white group-hover:text-primary transition-colors line-clamp-2">
                          {service.title}
                        </h3>
                      </div>
                      <p className="text-slate-400 text-sm mb-4 line-clamp-2">{service.adText}</p>
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
                      {service.category && (
                        <div className="text-xs text-slate-400 mb-2">Category: {service.category.title}</div>
                      )}
                      {service.tags && service.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {service.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag.id}
                              className="px-2 py-1 glass-card text-slate-300 text-xs rounded-full"
                            >
                              {tag.title}
                            </span>
                          ))}
                          {service.tags.length > 3 && (
                            <span className="px-2 py-1 glass-card text-slate-300 text-xs rounded-full">
                              +{service.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10">
                    <thead className="glass-card">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Image
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Title
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Rating
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Tags
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {services.map((service) => (
                        <tr key={service.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link to={`/services/${service.id}`}>
                              <div className="w-16 h-16 rounded-lg overflow-hidden relative">
                                {service.adImage ? (
                                  <>
                                    {/* Blurred background */}
                                    <div
                                      className="absolute inset-0 bg-cover bg-center filter blur-sm scale-110"
                                      style={{
                                        backgroundImage: `url(http://localhost:3000${service.adImage})`,
                                      }}
                                    />
                                    {/* Actual image on top */}
                                    <div className="relative h-full flex items-center justify-center">
                                      <img
                                        src={`http://localhost:3000${service.adImage}`}
                                        alt={service.title}
                                        className="max-w-full max-h-full object-contain"
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-700 text-2xl">📦</div>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <Link to={`/services/${service.id}`} className="block">
                              <div className="text-sm font-semibold text-white max-w-xs truncate hover:text-primary transition-colors">
                                {service.title}
                              </div>
                              <div className="text-xs text-slate-400 mt-1 line-clamp-2 max-w-xs">{service.adText}</div>
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white">{service.category?.title || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
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
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-primary">
                              ${typeof service.balance === 'number'
                                ? (Math.round(service.balance * 100) / 100).toFixed(2)
                                : (Math.round(parseFloat(service.balance as any) * 100) / 100).toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {service.tags && service.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {service.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="px-2 py-1 glass-card text-slate-300 text-xs rounded-full"
                                  >
                                    {tag.title}
                                  </span>
                                ))}
                                {service.tags.length > 3 && (
                                  <span className="px-2 py-1 glass-card text-slate-300 text-xs rounded-full">
                                    +{service.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">No tags</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {!loading && (
              <div className="glass-card rounded-2xl p-6 mt-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="text-sm text-slate-400">
                      Showing {services.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
                      {Math.min(currentPage * itemsPerPage, total)} of {total} services
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-400">Items per page:</label>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        className="px-3 py-1 glass-card rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50"
                      >
                        <option value={6}>6</option>
                        <option value={12}>12</option>
                        <option value={24}>24</option>
                        <option value={48}>48</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 glass-card rounded-full font-medium text-slate-300 hover:bg-white/15 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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
                            className={`px-4 py-2 rounded-full font-medium transition-all ${currentPage === pageNum
                                ? 'bg-primary text-primary-foreground shadow-glow-primary'
                                : 'glass-card text-slate-300 hover:bg-white/15'
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
                      className="px-4 py-2 glass-card rounded-full font-medium text-slate-300 hover:bg-white/15 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <span>Next</span>
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Services

