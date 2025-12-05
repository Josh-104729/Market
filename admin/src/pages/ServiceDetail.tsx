import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faSpinner,
  faCheck,
  faBan,
  faTrash,
  faExclamationTriangle,
  faUser,
  faTag,
  faStar,
} from '@fortawesome/free-solid-svg-icons'
import { faStar as faStarRegular, faStarHalfStroke } from '@fortawesome/free-regular-svg-icons'
import { serviceApi, Service } from '../services/api'

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

interface ConfirmDialog {
  action: 'approve' | 'block' | 'unblock' | 'delete'
  newStatus?: 'draft' | 'active' | 'blocked'
}

function ServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id) {
      fetchService()
    }
  }, [id])

  const fetchService = async () => {
    try {
      setLoading(true)
      const data = await serviceApi.getById(id!)
      setService(data)
    } catch (error) {
      console.error('Failed to fetch service:', error)
      navigate('/services')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async () => {
    if (!confirmDialog || !service) return

    try {
      setActionLoading(true)
      if (confirmDialog.action === 'delete') {
        await serviceApi.delete(service.id)
        navigate('/services')
      } else if (confirmDialog.newStatus) {
        await serviceApi.updateStatus(service.id, confirmDialog.newStatus)
        await fetchService()
      }
      setConfirmDialog(null)
    } catch (error) {
      console.error('Failed to perform action:', error)
      alert('Failed to perform action')
    } finally {
      setActionLoading(false)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-600 mb-4" />
          <p className="text-gray-500">Loading service...</p>
        </div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Service not found</p>
          <button
            onClick={() => navigate('/services')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Back to Services
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate('/services')}
                className="mb-4 flex items-center space-x-2 text-blue-100 hover:text-white transition-colors"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Back to Services</span>
              </button>
              <h1 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">Service Details</h1>
              <p className="text-blue-100">Manage and review service information</p>
            </div>
            <div className="flex items-center space-x-3">
              <span
                className={`px-4 py-2 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusBadge(
                  service.status,
                )}`}
              >
                {service.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
            {/* Left Side - Image */}
            <div className="relative rounded-lg overflow-hidden min-h-[400px]">
              {service.adImage ? (
                <>
                  {/* Blurred background */}
                  <div
                    className="absolute inset-0 bg-cover bg-center filter blur-xl scale-110"
                    style={{
                      backgroundImage: `url(http://localhost:3000${service.adImage})`,
                    }}
                  />
                  {/* Actual image on top */}
                  <div className="relative h-full min-h-[400px] flex items-center justify-center p-8">
                    <img
                      src={`http://localhost:3000${service.adImage}`}
                      alt={service.title}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />
                  </div>
                </>
              ) : (
                <div className="h-full min-h-[400px] flex items-center justify-center bg-gray-50">
                  <div className="text-9xl text-gray-300">📦</div>
                </div>
              )}
            </div>

            {/* Right Side - Details */}
            <div className="flex flex-col">
              {/* Title and Category */}
              <div className="mb-6">
                {service.category && (
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full mb-3">
                    {service.category.title}
                  </span>
                )}
                <h2 className="text-3xl font-bold text-gray-900 mb-4">{service.title}</h2>
              </div>

              {/* Price and Rating */}
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200">
                <div className="text-right">
                  <div className="text-4xl font-bold text-blue-600">
                    ${typeof service.balance === 'number' 
                      ? (Math.round(service.balance * 100) / 100).toFixed(2)
                      : (Math.round(parseFloat(service.balance as any) * 100) / 100).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">Price</div>
                </div>
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
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Description</h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{service.adText}</p>
              </div>

              {/* Tags */}
              {service.tags && service.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center">
                    <FontAwesomeIcon icon={faTag} className="mr-2" />
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {service.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full"
                      >
                        {tag.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Seller Info */}
              {service.user && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center">
                    <FontAwesomeIcon icon={faUser} className="mr-2" />
                    Seller Information
                  </h3>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {service.user.firstName?.[0] || service.user.userName?.[0] || <FontAwesomeIcon icon={faUser} />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {service.user.firstName && service.user.lastName
                          ? `${service.user.firstName} ${service.user.lastName}`
                          : service.user.userName || 'Anonymous'}
                      </p>
                      <p className="text-sm text-gray-500">{service.user.email || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="mt-auto pt-6 border-t border-gray-200 text-sm text-gray-500 space-y-1">
                <p>Service ID: {service.id}</p>
                <p>Created: {new Date(service.createdAt).toLocaleString()}</p>
                <p>Last Updated: {new Date(service.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="flex flex-wrap gap-3">
              {service.status === 'draft' && (
                <button
                  onClick={() => setConfirmDialog({ action: 'approve', newStatus: 'active' })}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all shadow-md hover:shadow-lg flex items-center space-x-2"
                >
                  <FontAwesomeIcon icon={faCheck} />
                  <span>Approve Service</span>
                </button>
              )}
              {service.status === 'active' && (
                <button
                  onClick={() => setConfirmDialog({ action: 'block', newStatus: 'blocked' })}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all shadow-md hover:shadow-lg flex items-center space-x-2"
                >
                  <FontAwesomeIcon icon={faBan} />
                  <span>Block Service</span>
                </button>
              )}
              {service.status === 'blocked' && (
                <button
                  onClick={() => setConfirmDialog({ action: 'unblock', newStatus: 'active' })}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all shadow-md hover:shadow-lg flex items-center space-x-2"
                >
                  <FontAwesomeIcon icon={faCheck} />
                  <span>Unblock Service</span>
                </button>
              )}
              <button
                onClick={() => setConfirmDialog({ action: 'delete' })}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all shadow-md hover:shadow-lg flex items-center space-x-2"
              >
                <FontAwesomeIcon icon={faTrash} />
                <span>Delete Service</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !actionLoading && setConfirmDialog(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div
                  className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                    confirmDialog.action === 'delete'
                      ? 'bg-red-100'
                      : confirmDialog.action === 'approve' || confirmDialog.action === 'unblock'
                      ? 'bg-green-100'
                      : 'bg-red-100'
                  }`}
                >
                  <FontAwesomeIcon
                    icon={
                      confirmDialog.action === 'delete'
                        ? faTrash
                        : confirmDialog.action === 'block'
                        ? faBan
                        : faExclamationTriangle
                    }
                    className={`text-2xl ${
                      confirmDialog.action === 'delete'
                        ? 'text-red-600'
                        : confirmDialog.action === 'approve' || confirmDialog.action === 'unblock'
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
                      : confirmDialog.action === 'unblock'
                      ? 'Unblock Service'
                      : 'Delete Service'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {confirmDialog.action === 'approve'
                      ? 'This will make the service visible to users'
                      : confirmDialog.action === 'block'
                      ? 'This will hide the service from users'
                      : confirmDialog.action === 'unblock'
                      ? 'This will make the service visible to users again'
                      : 'This action cannot be undone'}
                  </p>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to {confirmDialog.action} the service{' '}
                <span className="font-semibold">"{service.title}"</span>?
                {confirmDialog.action === 'delete' && (
                  <span className="block mt-2 text-red-600 font-semibold">
                    This will permanently delete the service!
                  </span>
                )}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setConfirmDialog(null)}
                  disabled={actionLoading}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionLoading}
                  className={`px-6 py-3 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 ${
                    confirmDialog.action === 'delete'
                      ? 'bg-red-600 hover:bg-red-700'
                      : confirmDialog.action === 'approve' || confirmDialog.action === 'unblock'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      {confirmDialog.action === 'approve'
                        ? 'Approve Service'
                        : confirmDialog.action === 'block'
                        ? 'Block Service'
                        : confirmDialog.action === 'unblock'
                        ? 'Unblock Service'
                        : 'Delete Service'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ServiceDetail

