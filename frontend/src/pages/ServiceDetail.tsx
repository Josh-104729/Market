import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStar, faArrowLeft, faSpinner, faUser, faComments, faCheckCircle, faClipboardList } from '@fortawesome/free-solid-svg-icons'
import { faStar as faStarRegular, faStarHalfStroke } from '@fortawesome/free-regular-svg-icons'
import { serviceApi, Service, conversationApi, Conversation } from '../services/api'
import { useAppSelector } from '../store/hooks'
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
        <FontAwesomeIcon key={`empty-${i}`} icon={faStarRegular} className="text-gray-300" />
      ))}
    </div>
  )
}

function ServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [connectedClients, setConnectedClients] = useState<Conversation[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [feedbacks, setFeedbacks] = useState<Service['feedbacks']>([])
  const [loadingMoreFeedbacks, setLoadingMoreFeedbacks] = useState(false)
  const [currentFeedbackPage, setCurrentFeedbackPage] = useState(1)
  const [feedbacksHasMore, setFeedbacksHasMore] = useState(false)

  useEffect(() => {
    if (id) {
      fetchService()
    }
  }, [id])

  useEffect(() => {
    if (service && user && isAuthenticated) {
      // Check if user is the provider (owner of the service)
      const isProvider = service.userId === user.id
      if (isProvider) {
        fetchConnectedClients()
      }
    }
  }, [service, user, isAuthenticated])

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

  const fetchConnectedClients = async () => {
    if (!service || !user) {
      console.log('Cannot fetch clients: missing service or user', { service: !!service, user: !!user })
      return
    }

    // Double check that user is the provider
    if (service.userId !== user.id) {
      console.log('User is not the provider, skipping fetch', { serviceUserId: service.userId, userId: user.id })
      return
    }

    try {
      setLoadingClients(true)
      console.log('Fetching connected clients for service:', service.id)
      const conversations = await conversationApi.getByServiceIdAsProvider(service.id)
      console.log('Fetched connected clients:', conversations)
      setConnectedClients(Array.isArray(conversations) ? conversations : [])
    } catch (error: any) {
      console.error('Failed to fetch connected clients:', error)
      if (error.response) {
        console.error('Error response:', error.response.status, error.response.data)
        if (error.response.status === 403) {
          console.log('User is not the provider of this service')
        } else if (error.response.status === 404) {
          console.log('Service not found')
        }
      } else if (error.request) {
        console.error('No response received:', error.request)
      } else {
        console.error('Error setting up request:', error.message)
      }
      setConnectedClients([])
    } finally {
      setLoadingClients(false)
    }
  }

  const handleConnectSeller = async () => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    if (!service) return

    try {
      setConnecting(true)
      const conversation = await conversationApi.create(service.id)
      navigate(`/chat/${conversation.id}`)
    } catch (error: any) {
      console.error('Failed to connect with seller:', error)
      if (error.response?.status === 403) {
        alert('You cannot connect with yourself')
      } else {
        alert('Failed to connect with seller. Please try again.')
      }
    } finally {
      setConnecting(false)
    }
  }

  const handleClientClick = (conversationId: string) => {
    navigate(`/chat/${conversationId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-400 mb-4" />
          <p className="text-gray-400">Loading service...</p>
        </div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Service not found</p>
          <Link
            to="/services"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Back to Services
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/services')}
          className="mb-6 flex items-center space-x-2 text-gray-400 hover:text-blue-400 transition-colors"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Back to Services</span>
        </button>

        <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden">
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
                <div className="h-full min-h-[400px] flex items-center justify-center bg-gray-700">
                  <div className="text-9xl text-gray-500">📦</div>
                </div>
              )}
            </div>

            {/* Right Side - Details */}
            <div className="flex flex-col">
              {/* Title and Category */}
              <div className="mb-4">
                {service.category && (
                  <span className="inline-block px-3 py-1 bg-blue-900 text-blue-200 text-sm font-medium rounded-full mb-2">
                    {service.category.title}
                  </span>
                )}
                <h1 className="text-4xl font-bold text-gray-100 mb-4">{service.title}</h1>
              </div>

              {/* Rating and Price */}
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-700">
                <div className="flex items-center">
                  <StarRating
                    rating={
                      service.averageRating !== undefined
                        ? service.averageRating
                        : service.rating
                          ? typeof service.rating === 'number'
                            ? service.rating
                            : parseFloat(service.rating as any)
                          : 0
                    }
                  />
                  {service.averageRating !== undefined && service.averageRating > 0 && (
                    <span className="ml-2 text-gray-300 text-sm">
                      ({service.averageRating.toFixed(2)})
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-blue-400">
                    ${typeof service.balance === 'number' 
                      ? (Math.round(service.balance * 100) / 100).toFixed(2)
                      : (Math.round(parseFloat(service.balance as any) * 100) / 100).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400">Price</div>
                </div>
              </div>

              {/* Milestone Statistics */}
              <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                <h2 className="text-xl font-semibold text-gray-100 mb-4 flex items-center space-x-2">
                  <FontAwesomeIcon icon={faClipboardList} />
                  <span>Milestone Statistics</span>
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-blue-400">
                      {service.totalMilestones ?? 0}
                    </div>
                    <div className="text-sm text-gray-400">Total Milestones</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-400 flex items-center space-x-1">
                      <FontAwesomeIcon icon={faCheckCircle} className="text-sm" />
                      <span>{service.completedMilestones ?? 0}</span>
                    </div>
                    <div className="text-sm text-gray-400">Completed</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-purple-400">
                      {service.feedbackCount ?? 0}
                    </div>
                    <div className="text-sm text-gray-400">Feedbacks</div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-100 mb-3">Description</h2>
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{service.adText}</p>
              </div>

              {/* Tags */}
              {service.tags && service.tags.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-100 mb-3">Tags</h2>
                  <div className="flex flex-wrap gap-2">
                    {service.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="px-3 py-1 bg-gray-700 text-gray-300 text-sm font-medium rounded-full"
                      >
                        {tag.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Seller Info */}
              {service.user && (
                <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                  <h2 className="text-xl font-semibold text-gray-100 mb-3">Seller Information</h2>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {service.user.firstName?.[0] || service.user.userName?.[0] || <FontAwesomeIcon icon={faUser} />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-100">
                        {service.user.firstName && service.user.lastName
                          ? `${service.user.firstName} ${service.user.lastName}`
                          : service.user.userName || 'Anonymous'}
                      </p>
                      <p className="text-sm text-gray-400">Service Provider</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Connected Clients (Provider View) */}
              {service && user && isAuthenticated && service.userId === user.id && (
                <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                  <h2 className="text-xl font-semibold text-gray-100 mb-3 flex items-center space-x-2">
                    <FontAwesomeIcon icon={faComments} />
                    <span>Connected Clients</span>
                    {loadingClients && (
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin text-sm text-gray-400" />
                    )}
                  </h2>
                  {loadingClients ? (
                    <p className="text-gray-400 text-sm">Loading clients...</p>
                  ) : connectedClients.length === 0 ? (
                    <p className="text-gray-400 text-sm">No clients have connected yet</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {connectedClients.map((conversation) => {
                        const client = conversation.client
                        const lastMessage = conversation.messages && conversation.messages.length > 0
                          ? conversation.messages[0] // First message is the most recent (ordered DESC)
                          : null
                        return (
                          <button
                            key={conversation.id}
                            onClick={() => handleClientClick(conversation.id)}
                            className="w-full p-3 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors text-left"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                                {client?.firstName?.[0] || client?.userName?.[0] || <FontAwesomeIcon icon={faUser} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-100 truncate">
                                  {client?.firstName && client?.lastName
                                    ? `${client.firstName} ${client.lastName}`
                                    : client?.userName || 'Anonymous'}
                                </p>
                                {lastMessage && (
                                  <p className="text-xs text-gray-400 truncate mt-1">
                                    {lastMessage.message}
                                  </p>
                                )}
                              </div>
                              {lastMessage && (
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                  {new Date(lastMessage.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-auto">
                <button
                  onClick={handleConnectSeller}
                  disabled={connecting || !isAuthenticated || (service.user && service.user.id === user?.id)}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {connecting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faComments} />
                      <span>Connect Seller</span>
                    </>
                  )}
                </button>
              </div>

              {/* Additional Info */}
              <div className="mt-6 pt-6 border-t border-gray-700 text-sm text-gray-400">
                <p>Service ID: {service.id}</p>
                <p>Created: {new Date(service.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Feedbacks Section */}
          {feedbacks && feedbacks.length > 0 && (
            <div className="mt-8 p-8 bg-gray-800 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold text-gray-100 mb-6 flex items-center space-x-2">
                <FontAwesomeIcon icon={faComments} />
                <span>Customer Feedbacks</span>
                <span className="text-lg font-normal text-gray-400">
                  ({service.feedbackCount ?? 0})
                </span>
              </h2>
              <div className="space-y-4">
                {feedbacks.map((feedback) => (
                  <div
                    key={feedback.id}
                    className="bg-gray-700 rounded-lg p-6 border border-gray-600"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {feedback.client.firstName?.[0] || feedback.client.userName?.[0] || (
                            <FontAwesomeIcon icon={faUser} />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-100">
                            {feedback.client.firstName && feedback.client.lastName
                              ? `${feedback.client.firstName} ${feedback.client.lastName}`
                              : feedback.client.userName || 'Anonymous'}
                          </p>
                          <p className="text-xs text-gray-400">
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
                        <span className="text-gray-300 text-sm">({feedback.rating})</span>
                      </div>
                    </div>
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-gray-300 mb-1">
                        Milestone: {feedback.title}
                      </p>
                    </div>
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
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
            <div className="mt-8 p-8 bg-gray-800 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold text-gray-100 mb-4 flex items-center space-x-2">
                <FontAwesomeIcon icon={faComments} />
                <span>Customer Feedbacks</span>
              </h2>
              <p className="text-gray-400">No feedbacks yet. Be the first to leave a review!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ServiceDetail

