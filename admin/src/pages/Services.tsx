import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faSearch,
  faSpinner,
  faCheck,
  faBan,
  faExclamationTriangle,
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { serviceApi, categoryApi, Service, Category } from '../services/api'
import { renderIcon } from '../utils/iconHelper'

interface ConfirmDialog {
  serviceId: string
  serviceTitle: string
  action: 'approve' | 'block' | 'unblock'
  newStatus: 'draft' | 'active' | 'blocked'
}

function Services() {
  const navigate = useNavigate()
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const itemsPerPage = 10

  // Calculate total service count (sum of all category service counts)
  const totalServiceCount = categories.reduce((sum, category) => {
    return sum + (category.serviceCount || 0)
  }, 0)

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
  }, [statusFilter, selectedCategory])

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when search changes
  }, [searchTerm])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchServices()
    }, searchTerm ? 300 : 0) // Only delay if there's a search term
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, selectedCategory, searchTerm])

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
      const response = await serviceApi.getAll(params)
      setServices(response.data)
      setTotal(response.total)
      setTotalPages(response.totalPages)
    } catch (error) {
      console.error('Failed to fetch services:', error)
      alert('Failed to load services')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChangeClick = (
    id: string,
    title: string,
    action: 'approve' | 'block' | 'unblock',
    newStatus: 'draft' | 'active' | 'blocked',
  ) => {
    setConfirmDialog({
      serviceId: id,
      serviceTitle: title,
      action,
      newStatus,
    })
  }

  const handleStatusChange = async () => {
    if (!confirmDialog) return

    try {
      await serviceApi.updateStatus(confirmDialog.serviceId, confirmDialog.newStatus)
      setConfirmDialog(null)
      fetchServices()
    } catch (error) {
      console.error('Failed to update service status:', error)
      alert('Failed to update service status')
      setConfirmDialog(null)
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">Services Management</h1>
          <p className="text-blue-100">Review and manage all services</p>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="relative">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search services..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

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

        {/* Services Table */}
        {loading ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-md">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-600 mb-4" />
            <p className="text-gray-500">Loading services...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-md">
            <p className="text-gray-500 mb-6 text-lg">No services found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Image
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Seller
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {services.map((service) => (
                    <tr key={service.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
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
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-2xl">📦</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className="text-sm font-semibold text-gray-900 max-w-xs truncate cursor-pointer hover:text-blue-600 transition-colors"
                          onClick={() => navigate(`/services/${service.id}`)}
                        >
                          {service.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2 max-w-xs">{service.adText}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{service.category?.title || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {service.user?.firstName && service.user?.lastName
                            ? `${service.user.firstName} ${service.user.lastName}`
                            : service.user?.userName || service.user?.email || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          ${typeof service.balance === 'number' 
                            ? (Math.round(service.balance * 100) / 100).toFixed(2)
                            : (Math.round(parseFloat(service.balance as any) * 100) / 100).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
                            service.status,
                          )}`}
                        >
                          {service.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(service.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {service.status === 'draft' && (
                            <button
                              onClick={() => handleStatusChangeClick(service.id, service.title, 'approve', 'active')}
                              className="text-green-600 hover:text-green-800 font-medium px-3 py-1 rounded hover:bg-green-50 transition-all flex items-center space-x-1"
                              title="Approve"
                            >
                              <FontAwesomeIcon icon={faCheck} />
                              <span>Approve</span>
                            </button>
                          )}
                          {service.status === 'active' && (
                            <button
                              onClick={() => handleStatusChangeClick(service.id, service.title, 'block', 'blocked')}
                              className="text-red-600 hover:text-red-800 font-medium px-3 py-1 rounded hover:bg-red-50 transition-all flex items-center space-x-1"
                              title="Block"
                            >
                              <FontAwesomeIcon icon={faBan} />
                              <span>Block</span>
                            </button>
                          )}
                          {service.status === 'blocked' && (
                            <button
                              onClick={() => handleStatusChangeClick(service.id, service.title, 'unblock', 'active')}
                              className="text-green-600 hover:text-green-800 font-medium px-3 py-1 rounded hover:bg-green-50 transition-all flex items-center space-x-1"
                              title="Unblock"
                            >
                              <FontAwesomeIcon icon={faCheck} />
                              <span>Unblock</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
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

        {/* Confirmation Dialog */}
        {confirmDialog && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setConfirmDialog(null)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                      confirmDialog.action === 'approve' || confirmDialog.action === 'unblock'
                        ? 'bg-green-100'
                        : 'bg-red-100'
                    }`}
                  >
                    <FontAwesomeIcon
                      icon={confirmDialog.action === 'block' ? faBan : faExclamationTriangle}
                      className={`text-2xl ${
                        confirmDialog.action === 'approve' || confirmDialog.action === 'unblock'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {confirmDialog.action === 'approve'
                        ? 'Approve Service'
                        : confirmDialog.action === 'block'
                        ? 'Block Service'
                        : 'Unblock Service'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {confirmDialog.action === 'approve'
                        ? 'This will make the service visible to users'
                        : confirmDialog.action === 'block'
                        ? 'This will hide the service from users'
                        : 'This will make the service visible to users again'}
                    </p>
                  </div>
                </div>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to {confirmDialog.action} the service{' '}
                  <span className="font-semibold">"{confirmDialog.serviceTitle}"</span>?
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStatusChange}
                    className={`px-6 py-3 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg ${
                      confirmDialog.action === 'approve' || confirmDialog.action === 'unblock'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {confirmDialog.action === 'approve'
                      ? 'Approve Service'
                      : confirmDialog.action === 'block'
                      ? 'Block Service'
                      : 'Unblock Service'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Services

