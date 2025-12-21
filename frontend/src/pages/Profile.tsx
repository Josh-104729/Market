import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUser,
  faEnvelope,
  faIdCard,
  faSpinner,
  faBriefcase,
  faComments,
  faTasks,
  faNewspaper,
  faChartBar,
  faDollarSign,
  faCalendar,
  faCheckCircle,
  faClock,
  faTimesCircle,
  faEdit,
  faSave,
  faTimes,
  faPhone,
  faMapMarkerAlt,
  faFileAlt,
  faShieldAlt,
} from '@fortawesome/free-solid-svg-icons'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { updateUser, User as UserType } from '../store/slices/authSlice'
import { showToast } from '../utils/toast'
import {
  authApi,
  serviceApi,
  conversationApi,
  milestoneApi,
  blogApi,
  Service,
  Conversation,
  Milestone,
  Post,
} from '../services/api'

type TabType = 'information' | 'services' | 'conversations' | 'milestones' | 'posts' | 'statistics'

function Profile() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { user: storeUser, isAuthenticated } = useAppSelector((state) => state.auth)
  const [user, setUser] = useState<UserType | null>(storeUser)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('information')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    userName: '',
    firstName: '',
    lastName: '',
    middleName: '',
    bio: '',
    address: '',
    phoneNumber: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Data states
  const [services, setServices] = useState<Service[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    const fetchProfile = async () => {
      try {
        setLoading(true)
        const profileData = await authApi.getProfile()
        setUser(profileData)
        setEditForm({
          userName: profileData.userName || '',
          firstName: profileData.firstName || '',
          lastName: profileData.lastName || '',
          middleName: profileData.middleName || '',
          bio: profileData.bio || '',
          address: profileData.address || '',
          phoneNumber: profileData.phoneNumber || '',
        })
      } catch (error) {
        console.error('Failed to fetch profile:', error)
        setUser(storeUser)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [isAuthenticated, navigate, storeUser])

  useEffect(() => {
    if (!user?.id) return

    const fetchTabData = async () => {
      setLoadingData(true)
      try {
        switch (activeTab) {
          case 'services':
            const servicesData = await serviceApi.getMyServices({ limit: 50 })
            setServices(servicesData.data)
            break
          case 'conversations':
            const conversationsData = await conversationApi.getAll()
            const userConversations = conversationsData.filter(
              (conv) => conv.clientId === user.id || conv.providerId === user.id
            )
            setConversations(userConversations)
            break
          case 'milestones':
            const allConversations = await conversationApi.getAll()
            const userConvs = allConversations.filter(
              (conv) => conv.clientId === user.id || conv.providerId === user.id
            )
            const milestonePromises = userConvs.map((conv) => milestoneApi.getByConversation(conv.id))
            const milestoneResults = await Promise.all(milestonePromises)
            const allMilestones = milestoneResults.flat()
            const userMilestones = allMilestones.filter(
              (milestone) => milestone.clientId === user.id || milestone.providerId === user.id
            )
            setMilestones(userMilestones)
            break
          case 'posts':
            const postsData = await blogApi.getAll({ limit: 50 })
            const userPosts = postsData.data.filter((post) => post.userId === user.id)
            setPosts(userPosts)
            break
        }
      } catch (error) {
        console.error(`Failed to fetch ${activeTab}:`, error)
        showToast.error(`Failed to load ${activeTab}`)
      } finally {
        setLoadingData(false)
      }
    }

    fetchTabData()
  }, [activeTab, user?.id])

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      const updatedProfile = await authApi.updateProfile(editForm)
      setUser(updatedProfile)
      dispatch(updateUser(updatedProfile))
      setIsEditing(false)
      showToast.success('Profile updated successfully!')
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update profile'
      setError(errorMessage)
      showToast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setError('')
    if (user) {
      setEditForm({
        userName: user.userName || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        middleName: user.middleName || '',
        bio: user.bio || '',
        address: user.address || '',
        phoneNumber: user.phoneNumber || '',
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; icon: any }> = {
      draft: { bg: 'bg-neutral-700', text: 'text-neutral-200', icon: faClock },
      active: { bg: 'bg-green-900', text: 'text-green-200', icon: faCheckCircle },
      blocked: { bg: 'bg-red-900', text: 'text-red-200', icon: faTimesCircle },
      processing: { bg: 'bg-blue-900', text: 'text-blue-200', icon: faClock },
      completed: { bg: 'bg-green-900', text: 'text-green-200', icon: faCheckCircle },
      canceled: { bg: 'bg-red-900', text: 'text-red-200', icon: faTimesCircle },
      withdraw: { bg: 'bg-yellow-900', text: 'text-yellow-200', icon: faClock },
      released: { bg: 'bg-green-900', text: 'text-green-200', icon: faCheckCircle },
      dispute: { bg: 'bg-orange-900', text: 'text-orange-200', icon: faTimesCircle },
      published: { bg: 'bg-green-900', text: 'text-green-200', icon: faCheckCircle },
      archived: { bg: 'bg-neutral-700', text: 'text-neutral-200', icon: faClock },
    }
    return badges[status] || badges.draft
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // Calculate statistics
  const stats = {
    totalServices: services.length,
    activeServices: services.filter((s) => s.status === 'active').length,
    totalConversations: conversations.length,
    totalMilestones: milestones.length,
    completedMilestones: milestones.filter((m) => m.status === 'completed' || m.status === 'released').length,
    totalPosts: posts.length,
    totalEarnings: milestones
      .filter((m) => (m.status === 'completed' || m.status === 'released') && m.providerId === user?.id)
      .reduce((sum, m) => sum + m.balance, 0),
    totalSpent: milestones
      .filter((m) => (m.status === 'completed' || m.status === 'released') && m.clientId === user?.id)
      .reduce((sum, m) => sum + m.balance, 0),
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-400 mb-4" />
          <p className="text-neutral-400">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400 text-lg">No user data available</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'information' as TabType, label: 'Information', icon: faUser },
    { id: 'services' as TabType, label: 'Services', icon: faBriefcase },
    { id: 'conversations' as TabType, label: 'Conversations', icon: faComments },
    { id: 'milestones' as TabType, label: 'Milestones', icon: faTasks },
    { id: 'posts' as TabType, label: 'Posts', icon: faNewspaper },
    { id: 'statistics' as TabType, label: 'Statistics', icon: faChartBar },
  ]

  return (
    <div className="min-h-screen bg-neutral-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <div className="bg-neutral-800 rounded-xl shadow-lg border border-neutral-700 p-4 sticky top-4">
              <nav className="space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-all flex items-center space-x-3 text-left ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-neutral-300 hover:bg-neutral-700 hover:text-blue-400'
                    }`}
                  >
                    <FontAwesomeIcon icon={tab.icon} className="text-sm w-5" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-neutral-800 rounded-xl shadow-lg border border-neutral-700 p-6">
              {loadingData ? (
                <div className="text-center py-20">
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-400 mb-4" />
                  <p className="text-neutral-400">Loading...</p>
                </div>
              ) : (
                <>
                  {/* Information Tab */}
                  {activeTab === 'information' && (
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-neutral-100 flex items-center space-x-2">
                          <FontAwesomeIcon icon={faUser} className="text-blue-400" />
                          <span>Profile Information</span>
                        </h2>
                        <div className="flex items-center space-x-3">
                          {!isEditing && (
                            <>
                              <Link
                                to="/settings/security"
                                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center space-x-2"
                              >
                                <FontAwesomeIcon icon={faShieldAlt} className="text-sm" />
                                <span>Security Settings</span>
                              </Link>
                              <button
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2"
                              >
                                <FontAwesomeIcon icon={faEdit} className="text-sm" />
                                <span>Edit</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {error && (
                        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                          {error}
                        </div>
                      )}

                      {isEditing ? (
                        <div className="space-y-4">
                          <div className="bg-neutral-700/50 rounded-lg p-4">
                            <label className="block text-sm font-medium text-neutral-400 mb-2">
                              <FontAwesomeIcon icon={faEnvelope} className="mr-2 text-blue-400" />
                              Email
                            </label>
                            <p className="text-neutral-300">{user.email}</p>
                            <p className="text-xs text-neutral-500 mt-1">Email cannot be changed</p>
                          </div>

                          <div className="bg-neutral-700/50 rounded-lg p-4">
                            <label className="block text-sm font-medium text-neutral-400 mb-2">
                              <FontAwesomeIcon icon={faIdCard} className="mr-2 text-blue-400" />
                              Username
                            </label>
                            <input
                              type="text"
                              value={editForm.userName}
                              onChange={(e) => setEditForm({ ...editForm, userName: e.target.value })}
                              className="w-full px-4 py-2 bg-neutral-600 border border-neutral-500 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter username"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-neutral-700/50 rounded-lg p-4">
                              <label className="block text-sm font-medium text-neutral-400 mb-2">
                                <FontAwesomeIcon icon={faUser} className="mr-2 text-blue-400" />
                                First Name
                              </label>
                              <input
                                type="text"
                                value={editForm.firstName}
                                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                                className="w-full px-4 py-2 bg-neutral-600 border border-neutral-500 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter first name"
                              />
                            </div>

                            <div className="bg-neutral-700/50 rounded-lg p-4">
                              <label className="block text-sm font-medium text-neutral-400 mb-2">
                                <FontAwesomeIcon icon={faUser} className="mr-2 text-blue-400" />
                                Last Name
                              </label>
                              <input
                                type="text"
                                value={editForm.lastName}
                                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                                className="w-full px-4 py-2 bg-neutral-600 border border-neutral-500 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter last name"
                              />
                            </div>
                          </div>

                          <div className="bg-neutral-700/50 rounded-lg p-4">
                            <label className="block text-sm font-medium text-neutral-400 mb-2">
                              <FontAwesomeIcon icon={faUser} className="mr-2 text-blue-400" />
                              Middle Name
                            </label>
                            <input
                              type="text"
                              value={editForm.middleName}
                              onChange={(e) => setEditForm({ ...editForm, middleName: e.target.value })}
                              className="w-full px-4 py-2 bg-neutral-600 border border-neutral-500 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter middle name (optional)"
                            />
                          </div>

                          <div className="bg-neutral-700/50 rounded-lg p-4">
                            <label className="block text-sm font-medium text-neutral-400 mb-2">
                              <FontAwesomeIcon icon={faFileAlt} className="mr-2 text-blue-400" />
                              Bio
                            </label>
                            <textarea
                              value={editForm.bio}
                              onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                              rows={4}
                              className="w-full px-4 py-2 bg-neutral-600 border border-neutral-500 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Tell us about yourself..."
                            />
                          </div>

                          <div className="bg-neutral-700/50 rounded-lg p-4">
                            <label className="block text-sm font-medium text-neutral-400 mb-2">
                              <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-2 text-blue-400" />
                              Address
                            </label>
                            <input
                              type="text"
                              value={editForm.address}
                              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                              className="w-full px-4 py-2 bg-neutral-600 border border-neutral-500 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter address"
                            />
                          </div>

                          <div className="bg-neutral-700/50 rounded-lg p-4">
                            <label className="block text-sm font-medium text-neutral-400 mb-2">
                              <FontAwesomeIcon icon={faPhone} className="mr-2 text-blue-400" />
                              Phone Number
                            </label>
                            <input
                              type="text"
                              value={editForm.phoneNumber}
                              onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                              className="w-full px-4 py-2 bg-neutral-600 border border-neutral-500 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter phone number"
                            />
                          </div>

                          <div className="flex items-center space-x-3 pt-4">
                            <button
                              onClick={handleSave}
                              disabled={saving}
                              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                            >
                              {saving ? (
                                <>
                                  <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                  <span>Saving...</span>
                                </>
                              ) : (
                                <>
                                  <FontAwesomeIcon icon={faSave} className="text-sm" />
                                  <span>Save Changes</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={handleCancel}
                              disabled={saving}
                              className="px-6 py-2 bg-neutral-600 text-neutral-200 rounded-lg font-semibold hover:bg-neutral-500 transition-colors flex items-center space-x-2 disabled:opacity-50"
                            >
                              <FontAwesomeIcon icon={faTimes} className="text-sm" />
                              <span>Cancel</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-neutral-700/50 rounded-lg p-4">
                            <div className="flex items-center space-x-3 mb-2">
                              <FontAwesomeIcon icon={faEnvelope} className="text-blue-400" />
                              <label className="text-sm font-medium text-neutral-400">Email</label>
                            </div>
                            <p className="text-neutral-100 text-lg">{user.email}</p>
                          </div>

                          {user.userName && (
                            <div className="bg-neutral-700/50 rounded-lg p-4">
                              <div className="flex items-center space-x-3 mb-2">
                                <FontAwesomeIcon icon={faIdCard} className="text-blue-400" />
                                <label className="text-sm font-medium text-neutral-400">Username</label>
                              </div>
                              <p className="text-neutral-100 text-lg">{user.userName}</p>
                            </div>
                          )}

                          {user.firstName && (
                            <div className="bg-neutral-700/50 rounded-lg p-4">
                              <div className="flex items-center space-x-3 mb-2">
                                <FontAwesomeIcon icon={faUser} className="text-blue-400" />
                                <label className="text-sm font-medium text-neutral-400">First Name</label>
                              </div>
                              <p className="text-neutral-100 text-lg">{user.firstName}</p>
                            </div>
                          )}

                          {user.lastName && (
                            <div className="bg-neutral-700/50 rounded-lg p-4">
                              <div className="flex items-center space-x-3 mb-2">
                                <FontAwesomeIcon icon={faUser} className="text-blue-400" />
                                <label className="text-sm font-medium text-neutral-400">Last Name</label>
                              </div>
                              <p className="text-neutral-100 text-lg">{user.lastName}</p>
                            </div>
                          )}

                          {user.middleName && (
                            <div className="bg-neutral-700/50 rounded-lg p-4">
                              <div className="flex items-center space-x-3 mb-2">
                                <FontAwesomeIcon icon={faUser} className="text-blue-400" />
                                <label className="text-sm font-medium text-neutral-400">Middle Name</label>
                              </div>
                              <p className="text-neutral-100 text-lg">{user.middleName}</p>
                            </div>
                          )}

                          {user.bio && (
                            <div className="bg-neutral-700/50 rounded-lg p-4">
                              <div className="flex items-center space-x-3 mb-2">
                                <FontAwesomeIcon icon={faFileAlt} className="text-blue-400" />
                                <label className="text-sm font-medium text-neutral-400">Bio</label>
                              </div>
                              <p className="text-neutral-100 text-lg whitespace-pre-wrap">{user.bio}</p>
                            </div>
                          )}

                          {user.address && (
                            <div className="bg-neutral-700/50 rounded-lg p-4">
                              <div className="flex items-center space-x-3 mb-2">
                                <FontAwesomeIcon icon={faMapMarkerAlt} className="text-blue-400" />
                                <label className="text-sm font-medium text-neutral-400">Address</label>
                              </div>
                              <p className="text-neutral-100 text-lg">{user.address}</p>
                            </div>
                          )}

                          {user.phoneNumber && (
                            <div className="bg-neutral-700/50 rounded-lg p-4">
                              <div className="flex items-center space-x-3 mb-2">
                                <FontAwesomeIcon icon={faPhone} className="text-blue-400" />
                                <label className="text-sm font-medium text-neutral-400">Phone Number</label>
                              </div>
                              <p className="text-neutral-100 text-lg">{user.phoneNumber}</p>
                            </div>
                          )}

                          {user.role && (
                            <div className="bg-neutral-700/50 rounded-lg p-4">
                              <div className="flex items-center space-x-3 mb-2">
                                <FontAwesomeIcon icon={faIdCard} className="text-blue-400" />
                                <label className="text-sm font-medium text-neutral-400">Role</label>
                              </div>
                              <p className="text-neutral-100 text-lg capitalize">{user.role}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Services Tab */}
                  {activeTab === 'services' && (
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-neutral-100 flex items-center space-x-2">
                          <FontAwesomeIcon icon={faBriefcase} className="text-blue-400" />
                          <span>My Services ({services.length})</span>
                        </h2>
                        <Link
                          to="/services/new"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                        >
                          Create Service
                        </Link>
                      </div>
                      {services.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-neutral-400 mb-4">No services found</p>
                          <Link
                            to="/services/new"
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
                          >
                            Create Your First Service
                          </Link>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {services.map((service) => {
                            const statusBadge = getStatusBadge(service.status)
                            return (
                              <Link
                                key={service.id}
                                to={`/services/${service.id}`}
                                className="bg-neutral-700 rounded-lg p-4 hover:bg-neutral-600 transition-colors border border-neutral-600"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <h3 className="text-lg font-semibold text-neutral-100 line-clamp-2 flex-1">
                                    {service.title}
                                  </h3>
                                  <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                                    {service.status}
                                  </span>
                                </div>
                                <p className="text-neutral-400 text-sm mb-3 line-clamp-2">{service.adText}</p>
                                <div className="flex items-center justify-between">
                                  <span className="text-xl font-bold text-blue-400">
                                    {formatCurrency(service.balance)}
                                  </span>
                                  {service.category && (
                                    <span className="text-xs text-neutral-400">{service.category.title}</span>
                                  )}
                                </div>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Conversations Tab */}
                  {activeTab === 'conversations' && (
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-100 mb-6 flex items-center space-x-2">
                        <FontAwesomeIcon icon={faComments} className="text-blue-400" />
                        <span>Conversations ({conversations.length})</span>
                      </h2>
                      {conversations.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-neutral-400">No conversations found</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {conversations.map((conv) => {
                            const otherUser = conv.clientId === user.id ? conv.provider : conv.client
                            const otherUserName = otherUser
                              ? `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() || otherUser.userName || 'Unknown'
                              : 'Unknown'
                            return (
                              <Link
                                key={conv.id}
                                to={`/chat/${conv.id}`}
                                className="block bg-neutral-700 rounded-lg p-4 hover:bg-neutral-600 transition-colors border border-neutral-600"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                                      {otherUserName[0].toUpperCase()}
                                    </div>
                                    <div>
                                      <h3 className="text-neutral-100 font-semibold">{otherUserName}</h3>
                                      {conv.service && (
                                        <p className="text-neutral-400 text-sm">{conv.service.title}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-neutral-400 text-xs">{formatDate(conv.updatedAt)}</p>
                                    {conv.messages && conv.messages.length > 0 && (
                                      <p className="text-neutral-500 text-xs mt-1 line-clamp-1">
                                        {conv.messages[conv.messages.length - 1].message}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Milestones Tab */}
                  {activeTab === 'milestones' && (
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-100 mb-6 flex items-center space-x-2">
                        <FontAwesomeIcon icon={faTasks} className="text-blue-400" />
                        <span>Milestones ({milestones.length})</span>
                      </h2>
                      {milestones.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-neutral-400">No milestones found</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {milestones.map((milestone) => {
                            const statusBadge = getStatusBadge(milestone.status)
                            const isProvider = milestone.providerId === user.id
                            const otherUser = isProvider ? milestone.client : milestone.provider
                            const otherUserName = otherUser
                              ? `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() || otherUser.userName || 'Unknown'
                              : 'Unknown'
                            return (
                              <div
                                key={milestone.id}
                                className="bg-neutral-700 rounded-lg p-4 border border-neutral-600"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-neutral-100 mb-1">{milestone.title}</h3>
                                    <p className="text-neutral-400 text-sm mb-2">{milestone.description}</p>
                                    {milestone.service && (
                                      <p className="text-neutral-500 text-xs mb-2">Service: {milestone.service.title}</p>
                                    )}
                                    <div className="flex items-center space-x-4 text-sm text-neutral-400">
                                      <span>
                                        {isProvider ? 'Client' : 'Provider'}: {otherUserName}
                                      </span>
                                      <span className="flex items-center space-x-1">
                                        <FontAwesomeIcon icon={faCalendar} className="text-xs" />
                                        <span>{formatDate(milestone.createdAt)}</span>
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right ml-4">
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusBadge.bg} ${statusBadge.text} flex items-center space-x-1 mb-2`}>
                                      <FontAwesomeIcon icon={statusBadge.icon} className="text-xs" />
                                      <span>{milestone.status}</span>
                                    </span>
                                    <p className="text-xl font-bold text-blue-400">
                                      {formatCurrency(milestone.balance)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Posts Tab */}
                  {activeTab === 'posts' && (
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-100 mb-6 flex items-center space-x-2">
                        <FontAwesomeIcon icon={faNewspaper} className="text-blue-400" />
                        <span>My Posts ({posts.length})</span>
                      </h2>
                      {posts.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-neutral-400 mb-4">No posts found</p>
                          <Link
                            to="/feed"
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
                          >
                            Create Your First Post
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {posts.map((post) => {
                            const statusBadge = getStatusBadge(post.status)
                            return (
                              <div
                                key={post.id}
                                className="bg-neutral-700 rounded-lg p-4 border border-neutral-600"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <p className="text-neutral-200 whitespace-pre-wrap break-words mb-2">{post.content}</p>
                                    {post.images && post.images.length > 0 && (
                                      <div className="grid grid-cols-2 gap-2 mt-2">
                                        {post.images.slice(0, 4).map((image, idx) => (
                                          <img
                                            key={idx}
                                            src={`http://localhost:3000${image}`}
                                            alt={`Post image ${idx + 1}`}
                                            className="w-full h-32 object-cover rounded-lg"
                                          />
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex items-center space-x-4 mt-3 text-sm text-neutral-400">
                                      <span className="flex items-center space-x-1">
                                        <FontAwesomeIcon icon={faCalendar} className="text-xs" />
                                        <span>{formatDate(post.createdAt)}</span>
                                      </span>
                                      {post.likeCount !== undefined && (
                                        <span>{post.likeCount} likes</span>
                                      )}
                                      {post.commentCount !== undefined && (
                                        <span>{post.commentCount} comments</span>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`ml-4 px-3 py-1 text-xs font-semibold rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                                    {post.status}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Statistics Tab */}
                  {activeTab === 'statistics' && (
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-100 mb-6 flex items-center space-x-2">
                        <FontAwesomeIcon icon={faChartBar} className="text-blue-400" />
                        <span>Statistics & Overview</span>
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="bg-neutral-700 rounded-lg p-6 border border-neutral-600">
                          <div className="flex items-center justify-between mb-2">
                            <FontAwesomeIcon icon={faBriefcase} className="text-blue-400 text-2xl" />
                            <span className="text-3xl font-bold text-neutral-100">{stats.totalServices}</span>
                          </div>
                          <p className="text-neutral-400 text-sm">Total Services</p>
                          <p className="text-green-400 text-xs mt-1">{stats.activeServices} active</p>
                        </div>
                        <div className="bg-neutral-700 rounded-lg p-6 border border-neutral-600">
                          <div className="flex items-center justify-between mb-2">
                            <FontAwesomeIcon icon={faComments} className="text-purple-400 text-2xl" />
                            <span className="text-3xl font-bold text-neutral-100">{stats.totalConversations}</span>
                          </div>
                          <p className="text-neutral-400 text-sm">Conversations</p>
                        </div>
                        <div className="bg-neutral-700 rounded-lg p-6 border border-neutral-600">
                          <div className="flex items-center justify-between mb-2">
                            <FontAwesomeIcon icon={faTasks} className="text-green-400 text-2xl" />
                            <span className="text-3xl font-bold text-neutral-100">{stats.totalMilestones}</span>
                          </div>
                          <p className="text-neutral-400 text-sm">Total Milestones</p>
                          <p className="text-green-400 text-xs mt-1">{stats.completedMilestones} completed</p>
                        </div>
                        <div className="bg-neutral-700 rounded-lg p-6 border border-neutral-600">
                          <div className="flex items-center justify-between mb-2">
                            <FontAwesomeIcon icon={faNewspaper} className="text-pink-400 text-2xl" />
                            <span className="text-3xl font-bold text-neutral-100">{stats.totalPosts}</span>
                          </div>
                          <p className="text-neutral-400 text-sm">Posts</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-neutral-700 rounded-lg p-6 border border-neutral-600">
                          <div className="flex items-center justify-between mb-2">
                            <FontAwesomeIcon icon={faDollarSign} className="text-green-400 text-2xl" />
                            <span className="text-2xl font-bold text-green-400">{formatCurrency(stats.totalEarnings)}</span>
                          </div>
                          <p className="text-neutral-400 text-sm">Total Earnings</p>
                          <p className="text-neutral-500 text-xs mt-1">From completed milestones as provider</p>
                        </div>
                        <div className="bg-neutral-700 rounded-lg p-6 border border-neutral-600">
                          <div className="flex items-center justify-between mb-2">
                            <FontAwesomeIcon icon={faDollarSign} className="text-red-400 text-2xl" />
                            <span className="text-2xl font-bold text-red-400">{formatCurrency(stats.totalSpent)}</span>
                          </div>
                          <p className="text-neutral-400 text-sm">Total Spent</p>
                          <p className="text-neutral-500 text-xs mt-1">On completed milestones as client</p>
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
    </div>
  )
}

export default Profile
