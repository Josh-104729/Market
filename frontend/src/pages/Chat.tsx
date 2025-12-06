import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faSpinner,
  faPaperPlane,
  faUser,
  faPlus,
  faCheck,
  faCheckDouble,
  faTimes,
  faBan,
  faCheckCircle,
  faMoneyBillWave,
  faGavel,
  faEllipsisV,
  faSmile,
  faPaperclip,
} from '@fortawesome/free-solid-svg-icons'
import { conversationApi, messageApi, milestoneApi, walletApi, Conversation, Message, Milestone } from '../services/api'
import { useAppSelector } from '../store/hooks'
import { getSocket, disconnectSocket } from '../services/socket'
import { Socket } from 'socket.io-client'
import { transferUSDT } from '../utils/tronWeb'
import { showToast } from '../utils/toast'

function Chat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAppSelector((state) => state.auth)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [milestoneForm, setMilestoneForm] = useState({
    title: '',
    description: '',
    balance: '',
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [updatingMilestone, setUpdatingMilestone] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const typingTimeoutRef = useRef<number | null>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const markReadTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (id) {
      fetchConversation()
      fetchMessages()
      fetchMilestones()
    }
  }, [id])

  // Set up WebSocket connection
  useEffect(() => {
    if (!id) return

    const socket = getSocket()
    if (!socket) {
      console.warn('Socket not available, skipping WebSocket setup')
      return
    }

    socketRef.current = socket

    // Wait for connection before joining room
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

    // Listen for new messages
    const handleNewMessage = (message: Message) => {
      setMessages((prev) => {
        // Check if message already exists
        if (prev.some((m) => m.id === message.id)) {
          return prev
        }
        return [...prev, message]
      })
    }

    // Listen for milestone updates
    const handleMilestoneUpdate = () => {
      fetchMilestones()
    }

    // Listen for typing indicators
    const handleTyping = (data: { userId: string; userName: string }) => {
      if (data.userId !== user?.id) {
        setTypingUsers((prev) => new Set(prev).add(data.userId))
        // Clear typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => {
            const newSet = new Set(prev)
            newSet.delete(data.userId)
            return newSet
          })
        }, 3000)
      }
    }

    const handleStopTyping = (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev)
        newSet.delete(data.userId)
        return newSet
      })
    }

    // Listen for read receipts
    const handleMessagesRead = (data: { 
      conversationId: string; 
      readBy: string; 
      messages?: Message[];
      messageIds?: string[];
    }) => {
      if (data.conversationId === id) {
        // Update messages to show they're read
        setMessages((prev) =>
          prev.map((msg) => {
            // If this message was read (it's in the messageIds array or in the messages array)
            const wasRead = 
              (data.messageIds && data.messageIds.includes(msg.id)) ||
              (data.messages && data.messages.some((m) => m.id === msg.id));
            
            // Only update if the current user sent this message and it was just read
            if (wasRead && msg.senderId === user?.id && !msg.readAt) {
              // Use the readAt from the updated message if available, otherwise use current time
              const updatedMessage = data.messages?.find((m) => m.id === msg.id);
              return {
                ...msg,
                readAt: updatedMessage?.readAt || new Date().toISOString(),
              };
            }
            return msg;
          }),
        );
      }
    }

    socket.on('new_message', handleNewMessage)
    socket.on('milestone_updated', handleMilestoneUpdate)
    socket.on('user_typing', handleTyping)
    socket.on('user_stopped_typing', handleStopTyping)
    socket.on('messages_read', handleMessagesRead)
    socket.on('joined_conversation', () => {
      console.log('Joined conversation room:', id)
      // Mark messages as read when joining
      markMessagesAsRead()
    })
    socket.on('error', (error) => {
      console.error('Socket error:', error)
    })

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.off('new_message', handleNewMessage)
        socket.off('milestone_updated', handleMilestoneUpdate)
        socket.off('user_typing', handleTyping)
        socket.off('user_stopped_typing', handleStopTyping)
        socket.off('messages_read', handleMessagesRead)
        socket.off('joined_conversation')
        socket.off('error')
        socket.off('connect_error')
        socket.emit('leave_conversation', { conversationId: id })
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current)
      }
    }
  }, [id, user?.id])

  useEffect(() => {
    scrollToBottom()
    // Mark messages as read when new messages arrive or when viewing
    markMessagesAsRead()
  }, [messages, milestones])

  // Mark messages as read when user is actively viewing (scroll or focus)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && id) {
        markMessagesAsRead()
      }
    }

    const handleFocus = () => {
      if (id) {
        markMessagesAsRead()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [id, user, messages]) // Include messages to ensure function has latest state

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`
    }
  }, [messageText])

  // Prevent body scroll when chat is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmojiPicker])

  // Mark messages as read
  const markMessagesAsRead = () => {
    if (!socketRef.current || !id || !user) return

    // Clear previous timeout
    if (markReadTimeoutRef.current) {
      clearTimeout(markReadTimeoutRef.current)
    }

    // Mark as read after a short delay (when user is viewing)
    markReadTimeoutRef.current = setTimeout(() => {
      const unreadMessageIds = messages
        .filter((msg) => msg.senderId !== user.id && !msg.readAt)
        .map((msg) => msg.id)

      if (unreadMessageIds.length > 0 && socketRef.current?.connected) {
        socketRef.current.emit('mark_messages_read', {
          conversationId: id,
          messageIds: unreadMessageIds,
        })
      }
    }, 500) // Reduced delay for faster real-time updates
  }

  // Handle typing indicator
  const handleTyping = () => {
    if (!socketRef.current || !id || !user) return

    // Emit typing event
    socketRef.current.emit('typing', { conversationId: id })

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Stop typing indicator after 1 second of no typing
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('stop_typing', { conversationId: id })
    }, 1000)
  }

  // Emoji list
  const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
    '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
    '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
    '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶',
    '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴',
    '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀',
    '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
  ]

  const insertEmoji = (emoji: string) => {
    setMessageText((prev) => prev + emoji)
    setShowEmojiPicker(false)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchConversation = async () => {
    try {
      const data = await conversationApi.getById(id!)
      setConversation(data)
    } catch (error) {
      console.error('Failed to fetch conversation:', error)
      showToast.error('Failed to load conversation')
      navigate('/services')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    try {
      const data = await messageApi.getByConversation(id!)
      setMessages(data)
    } catch (error) {
      console.error('Failed to fetch messages:', error)
      showToast.error('Failed to load messages')
    }
  }

  const fetchMilestones = async () => {
    try {
      const data = await milestoneApi.getByConversation(id!)
      setMilestones(data)
    } catch (error) {
      console.error('Failed to fetch milestones:', error)
      showToast.error('Failed to load milestones')
    }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() || !id) return

    try {
      setSending(true)
      
      // Try WebSocket first, fallback to HTTP API
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('send_message', {
          conversationId: id,
          message: messageText.trim(),
        })
        setMessageText('')
        // Message will be added via WebSocket 'new_message' event
        setTimeout(() => {
          fetchMessages()
        }, 500)
      } else {
        // Fallback to HTTP API if WebSocket not available
        await messageApi.create(id, messageText.trim())
        setMessageText('')
        await fetchMessages()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      showToast.error('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleCreateMilestone = async () => {
    if (!conversation || !milestoneForm.title || !milestoneForm.description || !milestoneForm.balance) return

    try {
      // Check if wallet is connected
      const wallet = await walletApi.getMyWallet()
      if (!wallet || !wallet.walletAddress) {
        showToast.error('Please connect your wallet before creating a milestone')
        return
      }

      const amount = parseFloat(milestoneForm.balance)
      
      // Create milestone (this will create temp wallet and payment transaction)
      const milestone = await milestoneApi.create(id!, {
        serviceId: conversation.serviceId,
        title: milestoneForm.title,
        description: milestoneForm.description,
        balance: amount,
      })

      // Get the payment transaction
      const transactions = await walletApi.getMilestoneTransactions(milestone.id)
      const paymentTransaction = transactions.find(tx => tx.type === 'payment' && tx.status === 'pending')
      
      if (!paymentTransaction) {
        throw new Error('Payment transaction not found')
      }

      // Transfer USDT from user wallet to temp wallet
      showToast.info('Please confirm the transaction in your wallet...')
      const txHash = await transferUSDT(paymentTransaction.toWalletAddress, amount)
      
      // Update transaction with hash
      await walletApi.updateTransactionHash(paymentTransaction.id, txHash)
      
      showToast.success('Milestone created and payment processed successfully!')
      
      setMilestoneForm({ title: '', description: '', balance: '' })
      setShowMilestoneForm(false)
      await fetchMilestones()
      await fetchMessages()
      // Emit milestone update via WebSocket
      if (socketRef.current) {
        socketRef.current.emit('milestone_updated', { conversationId: id })
      }
    } catch (error: any) {
      console.error('Failed to create milestone:', error)
      showToast.error(error.message || 'Failed to create milestone. Please try again.')
    }
  }

  const handleMilestoneAction = async (milestoneId: string, action: string) => {
    try {
      setUpdatingMilestone(milestoneId)
      switch (action) {
        case 'accept':
          await milestoneApi.accept(milestoneId)
          break
        case 'cancel':
          await milestoneApi.cancel(milestoneId)
          break
        case 'complete':
          await milestoneApi.complete(milestoneId)
          break
        case 'withdraw':
          await milestoneApi.withdraw(milestoneId)
          break
        case 'release':
          await milestoneApi.release(milestoneId)
          break
        case 'dispute':
          await milestoneApi.dispute(milestoneId)
          break
      }
      await fetchMilestones()
      await fetchMessages()
      // Emit milestone update via WebSocket
      if (socketRef.current) {
        socketRef.current.emit('milestone_updated', { conversationId: id })
      }
    } catch (error) {
      console.error(`Failed to ${action} milestone:`, error)
      alert(`Failed to ${action} milestone. Please try again.`)
    } finally {
      setUpdatingMilestone(null)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-[#708499]',
      processing: 'bg-[#2b5278]',
      canceled: 'bg-[#5c2b2b]',
      completed: 'bg-[#2b5c2b]',
      withdraw: 'bg-[#5c4b2b]',
      released: 'bg-[#4b2b5c]',
      dispute: 'bg-[#5c4b2b]',
    }
    return colors[status] || 'bg-[#708499]'
  }

  const getOtherUser = () => {
    if (!conversation || !user) return null
    return conversation.clientId === user.id ? conversation.provider : conversation.client
  }

  // Group messages by sender and time (Telegram style)
  const groupedMessages = useMemo(() => {
    if (messages.length === 0) return []
    
    const grouped: Array<{
      senderId: string
      sender: Message['sender']
      messages: Message[]
      timestamp: Date
    }> = []
    
    messages.forEach((message) => {
      const lastGroup = grouped[grouped.length - 1]
      const messageTime = new Date(message.createdAt)
      
      // Group if same sender and within 5 minutes
      if (
        lastGroup &&
        lastGroup.senderId === message.senderId &&
        messageTime.getTime() - lastGroup.timestamp.getTime() < 5 * 60 * 1000
      ) {
        lastGroup.messages.push(message)
      } else {
        grouped.push({
          senderId: message.senderId,
          sender: message.sender,
          messages: [message],
          timestamp: messageTime,
        })
      }
    })
    
    return grouped
  }, [messages])

  // Format time for display
  const formatTime = (date: Date) => {
    const now = new Date()
    const messageDate = new Date(date)
    const diff = now.getTime() - messageDate.getTime()
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return messageDate.toLocaleDateString([], { weekday: 'short' })
    } else {
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  // Check if should show date separator
  const shouldShowDate = (currentDate: Date, previousDate?: Date) => {
    if (!previousDate) return true
    const current = new Date(currentDate).toDateString()
    const previous = new Date(previousDate).toDateString()
    return current !== previous
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e1621] flex items-center justify-center">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-[#6bb2f0] mb-4" />
          <p className="text-[#708499]">Loading conversation...</p>
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-[#0e1621] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#708499] mb-4">Conversation not found</p>
          <button
            onClick={() => navigate('/services')}
            className="px-6 py-3 bg-[#2b5278] text-white rounded-lg font-semibold hover:bg-[#3a6a95] transition-colors"
          >
            Back to Services
          </button>
        </div>
      </div>
    )
  }

  const otherUser = getOtherUser()
  const isClient = conversation.clientId === user?.id

  return (
    <div className="mx-auto fixed inset-0 bg-[#0e1621] flex flex-col pt-16">
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Header - Telegram Style */}
          <div className="bg-[#17212b] border-b border-[#0e1621] px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <button
              onClick={() => navigate('/services')}
              className="text-[#708499] hover:text-[#e4ecf0] transition-colors p-2 -ml-2"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
              {otherUser?.firstName?.[0] || otherUser?.userName?.[0] || <FontAwesomeIcon icon={faUser} />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-[#e4ecf0] truncate">
                {otherUser?.firstName && otherUser?.lastName
                  ? `${otherUser.firstName} ${otherUser.lastName}`
                  : otherUser?.userName || 'User'}
              </h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-[#708499] truncate">{conversation.service?.title}</p>
                {typingUsers.size > 0 && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="flex gap-0.5">
                      <div className="w-1.5 h-1.5 bg-[#6bb2f0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-[#6bb2f0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-[#6bb2f0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-xs text-[#6bb2f0] italic">
                      {Array.from(typingUsers).length === 1 ? 'typing...' : 'typing...'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <button className="text-[#708499] hover:text-[#e4ecf0] transition-colors p-2">
            <FontAwesomeIcon icon={faEllipsisV} />
          </button>
        </div>

          {/* Messages Area - Telegram Style */}
          <div className="flex-1 overflow-y-auto bg-[#0e1621] relative min-h-0">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0e1621] via-[#0e1621] to-[#17212b] opacity-50 pointer-events-none"></div>
          <div className="relative p-4 space-y-1">
            {(() => {
              // Combine messages and milestones, sorted by creation time
              const allItems = [
                ...messages.map((m) => ({ type: 'message' as const, data: m, createdAt: m.createdAt })),
                ...milestones.map((mil) => ({ type: 'milestone' as const, data: mil, createdAt: mil.createdAt })),
              ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

              let previousDate: Date | undefined

              return allItems.map((item, index) => {
                const itemDate = new Date(item.createdAt)
                const showDateSeparator = shouldShowDate(itemDate, previousDate)
                previousDate = itemDate

                if (item.type === 'message') {
                  const message = item.data as Message
                  const isOwn = message.senderId === user?.id
                  const sender = message.sender
                  
                  return (
                    <div key={`msg-${message.id}`}>
                      {showDateSeparator && (
                        <div className="flex justify-center my-4">
                          <div className="bg-[#182533] text-[#708499] text-xs px-3 py-1 rounded-full">
                            {itemDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                        </div>
                      )}
                      <div className={`flex items-end gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar for incoming messages */}
                        {!isOwn && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mb-1">
                            {sender?.firstName?.[0] || sender?.userName?.[0] || <FontAwesomeIcon icon={faUser} className="text-xs" />}
                          </div>
                        )}
                        
                        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[65%] ${isOwn ? 'mr-0' : 'ml-0'}`}>
                          {/* Sender name for incoming messages */}
                          {!isOwn && sender && (
                            <span className="text-[#708499] text-xs px-2 mb-0.5">
                              {sender.firstName && sender.lastName
                                ? `${sender.firstName} ${sender.lastName}`
                                : sender.userName || 'User'}
                            </span>
                          )}
                          
                          {/* Message bubble */}
                          <div
                            className={`relative px-3 py-2 rounded-2xl ${
                              isOwn
                                ? 'bg-[#2b5278] text-white rounded-tr-sm'
                                : 'bg-[#182533] text-[#e4ecf0] rounded-tl-sm'
                            } shadow-sm`}
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.message}</p>
                            
                            {/* Timestamp and Read Status */}
                            <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              <span className={`text-[10px] ${isOwn ? 'text-[#6bb2f0]' : 'text-[#708499]'}`}>
                                {formatTime(new Date(message.createdAt))}
                              </span>
                              {isOwn && (
                                <FontAwesomeIcon
                                  icon={message.readAt ? faCheckDouble : faCheck}
                                  className={`text-[10px] ${message.readAt ? 'text-[#6bb2f0]' : 'text-[#708499]'}`}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                } else {
                  const milestone = item.data as Milestone
                  const isOwn = milestone.clientId === user?.id
                  
                  return (
                    <div key={`mil-${milestone.id}`}>
                      {showDateSeparator && (
                        <div className="flex justify-center my-4">
                          <div className="bg-[#182533] text-[#708499] text-xs px-3 py-1 rounded-full">
                            {itemDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                        </div>
                      )}
                      <div className={`flex items-end gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[65%]`}>
                          <div
                            className={`relative px-4 py-3 rounded-2xl ${
                              isOwn
                                ? 'bg-gradient-to-br from-[#2b5278] to-[#1e3a5f] text-white rounded-tr-sm'
                                : 'bg-gradient-to-br from-[#182533] to-[#1a2b3d] text-[#e4ecf0] rounded-tl-sm'
                            } shadow-lg border border-[#2b5278]/30`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6bb2f0]">Milestone</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor(milestone.status)}`}>
                                {milestone.status}
                              </span>
                            </div>
                            <h4 className="font-semibold mb-1.5 text-base">{milestone.title}</h4>
                            <p className="text-sm mb-3 opacity-90 leading-relaxed">{milestone.description}</p>
                            <div className="flex items-center justify-between pt-2 border-t border-white/10">
                              <span className="text-lg font-bold text-[#6bb2f0]">${Number(milestone.balance).toFixed(2)}</span>
                              <span className={`text-[10px] ${isOwn ? 'text-[#6bb2f0]' : 'text-[#708499]'}`}>
                                {formatTime(new Date(milestone.createdAt))}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }
              })
            })()}
            <div ref={messagesEndRef} />
          </div>
        </div>

          {/* Input Area - Telegram Style */}
          <div className="bg-[#17212b] border-t border-[#0e1621] px-4 py-3 flex-shrink-0">
          <div className="flex items-end gap-2">
            <button className="text-[#708499] hover:text-[#e4ecf0] transition-colors p-2 flex-shrink-0">
              <FontAwesomeIcon icon={faPaperclip} />
            </button>
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value)
                  handleTyping()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  } else {
                    handleTyping()
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                className="w-full bg-[#242f3d] text-[#e4ecf0] rounded-2xl px-4 py-2.5 pr-12 focus:outline-none focus:ring-2 focus:ring-[#2b5278] resize-none max-h-32 overflow-y-auto placeholder-[#708499] text-sm leading-5"
                style={{ minHeight: '42px', maxHeight: '128px' }}
              />
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="text-[#708499] hover:text-[#e4ecf0] transition-colors p-2 absolute right-1 bottom-1"
                >
                  <FontAwesomeIcon icon={faSmile} />
                </button>
                {showEmojiPicker && (
                  <div
                    ref={emojiPickerRef}
                    className="absolute bottom-12 right-0 bg-[#17212b] border border-[#0e1621] rounded-lg shadow-2xl p-3 w-64 h-64 overflow-y-auto z-50"
                  >
                    <div className="grid grid-cols-8 gap-1">
                      {emojis.map((emoji, index) => (
                        <button
                          key={index}
                          onClick={() => insertEmoji(emoji)}
                          className="text-2xl hover:bg-[#242f3d] rounded p-1 transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sending}
              className={`p-2.5 rounded-full flex-shrink-0 transition-all ${
                messageText.trim()
                  ? 'bg-[#2b5278] text-white hover:bg-[#3a6a95]'
                  : 'bg-[#242f3d] text-[#708499] cursor-not-allowed'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {sending ? (
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              ) : (
                <FontAwesomeIcon icon={faPaperPlane} />
              )}
            </button>
          </div>
          </div>
        </div>

        {/* Milestones Sidebar - Telegram Style */}
        <div className="w-80 bg-[#17212b] border-l border-[#0e1621] flex flex-col flex-shrink-0 min-h-0">
          <div className="p-4 border-b border-[#0e1621] flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#e4ecf0]">Milestones</h3>
            {isClient && (
              <button
                onClick={() => setShowMilestoneForm(!showMilestoneForm)}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
            )}
          </div>
          {showMilestoneForm && isClient && (
            <div className="bg-[#242f3d] rounded-lg p-4 space-y-3 mb-4 border border-[#0e1621]">
              <input
                type="text"
                placeholder="Title"
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                className="w-full bg-[#0e1621] text-[#e4ecf0] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2b5278] placeholder-[#708499] text-sm"
              />
              <textarea
                placeholder="Description"
                value={milestoneForm.description}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                className="w-full bg-[#0e1621] text-[#e4ecf0] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2b5278] placeholder-[#708499] text-sm resize-none"
                rows={3}
              />
              <input
                type="number"
                placeholder="Balance"
                value={milestoneForm.balance}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, balance: e.target.value })}
                className="w-full bg-[#0e1621] text-[#e4ecf0] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2b5278] placeholder-[#708499] text-sm"
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleCreateMilestone}
                  className="flex-1 bg-[#2b5278] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#3a6a95] transition-colors text-sm"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowMilestoneForm(false)
                    setMilestoneForm({ title: '', description: '', balance: '' })
                  }}
                  className="flex-1 bg-[#242f3d] text-[#e4ecf0] px-4 py-2 rounded-lg font-semibold hover:bg-[#2a3a4d] transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {milestones.length === 0 ? (
            <p className="text-[#708499] text-center text-sm py-8">No milestones yet</p>
          ) : (
            milestones.map((milestone) => (
              <div key={milestone.id} className="bg-[#242f3d] rounded-lg p-4 space-y-3 border border-[#0e1621] hover:border-[#2b5278]/50 transition-colors">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-[#e4ecf0] text-sm">{milestone.title}</h4>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-semibold text-white ${getStatusColor(milestone.status)}`}>
                    {milestone.status}
                  </span>
                </div>
                <p className="text-sm text-[#708499] leading-relaxed">{milestone.description}</p>
                <div className="flex items-center justify-between pt-2 border-t border-[#0e1621]">
                  <span className="text-base font-bold text-[#6bb2f0]">${Number(milestone.balance).toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {milestone.status === 'draft' && (
                    <>
                      {!isClient && (
                        <button
                          onClick={() => handleMilestoneAction(milestone.id, 'accept')}
                          disabled={updatingMilestone === milestone.id}
                          className="flex-1 bg-[#2b5278] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#3a6a95] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <FontAwesomeIcon icon={faCheck} className="text-xs" />
                          Accept
                        </button>
                      )}
                      {isClient && (
                        <button
                          onClick={() => handleMilestoneAction(milestone.id, 'cancel')}
                          disabled={updatingMilestone === milestone.id}
                          className="flex-1 bg-[#5c2b2b] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#6b3a3a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <FontAwesomeIcon icon={faTimes} className="text-xs" />
                          Cancel
                        </button>
                      )}
                    </>
                  )}
                  {milestone.status === 'processing' && (
                    <>
                      {!isClient && (
                        <>
                          <button
                            onClick={() => handleMilestoneAction(milestone.id, 'complete')}
                            disabled={updatingMilestone === milestone.id}
                            className="flex-1 bg-[#2b5278] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#3a6a95] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            <FontAwesomeIcon icon={faCheckCircle} className="text-xs" />
                            Complete
                          </button>
                          <button
                            onClick={() => handleMilestoneAction(milestone.id, 'withdraw')}
                            disabled={updatingMilestone === milestone.id}
                            className="flex-1 bg-[#5c4b2b] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#6b5a3a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            <FontAwesomeIcon icon={faMoneyBillWave} className="text-xs" />
                            Withdraw
                          </button>
                        </>
                      )}
                      {isClient && (
                        <button
                          onClick={() => handleMilestoneAction(milestone.id, 'cancel')}
                          disabled={updatingMilestone === milestone.id}
                          className="flex-1 bg-[#5c2b2b] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#6b3a3a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <FontAwesomeIcon icon={faBan} className="text-xs" />
                          Cancel
                        </button>
                      )}
                    </>
                  )}
                  {milestone.status === 'completed' && (
                    <>
                      {isClient && (
                        <>
                          <button
                            onClick={() => handleMilestoneAction(milestone.id, 'release')}
                            disabled={updatingMilestone === milestone.id}
                            className="flex-1 bg-[#4b2b5c] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#5a3a6b] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            <FontAwesomeIcon icon={faCheckCircle} className="text-xs" />
                            Release
                          </button>
                          <button
                            onClick={() => handleMilestoneAction(milestone.id, 'dispute')}
                            disabled={updatingMilestone === milestone.id}
                            className="flex-1 bg-[#5c4b2b] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#6b5a3a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            <FontAwesomeIcon icon={faGavel} className="text-xs" />
                            Dispute
                          </button>
                        </>
                      )}
                      {!isClient && (
                        <button
                          onClick={() => handleMilestoneAction(milestone.id, 'dispute')}
                          disabled={updatingMilestone === milestone.id}
                          className="flex-1 bg-[#5c4b2b] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#6b5a3a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <FontAwesomeIcon icon={faGavel} className="text-xs" />
                          Dispute
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Chat

