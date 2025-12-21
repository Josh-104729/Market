import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../services/api'
import { showToast } from '../utils/toast'

interface Milestone {
  id: string
  title: string
  description: string
  balance: number
  status: string
  feedback?: string
  rating?: number
  clientId: string
  providerId: string
  client?: {
    id: string
    firstName?: string
    lastName?: string
    userName?: string
    email?: string
  }
  provider?: {
    id: string
    firstName?: string
    lastName?: string
    userName?: string
    email?: string
  }
  createdAt: string
  updatedAt: string
}

interface Conversation {
  id: string
  clientId: string
  providerId: string
  serviceId: string
  client?: {
    id: string
    firstName?: string
    lastName?: string
    userName?: string
    email?: string
  }
  provider?: {
    id: string
    firstName?: string
    lastName?: string
    userName?: string
    email?: string
  }
  service?: {
    id: string
    title: string
  }
  disputedMilestones: Milestone[]
  updatedAt: string
}

function Disputes() {
  const navigate = useNavigate()
  const [disputes, setDisputes] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDisputes()
  }, [])

  const fetchDisputes = async () => {
    try {
      setLoading(true)
      const data = await adminApi.getDisputes()
      setDisputes(data)
    } catch (error: any) {
      console.error('Failed to fetch disputes:', error)
      showToast.error(error.response?.data?.message || 'Failed to load disputes')
    } finally {
      setLoading(false)
    }
  }

  const handleViewChat = (conversationId: string) => {
    navigate(`/chat/${conversationId}`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getUserName = (user?: { firstName?: string; lastName?: string; userName?: string; email?: string }) => {
    if (!user) return 'Unknown'
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim()
    }
    return user.userName || user.email || 'Unknown'
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-white">Loading disputes...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Disputes</h1>
        <p className="text-neutral-300">Manage and resolve milestone disputes</p>
      </div>

      {disputes.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-neutral-300 text-lg">No disputes found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <div key={dispute.id} className="glass-card p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {dispute.service?.title || 'Service'}
                  </h3>
                  <div className="text-neutral-300 space-y-1">
                    <p>
                      <span className="font-medium">Client:</span> {getUserName(dispute.client)}
                    </p>
                    <p>
                      <span className="font-medium">Provider:</span> {getUserName(dispute.provider)}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Last Updated:</span> {formatDate(dispute.updatedAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleViewChat(dispute.id)}
                  className="bg-primary hover:bg-primary/80 text-white px-6 py-2 rounded-lg font-semibold transition-all"
                >
                  View Chat
                </button>
              </div>

              <div className="mt-4">
                <h4 className="text-white font-semibold mb-2">Disputed Milestones:</h4>
                <div className="space-y-3">
                  {dispute.disputedMilestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="bg-black/20 p-4 rounded-lg border border-white/10"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h5 className="text-white font-medium mb-1">{milestone.title}</h5>
                          <p className="text-neutral-300 text-sm mb-2">{milestone.description}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-neutral-300">
                              <span className="font-medium">Amount:</span> {Number(milestone.balance).toFixed(2)} USD
                            </span>
                            <span className="text-yellow-400">
                              Status: {milestone.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Disputes

