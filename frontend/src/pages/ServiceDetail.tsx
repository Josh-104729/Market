import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStar, faArrowLeft, faSpinner, faUser } from '@fortawesome/free-solid-svg-icons'
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

function ServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)

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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/services')}
          className="mb-6 flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Back to Services</span>
        </button>

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
                  <div className="relative h-full flex items-center justify-center p-8">
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
              <div className="mb-4">
                {service.category && (
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full mb-2">
                    {service.category.title}
                  </span>
                )}
                <h1 className="text-4xl font-bold text-gray-900 mb-4">{service.title}</h1>
              </div>

              {/* Rating and Price */}
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200">
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
                <div className="text-right">
                  <div className="text-4xl font-bold text-blue-600">
                    ${typeof service.balance === 'number' 
                      ? (Math.round(service.balance * 100) / 100).toFixed(2)
                      : (Math.round(parseFloat(service.balance as any) * 100) / 100).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">Price</div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Description</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{service.adText}</p>
              </div>

              {/* Tags */}
              {service.tags && service.tags.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-3">Tags</h2>
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
                  <h2 className="text-xl font-semibold text-gray-900 mb-3">Seller Information</h2>
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
                      <p className="text-sm text-gray-500">Service Provider</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-auto space-y-3">
                <button className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg text-lg">
                  Contact Seller
                </button>
                <button className="w-full px-6 py-4 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors text-lg">
                  Add to Favorites
                </button>
              </div>

              {/* Additional Info */}
              <div className="mt-6 pt-6 border-t border-gray-200 text-sm text-gray-500">
                <p>Service ID: {service.id}</p>
                <p>Created: {new Date(service.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ServiceDetail

