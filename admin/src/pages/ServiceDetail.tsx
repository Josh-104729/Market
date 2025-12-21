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
  faCheckCircle,
  faClipboardList,
  faComments,
} from '@fortawesome/free-solid-svg-icons'
import { faStar as faStarRegular, faStarHalfStroke } from '@fortawesome/free-regular-svg-icons'
import { serviceApi, Service } from '../services/api'
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
  const [feedbacks, setFeedbacks] = useState<Service['feedbacks']>([])
  const [loadingMoreFeedbacks, setLoadingMoreFeedbacks] = useState(false)
  const [currentFeedbackPage, setCurrentFeedbackPage] = useState(1)
  const [feedbacksHasMore, setFeedbacksHasMore] = useState(false)

  useEffect(() => {
    if (id) {
      fetchService()
    }
  }, [id])

  const fetchService = async (feedbackPage: number = 1) => {
    try {
      setLoading(true)
      const data = await serviceApi.getById(id!, feedbackPage, 10)
      setService(data)
      setFeedbacks(data.feedbacks || [])
      setFeedbacksHasMore(data.feedbacksHasMore || false)
      setCurrentFeedbackPage(feedbackPage)
    } catch (error) {
      console.error('Failed to fetch service:', error)
      navigate('/services')
    } finally {
      setLoading(false)
    }
  }

  const loadMoreFeedbacks = async () => {
    if (!id || loadingMoreFeedbacks || !feedbacksHasMore) return

    try {
      setLoadingMoreFeedbacks(true)
      const nextPage = currentFeedbackPage + 1
      const data = await serviceApi.getById(id, nextPage, 10)
      if (data.feedbacks) {
        setFeedbacks((prev) => [...(prev || []), ...data.feedbacks!])
        setFeedbacksHasMore(data.feedbacksHasMore || false)
        setCurrentFeedbackPage(nextPage)
      }
    } catch (error) {
      console.error('Failed to load more feedbacks:', error)
    } finally {
      setLoadingMoreFeedbacks(false)
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
      draft: 'bg-neutral-700 text-neutral-200',
      active: 'bg-green-900 text-green-200',
      blocked: 'bg-red-900 text-red-200',
    }
    return badges[status as keyof typeof badges] || badges.draft
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-400 mb-4" />
          <p className="text-neutral-400">Loading service...</p>
        </div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400 mb-4">Service not found</p>
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
    <div className="min-h-screen bg-neutral-900">
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
        <div className="bg-neutral-800 rounded-xl shadow-lg overflow-hidden">
          {/* Action Buttons at Top */}
          <div className="border-b border-neutral-700 p-6 bg-neutral-700">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
            {/* Left Side - Image */}
            <div className="relative rounded-lg overflow-hidden min-h-[400px]">
              {service.adImage ? (
                <div className="relative h-full min-h-[400px] flex items-center justify-center p-8">
                  <ImageWithLoader
                    src={service.adImage}
                    alt={service.title}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    containerClassName="w-full h-full"
                    showBlurBackground={true}
                  />
                </div>
              ) : (
                <div className="h-full min-h-[400px] flex items-center justify-center bg-neutral-700">
                  <div className="text-9xl text-neutral-500">📦</div>
                </div>
              )}
            </div>

            {/* Right Side - Details */}
            <div className="flex flex-col">
              {/* Title and Category */}
              <div className="mb-6">
                {service.category && (
                  <span className="inline-block px-3 py-1 bg-blue-900 text-blue-200 text-sm font-medium rounded-full mb-3">
                    {service.category.title}
                  </span>
                )}
                <h2 className="text-3xl font-bold text-neutral-100 mb-4">{service.title}</h2>
              </div>

              {/* Price and Rating */}
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-neutral-700">
                <div className="text-right">
                  <div className="text-4xl font-bold text-blue-400">
                    ${typeof service.balance === 'number' 
                      ? (Math.round(service.balance * 100) / 100).toFixed(2)
                      : (Math.round(parseFloat(service.balance as any) * 100) / 100).toFixed(2)}
                  </div>
                  <div className="text-sm text-neutral-400">Price</div>
                </div>
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
                  {service.averageRating !== undefined && service.averageRating > 0 && (
                    <span className="ml-2 text-neutral-300 text-sm">
                      ({service.averageRating.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>

              {/* Milestone Statistics */}
              <div className="mb-6 p-4 bg-neutral-700 rounded-lg">
                <h3 className="text-xl font-semibold text-neutral-100 mb-4 flex items-center space-x-2">
                  <FontAwesomeIcon icon={faClipboardList} />
                  <span>Milestone Statistics</span>
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-neutral-800 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-blue-400">
                      {service.totalMilestones ?? 0}
                    </div>
                    <div className="text-sm text-neutral-400">Total Milestones</div>
                  </div>
                  <div className="bg-neutral-800 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-400 flex items-center space-x-1">
                      <FontAwesomeIcon icon={faCheckCircle} className="text-sm" />
                      <span>{service.completedMilestones ?? 0}</span>
                    </div>
                    <div className="text-sm text-neutral-400">Completed</div>
                  </div>
                  <div className="bg-neutral-800 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-purple-400">
                      {service.feedbackCount ?? 0}
                    </div>
                    <div className="text-sm text-neutral-400">Feedbacks</div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-neutral-100 mb-3">Description</h3>
                <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap">{service.adText}</p>
              </div>

              {/* Tags */}
              {service.tags && service.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-neutral-100 mb-3 flex items-center">
                    <FontAwesomeIcon icon={faTag} className="mr-2" />
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {service.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="px-3 py-1 bg-neutral-700 text-neutral-300 text-sm font-medium rounded-full"
                      >
                        {tag.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Seller Info */}
              {service.user && (
                <div className="mb-6 p-4 bg-neutral-700 rounded-lg">
                  <h3 className="text-xl font-semibold text-neutral-100 mb-3 flex items-center">
                    <FontAwesomeIcon icon={faUser} className="mr-2" />
                    Seller Information
                  </h3>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {service.user.firstName?.[0] || service.user.userName?.[0] || <FontAwesomeIcon icon={faUser} />}
                    </div>
                    <div>
                      <p className="font-semibold text-neutral-100">
                        {service.user.firstName && service.user.lastName
                          ? `${service.user.firstName} ${service.user.lastName}`
                          : service.user.userName || 'Anonymous'}
                      </p>
                      <p className="text-sm text-neutral-400">{service.user.email || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="mt-auto pt-6 border-t border-neutral-700 text-sm text-neutral-400 space-y-1">
                <p>Service ID: {service.id}</p>
                <p>Created: {new Date(service.createdAt).toLocaleString()}</p>
                <p>Last Updated: {new Date(service.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Feedbacks Section */}
          {feedbacks && feedbacks.length > 0 && (
            <div className="mt-8 p-8 bg-neutral-800 border-t border-neutral-700">
              <h2 className="text-2xl font-bold text-neutral-100 mb-6 flex items-center space-x-2">
                <FontAwesomeIcon icon={faComments} />
                <span>Customer Feedbacks</span>
                <span className="text-lg font-normal text-neutral-400">
                  ({service.feedbackCount ?? 0})
                </span>
              </h2>
              <div className="space-y-4">
                {feedbacks.map((feedback) => (
                  <div
                    key={feedback.id}
                    className="bg-neutral-700 rounded-lg p-6 border border-neutral-600"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {feedback.client.firstName?.[0] || feedback.client.userName?.[0] || (
                            <FontAwesomeIcon icon={faUser} />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-neutral-100">
                            {feedback.client.firstName && feedback.client.lastName
                              ? `${feedback.client.firstName} ${feedback.client.lastName}`
                              : feedback.client.userName || 'Anonymous'}
                          </p>
                          <p className="text-xs text-neutral-400">
                            {new Date(feedback.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <StarRating rating={feedback.rating} />
                        <span className="text-neutral-300 text-sm">({feedback.rating})</span>
                      </div>
                    </div>
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-neutral-300 mb-1">
                        Milestone: {feedback.title}
                      </p>
                    </div>
                    <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap">
                      {feedback.feedback}
                    </p>
                  </div>
                ))}
              </div>
              {feedbacksHasMore && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={loadMoreFeedbacks}
                    disabled={loadingMoreFeedbacks}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {loadingMoreFeedbacks ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <span>Load More Feedbacks</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* No Feedbacks Message */}
          {(!feedbacks || feedbacks.length === 0) && (service.feedbackCount === 0 || !service.feedbackCount) && (
            <div className="mt-8 p-8 bg-neutral-800 border-t border-neutral-700">
              <h2 className="text-2xl font-bold text-neutral-100 mb-4 flex items-center space-x-2">
                <FontAwesomeIcon icon={faComments} />
                <span>Customer Feedbacks</span>
              </h2>
              <p className="text-neutral-400">No feedbacks yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !actionLoading && setConfirmDialog(null)}
        >
          <div
            className="bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div
                  className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                    confirmDialog.action === 'delete'
                      ? 'bg-red-900'
                      : confirmDialog.action === 'approve' || confirmDialog.action === 'unblock'
                      ? 'bg-green-900'
                      : 'bg-red-900'
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
                        ? 'text-red-300'
                        : confirmDialog.action === 'approve' || confirmDialog.action === 'unblock'
                        ? 'text-green-300'
                        : 'text-red-300'
                    }`}
                  />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neutral-100">
                    {confirmDialog.action === 'approve'
                      ? 'Approve Service'
                      : confirmDialog.action === 'block'
                      ? 'Block Service'
                      : confirmDialog.action === 'unblock'
                      ? 'Unblock Service'
                      : 'Delete Service'}
                  </h3>
                  <p className="text-sm text-neutral-400 mt-1">
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
              <p className="text-neutral-300 mb-6">
                Are you sure you want to {confirmDialog.action} the service{' '}
                <span className="font-semibold">"{service.title}"</span>?
                {confirmDialog.action === 'delete' && (
                  <span className="block mt-2 text-red-400 font-semibold">
                    This will permanently delete the service!
                  </span>
                )}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setConfirmDialog(null)}
                  disabled={actionLoading}
                  className="px-6 py-3 border-2 border-neutral-600 rounded-lg text-neutral-300 font-semibold hover:bg-neutral-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

