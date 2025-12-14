import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faSpinner,
  faPaperPlane,
  faUser,
  faCheckCircle,
  faDollarSign,
} from '@fortawesome/free-solid-svg-icons'
import { conversationApi, messageApi, milestoneApi, adminApi, Conversation, Message, Milestone } from '../services/api'
import { getSocket } from '../services/socket'
import { Socket } from 'socket.io-client'
import { showToast } from '../utils/toast'

function Chat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [releasingMilestone, setReleasingMilestone] = useState<string | null>(null)
  const [releaseAmount, setReleaseAmount] = useState<{ [key: string]: string }>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (id) {
      fetchConversation()
      fetchMessages()
      fetchMilestones()
    }
  }, [id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!id) return

    const socket = getSocket()
    if (!socket) {
      console.warn('Socket not available')
      return
    }

    socketRef.current = socket

    const setupSocket = () => {
      if (socket.connected) {
        socket.emit('join_conversation', { conversationId: id })
      } else {
        socket.once('connect', () => {
          socket.emit('join_conversation', { conversationId: id })
        })
      }
    }

    setupSocket()

    const handleNewMessage = (message: Message) => {
      if (message.conversationId === id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) {
            return prev
          }
          return [...prev, message]
        })
      }
    }

    const handleMilestoneUpdate = () => {
      fetchMilestones()
    }

    socket.on('new_message', handleNewMessage)
    socket.on('milestone_updated', handleMilestoneUpdate)

    return () => {
      socket.off('new_message', handleNewMessage)
      socket.off('milestone_updated', handleMilestoneUpdate)
      socket.emit('leave_conversation', { conversationId: id })
    }
  }, [id])

  const fetchConversation = async () => {
    if (!id) return
    try {
      const data = await conversationApi.getById(id)
      setConversation(data)
    } catch (error: any) {
      console.error('Failed to fetch conversation:', error)
      showToast.error('Failed to load conversation')
    }
  }

  const fetchMessages = async () => {
    if (!id) return
    try {
      const data = await messageApi.getByConversation(id)
      setMessages(data)
    } catch (error: any) {
      console.error('Failed to fetch messages:', error)
      showToast.error('Failed to load messages')
    } finally {
      setLoading(false)
    }
  }

  const fetchMilestones = async () => {
    if (!id) return
    try {
      const data = await milestoneApi.getByConversation(id)
      setMilestones(data || [])
    } catch (error: any) {
      console.error('Failed to fetch milestones:', error)
      showToast.error(error.response?.data?.message || 'Failed to load milestones')
    }
  }

  const handleSendMessage = async () => {
    if (!id || !messageText.trim() || sending) return

    try {
      setSending(true)
      await messageApi.create(id, messageText.trim())
      setMessageText('')
      await fetchMessages()
    } catch (error: any) {
      console.error('Failed to send message:', error)
      showToast.error(error.response?.data?.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleReleaseMilestone = async (milestoneId: string) => {
    const amount = releaseAmount[milestoneId]
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      showToast.error('Please enter a valid amount')
      return
    }

    try {
      setReleasingMilestone(milestoneId)
      await adminApi.releaseMilestone(milestoneId, parseFloat(amount))
      showToast.success('Milestone released successfully')
      setReleaseAmount({ ...releaseAmount, [milestoneId]: '' })
      await fetchMilestones()
      if (socketRef.current) {
        socketRef.current.emit('milestone_updated', { conversationId: id })
      }
    } catch (error: any) {
      console.error('Failed to release milestone:', error)
      showToast.error(error.response?.data?.message || 'Failed to release milestone')
    } finally {
      setReleasingMilestone(null)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const getUserName = (user?: { firstName?: string; lastName?: string; userName?: string; email?: string }) => {
    if (!user) return 'Unknown'
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim()
    }
    return user.userName || user.email || 'Unknown'
  }

  const disputedMilestones = milestones.filter((m) => m.status === 'dispute')

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-white">
          <FontAwesomeIcon icon={faSpinner} spin className="text-4xl" />
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-white">Conversation not found</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="glass-card p-6 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/disputes')}
            className="text-white hover:text-primary transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-xl" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Chat</h1>
            <p className="text-slate-300">
              {getUserName(conversation.client)} ↔ {getUserName(conversation.provider)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="glass-card p-4 mb-4" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
            <div className="flex-1 overflow-y-auto mb-4 space-y-4">
              {messages.map((message) => {
                const isClient = message.senderId === conversation.clientId
                const isProvider = message.senderId === conversation.providerId
                const isAdmin = !isClient && !isProvider
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${isClient ? 'justify-start' : isProvider ? 'justify-end' : 'justify-center'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        isClient
                          ? 'bg-primary/20 text-white'
                          : isProvider
                          ? 'bg-white/10 text-white'
                          : 'bg-yellow-600/20 text-white border border-yellow-500/30'
                      }`}
                    >
                      <div className="text-xs text-slate-300 mb-1">
                        {isAdmin ? '👤 Admin' : getUserName(message.sender)}
                      </div>
                      <div className="whitespace-pre-wrap">{message.message}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sending}
                className="bg-primary hover:bg-primary/80 text-white px-6 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sending ? (
                  <FontAwesomeIcon icon={faSpinner} spin />
                ) : (
                  <FontAwesomeIcon icon={faPaperPlane} />
                )}
                Send
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="glass-card p-4">
            <h2 className="text-xl font-bold text-white mb-4">Disputed Milestones</h2>
            {disputedMilestones.length === 0 ? (
              <p className="text-slate-300">No disputed milestones</p>
            ) : (
              <div className="space-y-4">
                {disputedMilestones.map((milestone) => (
                  <div key={milestone.id} className="bg-black/20 p-4 rounded-lg border border-white/10">
                    <h3 className="text-white font-semibold mb-2">{milestone.title}</h3>
                    <p className="text-slate-300 text-sm mb-2">{milestone.description}</p>
                    <div className="text-slate-300 text-sm mb-3">
                      Original Amount: {Number(milestone.balance).toFixed(2)} USD
                    </div>
                    <div className="space-y-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={releaseAmount[milestone.id] || ''}
                        onChange={(e) =>
                          setReleaseAmount({ ...releaseAmount, [milestone.id]: e.target.value })
                        }
                        placeholder="Enter release amount"
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => handleReleaseMilestone(milestone.id)}
                        disabled={releasingMilestone === milestone.id}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {releasingMilestone === milestone.id ? (
                          <>
                            <FontAwesomeIcon icon={faSpinner} spin />
                            Releasing...
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faCheckCircle} />
                            Release Milestone
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Chat

