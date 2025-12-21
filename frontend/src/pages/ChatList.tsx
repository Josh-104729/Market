import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faComments, faSpinner, faSearch } from '@fortawesome/free-solid-svg-icons'
import { conversationApi, messageApi, Conversation, Message } from '../services/api'
import { useAppSelector } from '../store/hooks'
import { getSocket } from '../services/socket'
import { Socket } from 'socket.io-client'
import Chat from './Chat'

interface ConversationWithLastMessage extends Conversation {
  lastMessage?: Message
  unreadCount?: number
  otherUser?: {
    id: string
    firstName?: string
    lastName?: string
    userName?: string
  }
}

function ChatList() {
  const navigate = useNavigate()
  const { id: selectedConversationId } = useParams<{ id?: string }>()
  const { user } = useAppSelector((state) => state.auth)
  const [conversations, setConversations] = useState<ConversationWithLastMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    fetchConversations()
    setupSocket()
  }, [])

  const setupSocket = () => {
    const socket = getSocket()
    if (!socket) return

    socketRef.current = socket

    const handleNewMessage = (message: Message) => {
      // Update the conversation list when a new message arrives
      setConversations((prev) => {
        const updated = [...prev]
        const index = updated.findIndex((conv) => conv.id === message.conversationId)
        
        if (index !== -1) {
          // Move conversation to top and update last message
          const conv = updated[index]
          updated.splice(index, 1)
          updated.unshift({
            ...conv,
            lastMessage: message,
            updatedAt: message.createdAt,
          })
        }
        
        return updated
      })
    }

    socket.on('new_message', handleNewMessage)

    return () => {
      if (socketRef.current) {
        socketRef.current.off('new_message', handleNewMessage)
      }
    }
  }

  const fetchConversations = async () => {
    try {
      setLoading(true)
      const allConversations = await conversationApi.getAll()
      
      // Fetch last message for each conversation
      const conversationsWithMessages = await Promise.all(
        allConversations.map(async (conv) => {
          // Get the other user (not the current user)
          const otherUser = 
            conv.clientId === user?.id ? conv.provider : conv.client
          
          // Fetch last message for this conversation
          let lastMessage: Message | undefined = undefined
          try {
            const messagesData = await messageApi.getByConversation(conv.id, 1)
            if (messagesData.messages && messagesData.messages.length > 0) {
              lastMessage = messagesData.messages[messagesData.messages.length - 1]
            }
          } catch (error) {
            console.error(`Failed to fetch last message for conversation ${conv.id}:`, error)
          }

          return {
            ...conv,
            lastMessage,
            otherUser: otherUser ? {
              id: otherUser.id,
              firstName: otherUser.firstName,
              lastName: otherUser.lastName,
              userName: otherUser.userName,
            } : undefined,
          }
        })
      )

      // Sort by updatedAt (most recent first)
      conversationsWithMessages.sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime()
        const dateB = new Date(b.updatedAt).getTime()
        return dateB - dateA
      })

      setConversations(conversationsWithMessages)
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const getOtherUserName = (conversation: ConversationWithLastMessage): string => {
    if (conversation.otherUser) {
      const { firstName, lastName, userName } = conversation.otherUser
      if (firstName || lastName) {
        return `${firstName || ''} ${lastName || ''}`.trim()
      }
      return userName || 'Unknown User'
    }
    return 'Unknown User'
  }

  const formatMessagePreview = (message?: Message): string => {
    if (!message) return 'No messages yet'
    if (message.message.length > 50) {
      return message.message.substring(0, 50) + '...'
    }
    return message.message
  }

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    const userName = getOtherUserName(conv).toLowerCase()
    const serviceTitle = conv.service?.title?.toLowerCase() || ''
    const lastMessageText = conv.lastMessage?.message?.toLowerCase() || ''
    
    return (
      userName.includes(searchLower) ||
      serviceTitle.includes(searchLower) ||
      lastMessageText.includes(searchLower)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <FontAwesomeIcon icon={faSpinner} className="text-primary text-4xl animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1800px] h-[calc(100vh-8rem)]">
      <div className="backdrop-blur-xl bg-[rgba(2,4,8,0.7)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden h-full flex">
        {/* Left Sidebar - Users List */}
        <div className="w-full md:w-80 lg:w-96 border-r border-white/10 flex flex-col flex-shrink-0">
          {/* Header */}
          <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <FontAwesomeIcon icon={faComments} className="text-primary" />
                Messages
              </h1>
            </div>
            
            {/* Search Bar */}
            <div className="relative">
              <FontAwesomeIcon 
                icon={faSearch} 
                className="absolute left-3 top-1/2 transform -tranneutral-y-1/2 text-neutral-400 text-sm"
              />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:border-primary/50 transition-colors text-sm"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <FontAwesomeIcon icon={faComments} className="text-neutral-500 text-4xl mb-3" />
                <p className="text-neutral-400 text-sm mb-1">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </p>
                <p className="text-neutral-500 text-xs">
                  {searchQuery 
                    ? 'Try a different search term' 
                    : 'Start a conversation by connecting with a service provider'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredConversations.map((conversation) => {
                  const otherUserName = getOtherUserName(conversation)
                  const isUnread = conversation.unreadCount && conversation.unreadCount > 0
                  const isSelected = conversation.id === selectedConversationId

                  return (
                    <div
                      key={conversation.id}
                      onClick={() => navigate(`/chat/${conversation.id}`)}
                      className={`px-4 py-3 cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-primary/20 border-l-2 border-primary' 
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm">
                          {otherUserName[0]?.toUpperCase() || 'U'}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className={`font-semibold truncate text-sm ${isUnread || isSelected ? 'text-white' : 'text-neutral-300'}`}>
                              {otherUserName}
                            </h3>
                            {conversation.lastMessage && (
                              <span className="text-xs text-neutral-500 flex-shrink-0 ml-2">
                                {formatTime(conversation.lastMessage.createdAt)}
                              </span>
                            )}
                          </div>
                          
                          {conversation.service && (
                            <p className="text-xs text-neutral-500 mb-1 truncate">
                              {conversation.service.title}
                            </p>
                          )}
                          
                          <p className={`text-xs truncate ${isUnread || isSelected ? 'text-white font-medium' : 'text-neutral-400'}`}>
                            {formatMessagePreview(conversation.lastMessage)}
                          </p>
                        </div>

                        {/* Unread Badge */}
                        {isUnread && (
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2"></div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Chat Interface */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedConversationId ? (
            <Chat />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-6">
                <FontAwesomeIcon icon={faComments} className="text-neutral-500 text-6xl mb-4" />
                <p className="text-neutral-400 text-lg mb-2">Select a conversation</p>
                <p className="text-neutral-500 text-sm">
                  Choose a conversation from the list to start chatting
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatList

