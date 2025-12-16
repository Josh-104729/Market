import { useEffect, useState, useRef } from 'react'
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
  faCheckCircle,
  faMoneyBillWave,
  faGavel,
  faEllipsisV,
  faSmile,
  faPaperclip,
  faStar,
  faDownload,
  faFile,
  faImage,
  faFilePdf,
  faFileWord,
  faFileExcel,
  faFileArchive,
} from '@fortawesome/free-solid-svg-icons'
import { conversationApi, messageApi, milestoneApi, paymentApi, Conversation, Message, Milestone, Transaction } from '../services/api'
import { useAppSelector } from '../store/hooks'
import { getSocket } from '../services/socket'
import { Socket } from 'socket.io-client'
import { showToast } from '../utils/toast'

function Chat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAppSelector((state) => state.auth)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [pendingPayments, setPendingPayments] = useState<Map<string, Transaction>>(new Map())
  const [successfulPayments, setSuccessfulPayments] = useState<Map<string, Transaction>>(new Map())
  const [acceptingPayment, setAcceptingPayment] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [milestoneForm, setMilestoneForm] = useState({
    title: '',
    description: '',
    balance: '',
  })
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [releaseForm, setReleaseForm] = useState({
    milestoneId: '',
    feedback: '',
    rating: 0,
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesAreaRef = useRef<HTMLDivElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (id) {
      fetchConversation()
      fetchMessages(50) // Load latest 50 messages
      fetchMilestones()
      setHasMoreMessages(true) // Reset hasMore when conversation changes
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

    // Listen for payment pending events
    const handlePaymentPending = (data: { transaction: Transaction; milestoneId: string; conversationId: string }) => {
      if (data.conversationId === id) {
        // Add to pending payments
        setPendingPayments((prev) => {
          const newMap = new Map(prev)
          newMap.set(data.milestoneId, data.transaction)
          return newMap
        })
        
        // Remove from successful payments if it was there
        setSuccessfulPayments((prev) => {
          const newMap = new Map(prev)
          newMap.delete(data.milestoneId)
          return newMap
        })
        
        // Refresh milestones
        fetchMilestones()
        
        // Scroll to show the payment card
        setTimeout(() => {
          scrollToBottom()
        }, 300)
      }
    }

    // Listen for payment accepted events
    const handlePaymentAccepted = (data: { transaction: Transaction; milestoneId: string; conversationId: string }) => {
      if (data.conversationId === id) {
        // Remove from pending payments
        setPendingPayments((prev) => {
          const newMap = new Map(prev)
          newMap.delete(data.milestoneId)
          return newMap
        })
        
        // Add to successful payments
        setSuccessfulPayments((prev) => {
          const newMap = new Map(prev)
          newMap.set(data.milestoneId, data.transaction)
          return newMap
        })
        
        // Refresh milestones and messages
        fetchMilestones()
        fetchMessages(50)
        
        // Scroll to show the success card
        setTimeout(() => {
          scrollToBottom()
        }, 300)
        
        // Notify Layout to refresh balance
        window.dispatchEvent(new CustomEvent('balance-updated'))
      }
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
    socket.on('payment_pending', handlePaymentPending)
    socket.on('payment_accepted', handlePaymentAccepted)
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
        socket.off('payment_pending', handlePaymentPending)
        socket.off('payment_accepted', handlePaymentAccepted)
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
    // Only auto-scroll if we're not loading older messages and user is near bottom
    if (!loadingMoreMessages) {
      scrollToBottom()
    }
    // Mark messages as read when new messages arrive or when viewing
    markMessagesAsRead()
  }, [messages, milestones, pendingPayments, successfulPayments])

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

  // File handling functions
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    // Limit to 10 files and 50MB per file
    const validFiles = fileArray.filter((file) => {
      if (file.size > 50 * 1024 * 1024) {
        showToast.error(`File ${file.name} is too large. Maximum size is 50MB.`)
        return false
      }
      return true
    }).slice(0, 10 - selectedFiles.length)

    if (validFiles.length < fileArray.length) {
      showToast.error(`Only ${validFiles.length} file(s) added. Maximum 10 files allowed.`)
    }

    setSelectedFiles((prev) => [...prev, ...validFiles])
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files)
    }
  }

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) {
      return faImage
    } else if (extension === 'pdf') {
      return faFilePdf
    } else if (['doc', 'docx'].includes(extension || '')) {
      return faFileWord
    } else if (['xls', 'xlsx'].includes(extension || '')) {
      return faFileExcel
    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension || '')) {
      return faFileArchive
    }
    return faFile
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleDownloadFile = (url: string, fileName: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePreviewFile = (url: string, fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)
    const isPdf = extension === 'pdf'
    const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(extension)
    const isAudio = ['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(extension)
    
    setPreviewFile({
      url,
      name: fileName,
      type: isImage ? 'image' : isPdf ? 'pdf' : isVideo ? 'video' : isAudio ? 'audio' : 'other',
    })
  }

  const closePreview = () => {
    setPreviewFile(null)
  }

  const scrollToBottom = () => {
    if (messagesEndRef.current && messagesAreaRef.current) {
      const container = messagesAreaRef.current
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      // Only auto-scroll if user is near bottom
      if (isNearBottom || messages.length <= 50) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }
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

  const fetchMessages = async (limit: number = 50, before?: string) => {
    try {
      const data = await messageApi.getByConversation(id!, limit, before)
      if (before) {
        // Loading older messages - prepend to existing messages and preserve scroll position
        const container = messagesAreaRef.current
        const previousScrollHeight = container?.scrollHeight || 0
        setMessages((prev) => [...data.messages, ...prev])
        setHasMoreMessages(data.hasMore)
        // Restore scroll position after new messages are rendered
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight
            container.scrollTop = newScrollHeight - previousScrollHeight
          }
        }, 0)
      } else {
        // Initial load or refresh - replace messages
        setMessages(data.messages)
        setHasMoreMessages(data.hasMore)
        // Scroll to bottom after initial load
        setTimeout(() => {
          scrollToBottom()
        }, 100)
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
      showToast.error('Failed to load messages')
    }
  }

  const loadMoreMessages = async () => {
    if (loadingMoreMessages || !hasMoreMessages || messages.length === 0) return

    try {
      setLoadingMoreMessages(true)
      const oldestMessage = messages[0]
      await fetchMessages(50, oldestMessage.id)
    } catch (error) {
      console.error('Failed to load more messages:', error)
      showToast.error('Failed to load more messages')
    } finally {
      setLoadingMoreMessages(false)
    }
  }

  const fetchMilestones = async () => {
    if (!id || !user) return
    try {
      const data = await milestoneApi.getByConversation(id!)
      setMilestones(data)
      
      // Fetch pending and successful payments for each milestone (for both clients and providers)
      const pendingPaymentsMap = new Map<string, Transaction>()
      const successfulPaymentsMap = new Map<string, Transaction>()
      
      for (const milestone of data) {
        if (milestone.status === 'completed' || milestone.status === 'released') {
          try {
            // Check for pending payment
            const pendingPayment = await paymentApi.getPendingPaymentByMilestone(milestone.id)
            if (pendingPayment) {
              pendingPaymentsMap.set(milestone.id, pendingPayment)
            }
            
            // Check for successful payment
            const successfulPayment = await paymentApi.getSuccessfulPaymentByMilestone(milestone.id)
            if (successfulPayment) {
              successfulPaymentsMap.set(milestone.id, successfulPayment)
            }
          } catch (error) {
            // No payment for this milestone
          }
        }
      }
      setPendingPayments(pendingPaymentsMap)
      setSuccessfulPayments(successfulPaymentsMap)
    } catch (error) {
      console.error('Failed to fetch milestones:', error)
      showToast.error('Failed to load milestones')
    }
  }

  const handleSendMessage = async () => {
    if ((!messageText.trim() && selectedFiles.length === 0) || !id) return

    try {
      setSending(true)
      setUploadingFiles(true)

      let attachmentFiles: string[] = []

      // Upload files if any
      if (selectedFiles.length > 0) {
        try {
          const uploadResult = await messageApi.uploadFiles(selectedFiles)
          attachmentFiles = uploadResult.urls
        } catch (error: any) {
          console.error('Failed to upload files:', error)
          showToast.error(error.response?.data?.message || 'Failed to upload files. Please try again.')
          setSending(false)
          setUploadingFiles(false)
          return
        }
      }

      // Send message with attachments
      const messageContent = messageText.trim() || (attachmentFiles.length > 0 ? '📎 Sent file(s)' : '')

      // Try WebSocket first, fallback to HTTP API
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('send_message', {
          conversationId: id,
          message: messageContent,
          attachmentFiles: attachmentFiles.length > 0 ? attachmentFiles : undefined,
        })
        setMessageText('')
        setSelectedFiles([])
        // Message will be added via WebSocket 'new_message' event
        // Don't refetch all messages, just let WebSocket handle it
      } else {
        // Fallback to HTTP API if WebSocket not available
        await messageApi.create(id, messageContent, attachmentFiles.length > 0 ? attachmentFiles : undefined)
        setMessageText('')
        setSelectedFiles([])
        // Refresh messages to get the new one
        const data = await messageApi.getByConversation(id!, 50)
        setMessages(data.messages)
        setHasMoreMessages(data.hasMore)
      }
    } catch (error: any) {
      console.error('Failed to send message:', error)
      showToast.error(error.response?.data?.message || 'Failed to send message. Please try again.')
    } finally {
      setSending(false)
      setUploadingFiles(false)
    }
  }

  const handleCreateMilestone = async () => {
    if (!conversation || !milestoneForm.title || !milestoneForm.description || !milestoneForm.balance) return

    try {
      const amount = parseFloat(milestoneForm.balance)

      // Create milestone
      await milestoneApi.create(id!, {
        serviceId: conversation.serviceId,
        title: milestoneForm.title,
        description: milestoneForm.description,
        balance: amount,
      })

      showToast.success('Milestone created successfully!')

      setMilestoneForm({ title: '', description: '', balance: '' })
      setShowMilestoneForm(false)
      await fetchMilestones()
      await fetchMessages(50)
      
      // Emit milestone update via WebSocket
      if (socketRef.current) {
        socketRef.current.emit('milestone_updated', { conversationId: id })
      }
      
      // Notify Layout to refresh balance (client's balance decreased)
      window.dispatchEvent(new CustomEvent('balance-updated'))
    } catch (error: any) {
      console.error('Failed to create milestone:', error)
      showToast.error(error.message || 'Failed to create milestone. Please try again.')
    }
  }

  const handleMilestoneAction = async (milestoneId: string, action: string) => {
    try {
      setUpdatingMilestone(milestoneId)
      
      // Check if milestone is already released and trying to release again
      const milestone = milestones.find(m => m.id === milestoneId)
      if (action === 'release' && milestone?.status === 'released' && milestone?.feedback) {
        showToast.error('This milestone has already been released with feedback')
        return
      }
      
      // For release action, show the feedback/rating modal
      if (action === 'release') {
        setReleaseForm({ milestoneId, feedback: '', rating: 0 })
        setShowReleaseModal(true)
        setUpdatingMilestone(null)
        return
      }
      
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
        case 'dispute':
          await milestoneApi.dispute(milestoneId)
          break
      }
      await fetchMilestones()
      await fetchMessages(50)
      // Emit milestone update via WebSocket
      if (socketRef.current) {
        socketRef.current.emit('milestone_updated', { conversationId: id })
      }
    } catch (error: any) {
      console.error(`Failed to ${action} milestone:`, error)
      const errorMessage = error.response?.data?.message || error.message || `Failed to ${action} milestone. Please try again.`
      showToast.error(errorMessage)
    } finally {
      setUpdatingMilestone(null)
    }
  }

  const handleReleaseMilestone = async () => {
    if (!releaseForm.feedback.trim()) {
      showToast.error('Please provide feedback')
      return
    }
    if (releaseForm.rating < 1 || releaseForm.rating > 5) {
      showToast.error('Please select a rating between 1 and 5')
      return
    }

    try {
      setUpdatingMilestone(releaseForm.milestoneId)
      const milestone = milestones.find(m => m.id === releaseForm.milestoneId)
      const isAdminReleased = milestone?.status === 'released' && !milestone?.feedback
      
      await milestoneApi.release(releaseForm.milestoneId, {
        feedback: releaseForm.feedback,
        rating: releaseForm.rating,
      })
      showToast.success(isAdminReleased 
        ? 'Feedback submitted! Thank you for your review.' 
        : 'Milestone released! Provider can now accept the payment.')
      setShowReleaseModal(false)
      setReleaseForm({ milestoneId: '', feedback: '', rating: 0 })
      await fetchMilestones()
      await fetchMessages(50)
      // Emit milestone update via WebSocket
      if (socketRef.current) {
        socketRef.current.emit('milestone_updated', { conversationId: id })
      }
    } catch (error: any) {
      console.error('Failed to release milestone:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to release milestone. Please try again.'
      showToast.error(errorMessage)
    } finally {
      setUpdatingMilestone(null)
    }
  }

  const handleAcceptPayment = async (transactionId: string, milestoneId: string) => {
    try {
      setAcceptingPayment(transactionId)
      const acceptedTransaction = await paymentApi.acceptPayment(transactionId)
      showToast.success('Payment accepted successfully!')
      
      // Remove from pending payments
      const newPendingPayments = new Map(pendingPayments)
      newPendingPayments.delete(milestoneId)
      setPendingPayments(newPendingPayments)
      
      // Add to successful payments
      const newSuccessfulPayments = new Map(successfulPayments)
      newSuccessfulPayments.set(milestoneId, acceptedTransaction)
      setSuccessfulPayments(newSuccessfulPayments)
      
      // Refresh milestones and messages
      await fetchMilestones()
      await fetchMessages(50)
      
      // Notify Layout to refresh balance (provider's balance increased)
      window.dispatchEvent(new CustomEvent('balance-updated'))
      
      // Scroll to show the success card
      setTimeout(() => {
        scrollToBottom()
      }, 300)
    } catch (error: any) {
      console.error('Failed to accept payment:', error)
      showToast.error(error.response?.data?.message || 'Failed to accept payment')
    } finally {
      setAcceptingPayment(null)
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

  // Group messages by sender and time (Telegram style) - kept for future use
  // const groupedMessages = useMemo(() => {
  //   if (messages.length === 0) return []
  //   
  //   const grouped: Array<{
  //     senderId: string
  //     sender: Message['sender']
  //     messages: Message[]
  //     timestamp: Date
  //   }> = []
  //   
  //   messages.forEach((message) => {
  //     const lastGroup = grouped[grouped.length - 1]
  //     const messageTime = new Date(message.createdAt)
  //     
  //     // Group if same sender and within 5 minutes
  //     if (
  //       lastGroup &&
  //       lastGroup.senderId === message.senderId &&
  //       messageTime.getTime() - lastGroup.timestamp.getTime() < 5 * 60 * 1000
  //     ) {
  //       lastGroup.messages.push(message)
  //     } else {
  //       grouped.push({
  //         senderId: message.senderId,
  //         sender: message.sender,
  //         messages: [message],
  //         timestamp: messageTime,
  //       })
  //     }
  //   })
  //   
  //   return grouped
  // }, [messages])

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-primary mb-4" />
          <p className="text-slate-400">Loading conversation...</p>
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Conversation not found</p>
          <button
            onClick={() => navigate('/services')}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 shadow-glow-primary hover:shadow-glow-primary-lg hover:-translate-y-1 transition-all"
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
    <div className="h-full flex flex-col">
      <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {/* Header */}
            <div className="glass-card border-b border-white/10 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <button
                  onClick={() => navigate('/services')}
                  className="text-slate-400 hover:text-primary transition-colors p-2 -ml-2"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                </button>
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {otherUser?.firstName?.[0] || otherUser?.userName?.[0] || <FontAwesomeIcon icon={faUser} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-white truncate">
                    {otherUser?.firstName && otherUser?.lastName
                      ? `${otherUser.firstName} ${otherUser.lastName}`
                      : otherUser?.userName || 'User'}
                  </h2>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-400 truncate">{conversation.service?.title}</p>
                    {typingUsers.size > 0 && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="flex gap-0.5">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-xs text-primary italic">
                          {Array.from(typingUsers).length === 1 ? 'typing...' : 'typing...'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button className="text-slate-400 hover:text-primary transition-colors p-2">
                <FontAwesomeIcon icon={faEllipsisV} />
              </button>
            </div>

            {/* Messages Area */}
            <div
              ref={messagesAreaRef}
              className="flex-1 overflow-y-auto relative min-h-0"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onScroll={(e) => {
                const target = e.currentTarget
                // Load more when scrolled to top (within 100px)
                if (target.scrollTop < 100 && hasMoreMessages && !loadingMoreMessages) {
                  loadMoreMessages()
                }
              }}
            >
              {/* Drag Overlay */}
              {isDragging && (
                <div
                  className="fixed inset-0 bg-primary/20 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-50 pointer-events-none"
                >
                  <div className="text-center">
                    <FontAwesomeIcon icon={faPaperclip} className="text-6xl text-primary mb-4" />
                    <p className="text-primary font-semibold text-xl">Drop files here to upload</p>
                    <p className="text-primary/80 text-sm mt-2">Release to add files to your message</p>
                  </div>
                </div>
              )}
              <div className="relative p-4 space-y-1" ref={messagesContainerRef}>
                {/* Loading indicator for older messages */}
                {loadingMoreMessages && (
                  <div className="flex justify-center py-4">
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin text-primary text-xl" />
                  </div>
                )}
                {(() => {
                  // Combine messages, milestones, pending payments, and successful payments, sorted by creation time
                  const pendingPaymentItems = Array.from(pendingPayments.entries()).map(([milestoneId, payment]) => {
                    const milestone = milestones.find(m => m.id === milestoneId)
                    return milestone ? {
                      type: 'payment-pending' as const,
                      data: { payment, milestone },
                      createdAt: payment.updatedAt || payment.createdAt, // Use transaction updatedAt when status changed to PENDING
                    } : null
                  }).filter(Boolean) as Array<{ type: 'payment-pending'; data: { payment: Transaction; milestone: Milestone }; createdAt: string }>
                  
                  const successfulPaymentItems = Array.from(successfulPayments.entries()).map(([milestoneId, payment]) => {
                    const milestone = milestones.find(m => m.id === milestoneId)
                    return milestone ? {
                      type: 'payment-success' as const,
                      data: { payment, milestone },
                      createdAt: payment.updatedAt || payment.createdAt, // Use transaction updatedAt when status changed to SUCCESS
                    } : null
                  }).filter(Boolean) as Array<{ type: 'payment-success'; data: { payment: Transaction; milestone: Milestone }; createdAt: string }>
                  
                  const allItems = [
                    ...messages.map((m) => ({ type: 'message' as const, data: m, createdAt: m.createdAt })),
                    ...milestones.map((mil) => ({ type: 'milestone' as const, data: mil, createdAt: mil.createdAt })),
                    ...pendingPaymentItems,
                    ...successfulPaymentItems,
                  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

                  let previousDate: Date | undefined

                  return allItems.map((item) => {
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
                              <div className="glass-card text-slate-400 text-xs px-3 py-1 rounded-full">
                                {itemDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                              </div>
                            </div>
                          )}
                          <div className={`flex items-end gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar for incoming messages */}
                            {!isOwn && (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mb-1">
                                {sender?.firstName?.[0] || sender?.userName?.[0] || <FontAwesomeIcon icon={faUser} className="text-xs" />}
                              </div>
                            )}

                            <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[65%] ${isOwn ? 'mr-0' : 'ml-0'}`}>
                              {/* Sender name for incoming messages */}
                              {!isOwn && sender && (
                                <span className="text-slate-400 text-xs px-2 mb-0.5">
                                  {sender.firstName && sender.lastName
                                    ? `${sender.firstName} ${sender.lastName}`
                                    : sender.userName || 'User'}
                                </span>
                              )}

                              {/* Message bubble */}
                              <div
                                className={`relative px-3 py-2 rounded-2xl ${isOwn
                                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                  : 'glass-card text-white rounded-tl-sm'
                                  } shadow-sm`}
                              >
                                {message.message && (
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words mb-2">{message.message}</p>
                                )}

                                {/* File Attachments */}
                                {message.attachmentFiles && message.attachmentFiles.length > 0 && (
                                  <div className="space-y-3 mb-2">
                                    {message.attachmentFiles.map((fileUrl, index) => {
                                      const fileName = fileUrl.split('/').pop() || `file-${index + 1}`
                                      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName)
                                      const isPdf = /\.pdf$/i.test(fileName)
                                      const isVideo = /\.(mp4|webm|ogg|mov|avi)$/i.test(fileName)
                                      const isAudio = /\.(mp3|wav|ogg|aac|m4a)$/i.test(fileName)
                                      
                                      return (
                                        <div key={index} className="space-y-1">
                                          {/* Image Preview - Telegram Style */}
                                          {isImage && (
                                            <div
                                              className="cursor-pointer group relative overflow-hidden rounded-lg -mx-1"
                                              onClick={() => handlePreviewFile(fileUrl, fileName)}
                                            >
                                              <img
                                                src={fileUrl}
                                                alt={fileName}
                                                className="w-full max-w-md object-cover rounded-lg transition-transform group-hover:scale-[1.02]"
                                                style={{ maxHeight: '400px' }}
                                              />
                                              {/* Overlay with download button on hover */}
                                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDownloadFile(fileUrl, fileName)
                                                  }}
                                                  className={`p-2 rounded-full backdrop-blur-sm ${
                                                    isOwn ? 'bg-primary-foreground/80 text-primary' : 'bg-white/80 text-primary'
                                                  } hover:scale-110 transition-transform`}
                                                  title="Download"
                                                >
                                                  <FontAwesomeIcon icon={faDownload} />
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {/* Video Preview */}
                                          {isVideo && (
                                            <div className="rounded-lg overflow-hidden border border-white/10">
                                              <div
                                                className="relative cursor-pointer group"
                                                onClick={() => handlePreviewFile(fileUrl, fileName)}
                                              >
                                                <video
                                                  src={fileUrl}
                                                  className="max-w-full max-h-64 object-contain rounded-t-lg"
                                                  preload="metadata"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                                                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                                    <FontAwesomeIcon icon={faCheckCircle} className="text-white text-2xl" />
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="flex items-center justify-between px-2 py-1.5 bg-black/30">
                                                <p className={`text-xs truncate flex-1 ${isOwn ? 'text-primary-foreground/80' : 'text-white/80'}`}>
                                                  {fileName}
                                                </p>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDownloadFile(fileUrl, fileName)
                                                  }}
                                                  className={`flex-shrink-0 p-1 rounded hover:bg-white/20 transition-colors ml-2 ${
                                                    isOwn ? 'text-primary-foreground' : 'text-primary'
                                                  }`}
                                                  title="Download"
                                                >
                                                  <FontAwesomeIcon icon={faDownload} className="text-xs" />
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {/* Audio Preview */}
                                          {isAudio && (
                                            <div
                                              className={`p-3 rounded-lg border border-white/10 cursor-pointer hover:bg-white/5 transition-colors ${
                                                isOwn ? 'bg-primary-foreground/10' : 'bg-white/5'
                                              }`}
                                              onClick={() => handlePreviewFile(fileUrl, fileName)}
                                            >
                                              <div className="flex items-center gap-3 mb-2">
                                                <FontAwesomeIcon
                                                  icon={getFileIcon(fileName)}
                                                  className={`text-2xl ${isOwn ? 'text-primary-foreground' : 'text-primary'}`}
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className={`text-sm font-medium truncate ${isOwn ? 'text-primary-foreground' : 'text-white'}`}>
                                                    {fileName}
                                                  </p>
                                                </div>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDownloadFile(fileUrl, fileName)
                                                  }}
                                                  className={`flex-shrink-0 p-1.5 rounded hover:bg-white/20 transition-colors ${
                                                    isOwn ? 'text-primary-foreground' : 'text-primary'
                                                  }`}
                                                  title="Download"
                                                >
                                                  <FontAwesomeIcon icon={faDownload} className="text-sm" />
                                                </button>
                                              </div>
                                              <audio
                                                src={fileUrl}
                                                controls
                                                className="w-full"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                Your browser does not support the audio tag.
                                              </audio>
                                            </div>
                                          )}

                                          {/* PDF Preview - Slack Style */}
                                          {isPdf && (
                                            <div
                                              className="rounded-lg overflow-hidden border border-white/10 cursor-pointer group hover:border-primary/50 transition-all -mx-1"
                                              onClick={() => handlePreviewFile(fileUrl, fileName)}
                                            >
                                              {/* Header with file info */}
                                              <div className={`px-3 py-2.5 flex items-center gap-3 ${isOwn ? 'bg-primary-foreground/5' : 'bg-white/5'}`}>
                                                <FontAwesomeIcon
                                                  icon={getFileIcon(fileName)}
                                                  className={`text-lg flex-shrink-0 ${isOwn ? 'text-primary-foreground' : 'text-primary'}`}
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className={`text-sm font-medium truncate ${isOwn ? 'text-primary-foreground' : 'text-white'}`}>
                                                    {fileName}
                                                  </p>
                                                </div>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDownloadFile(fileUrl, fileName)
                                                  }}
                                                  className={`flex-shrink-0 p-1.5 rounded hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100 ${
                                                    isOwn ? 'text-primary-foreground' : 'text-primary'
                                                  }`}
                                                  title="Download"
                                                >
                                                  <FontAwesomeIcon icon={faDownload} className="text-sm" />
                                                </button>
                                              </div>
                                              
                                              {/* PDF Preview - Full Stretch */}
                                              <div className="relative bg-slate-900/50 w-full">
                                                <div className="w-full" style={{ minHeight: '400px', maxHeight: '600px' }}>
                                                  <iframe
                                                    src={`${fileUrl}#page=1&zoom=50`}
                                                    className="w-full h-full pointer-events-none"
                                                    title={fileName}
                                                    style={{ 
                                                      minHeight: '400px',
                                                      maxHeight: '600px',
                                                      height: '500px'
                                                    }}
                                                  />
                                                </div>
                                                {/* Overlay on hover */}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                  <div className={`px-4 py-2 rounded-full backdrop-blur-sm ${
                                                    isOwn ? 'bg-primary-foreground/80 text-primary' : 'bg-white/80 text-primary'
                                                  }`}>
                                                    <span className="text-sm font-medium">Click to view full PDF</span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          )}

                                          {/* Other Files Preview */}
                                          {!isImage && !isVideo && !isAudio && !isPdf && (
                                            <div
                                              className={`flex items-center gap-3 p-3 rounded-lg border border-white/10 cursor-pointer hover:bg-white/5 transition-colors ${
                                                isOwn ? 'bg-primary-foreground/10' : 'bg-white/5'
                                              }`}
                                              onClick={() => handlePreviewFile(fileUrl, fileName)}
                                            >
                                              <div className="flex-shrink-0">
                                                <FontAwesomeIcon
                                                  icon={getFileIcon(fileName)}
                                                  className={`text-2xl ${isOwn ? 'text-primary-foreground' : 'text-primary'}`}
                                                />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${isOwn ? 'text-primary-foreground' : 'text-white'}`}>
                                                  {fileName}
                                                </p>
                                                <p className={`text-xs ${isOwn ? 'text-primary-foreground/70' : 'text-slate-400'}`}>
                                                  Click to preview or download
                                                </p>
                                              </div>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleDownloadFile(fileUrl, fileName)
                                                }}
                                                className={`flex-shrink-0 p-1.5 rounded hover:bg-white/20 transition-colors ${
                                                  isOwn ? 'text-primary-foreground' : 'text-primary'
                                                }`}
                                                title="Download"
                                              >
                                                <FontAwesomeIcon icon={faDownload} className="text-sm" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}

                                {/* Timestamp and Read Status */}
                                <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                  <span className={`text-[10px] ${isOwn ? 'text-primary-foreground/70' : 'text-slate-400'}`}>
                                    {formatTime(new Date(message.createdAt))}
                                  </span>
                                  {isOwn && (
                                    <FontAwesomeIcon
                                      icon={message.readAt ? faCheckDouble : faCheck}
                                      className={`text-[10px] ${message.readAt ? 'text-primary-foreground' : 'text-primary-foreground/50'}`}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    } else if (item.type === 'milestone') {
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
                                className={`relative px-4 py-3 rounded-2xl ${isOwn
                                  ? 'bg-primary/20 border border-primary/30 text-white rounded-tr-sm'
                                  : 'glass-card text-white rounded-tl-sm'
                                  } shadow-lg`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Milestone</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor(milestone.status)}`}>
                                    {milestone.status}
                                  </span>
                                </div>
                                <h4 className="font-semibold mb-1.5 text-base">{milestone.title}</h4>
                                <p className="text-sm mb-3 opacity-90 leading-relaxed">{milestone.description}</p>
                                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                  <span className="text-lg font-bold text-primary">${Number(milestone.balance).toFixed(2)}</span>
                                  <span className={`text-[10px] ${isOwn ? 'text-primary' : 'text-slate-400'}`}>
                                    {formatTime(new Date(milestone.createdAt))}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    } else if (item.type === 'payment-pending') {
                      // Payment acceptance card (pending)
                      const { payment, milestone } = item.data as { payment: Transaction; milestone: Milestone }
                      const paymentIsOwn = milestone.clientId === user?.id

                      return (
                        <div key={`payment-${payment.id}`}>
                          {showDateSeparator && (
                            <div className="flex justify-center my-4">
                              <div className="bg-[#182533] text-[#708499] text-xs px-3 py-1 rounded-full">
                                {itemDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                              </div>
                            </div>
                          )}
                          <div className={`flex items-end gap-2 mb-1 ${paymentIsOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`flex flex-col ${paymentIsOwn ? 'items-end' : 'items-start'} max-w-[65%]`}>
                              <div className={`relative px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 border-2 border-purple-500/50 text-white shadow-lg ${
                                paymentIsOwn ? 'rounded-tr-sm' : 'rounded-tl-sm'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">Payment Pending</span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                    {isClient ? 'WAITING FOR PROVIDER' : 'ACTION REQUIRED'}
                                  </span>
                                </div>
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                                    <FontAwesomeIcon icon={faMoneyBillWave} className="text-white text-lg" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold mb-1 text-base text-white">
                                      {isClient ? 'Payment Released - Awaiting Provider Acceptance' : 'Payment Pending Acceptance'}
                                    </h4>
                                    <p className="text-sm mb-2 opacity-90 leading-relaxed text-slate-300">
                                      {isClient ? (
                                        <>
                                          You have released payment for milestone: <span className="font-semibold text-white">{milestone.title}</span>. Waiting for provider to accept.
                                        </>
                                      ) : (
                                        <>
                                          Client has released payment for milestone: <span className="font-semibold text-white">{milestone.title}</span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 mb-3 p-2 rounded-lg bg-black/20">
                                  <div>
                                    <span className="text-slate-400 text-xs block mb-1">Amount</span>
                                    <p className="text-primary font-bold text-xl">${Number(payment.amount).toFixed(2)}</p>
                                  </div>
                                  <div className="h-8 w-px bg-white/20"></div>
                                  <div>
                                    <span className="text-slate-400 text-xs block mb-1">Milestone</span>
                                    <p className="text-white font-semibold text-sm">{milestone.title}</p>
                                  </div>
                                </div>
                                {!isClient && (
                                  <div className="flex gap-2 pt-2 border-t border-white/10">
                                    <button
                                      onClick={() => handleAcceptPayment(payment.id, milestone.id)}
                                      disabled={acceptingPayment === payment.id}
                                      className="flex-1 bg-gradient-to-r from-primary to-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:shadow-lg hover:shadow-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                    >
                                      {acceptingPayment === payment.id ? (
                                        <>
                                          <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                          Accepting...
                                        </>
                                      ) : (
                                        <>
                                          <FontAwesomeIcon icon={faCheckCircle} />
                                          Accept Payment
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                                {isClient && (
                                  <div className="pt-2 border-t border-white/10">
                                    <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
                                      <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                      <span>Waiting for provider to accept payment...</span>
                                    </div>
                                  </div>
                                )}
                                <div className={`flex items-center mt-2 ${paymentIsOwn ? 'justify-start' : 'justify-end'}`}>
                                  <span className="text-[10px] text-slate-400">
                                    {formatTime(new Date(payment.updatedAt || payment.createdAt))}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    } else {
                      // Payment success card
                      const { payment, milestone } = item.data as { payment: Transaction; milestone: Milestone }
                      const paymentIsOwn = milestone.clientId === user?.id

                      return (
                        <div key={`payment-success-${payment.id}`}>
                          {showDateSeparator && (
                            <div className="flex justify-center my-4">
                              <div className="bg-[#182533] text-[#708499] text-xs px-3 py-1 rounded-full">
                                {itemDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                              </div>
                            </div>
                          )}
                          <div className={`flex items-end gap-2 mb-1 ${paymentIsOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`flex flex-col ${paymentIsOwn ? 'items-end' : 'items-start'} max-w-[65%]`}>
                              <div className={`relative px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-green-500/20 to-emerald-500/20 border-2 border-emerald-500/50 text-white shadow-lg ${
                                paymentIsOwn ? 'rounded-tr-sm' : 'rounded-tl-sm'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Payment Successful</span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    COMPLETED
                                  </span>
                                </div>
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center flex-shrink-0">
                                    <FontAwesomeIcon icon={faCheckCircle} className="text-white text-lg" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold mb-1 text-base text-white">
                                      {isClient ? 'Payment Completed Successfully' : 'Payment Received Successfully'}
                                    </h4>
                                    <p className="text-sm mb-2 opacity-90 leading-relaxed text-slate-300">
                                      {isClient ? (
                                        <>
                                          Provider has accepted your payment for milestone: <span className="font-semibold text-white">{milestone.title}</span>
                                        </>
                                      ) : (
                                        <>
                                          You have successfully received payment for milestone: <span className="font-semibold text-white">{milestone.title}</span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 mb-3 p-2 rounded-lg bg-black/20">
                                  <div>
                                    <span className="text-slate-400 text-xs block mb-1">Amount</span>
                                    <p className="text-emerald-400 font-bold text-xl">${Number(payment.amount).toFixed(2)}</p>
                                  </div>
                                  <div className="h-8 w-px bg-white/20"></div>
                                  <div>
                                    <span className="text-slate-400 text-xs block mb-1">Milestone</span>
                                    <p className="text-white font-semibold text-sm">{milestone.title}</p>
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-white/10">
                                  <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs">
                                    <FontAwesomeIcon icon={faCheckCircle} />
                                    <span>Payment processed successfully</span>
                                  </div>
                                </div>
                                <div className={`flex items-center mt-2 ${paymentIsOwn ? 'justify-start' : 'justify-end'}`}>
                                  <span className="text-[10px] text-slate-400">
                                    {formatTime(new Date(payment.updatedAt || payment.createdAt))}
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

            {/* Input Area */}
            <div className="glass-card border-t border-white/10 px-4 py-3 flex-shrink-0 relative">
              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-2 py-1.5 glass-card rounded-lg text-sm"
                    >
                      <FontAwesomeIcon
                        icon={getFileIcon(file.name)}
                        className="text-primary text-xs"
                      />
                      <span className="text-white text-xs truncate max-w-[150px]">{file.name}</span>
                      <span className="text-slate-400 text-xs">{formatFileSize(file.size)}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-slate-400 hover:text-red-400 transition-colors ml-1"
                      >
                        <FontAwesomeIcon icon={faTimes} className="text-xs" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                  accept="*/*"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-slate-400 hover:text-primary transition-colors p-2 flex-shrink-0"
                  title="Attach files"
                >
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
                    placeholder={selectedFiles.length > 0 ? "Add a message (optional)..." : "Type a message..."}
                    rows={1}
                    className="w-full glass-card text-white rounded-2xl px-4 py-2.5 pr-12 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 resize-none max-h-32 overflow-y-auto placeholder-slate-400 text-sm leading-5"
                    style={{ minHeight: '42px', maxHeight: '128px' }}
                  />
                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="text-slate-400 hover:text-primary transition-colors p-2 absolute right-1 bottom-1"
                    >
                      <FontAwesomeIcon icon={faSmile} />
                    </button>
                    {showEmojiPicker && (
                      <div
                        ref={emojiPickerRef}
                        className="absolute bottom-12 right-0 glass-card rounded-2xl shadow-2xl p-3 w-64 h-64 overflow-y-auto z-50"
                      >
                        <div className="grid grid-cols-8 gap-1">
                          {emojis.map((emoji, index) => (
                            <button
                              key={index}
                              onClick={() => insertEmoji(emoji)}
                              className="text-2xl hover:bg-white/10 rounded p-1 transition-colors"
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
                  disabled={(!messageText.trim() && selectedFiles.length === 0) || sending || uploadingFiles}
                  className={`p-2.5 rounded-full flex-shrink-0 transition-all ${(messageText.trim() || selectedFiles.length > 0)
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow-primary'
                    : 'glass-card text-slate-400 cursor-not-allowed'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {(sending || uploadingFiles) ? (
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                  ) : (
                    <FontAwesomeIcon icon={faPaperPlane} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Milestones Sidebar */}
          <div className="w-80 glass-card border-l border-white/10 flex flex-col flex-shrink-0 min-h-0">
            <div className="p-4 border-b border-white/10 flex-shrink-0 h-[64px]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Milestones</h3>
                {isClient && (
                  <button
                    onClick={() => setShowMilestoneForm(!showMilestoneForm)}
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                )}
              </div>
              {showMilestoneForm && isClient && (
                <div className="glass-card rounded-xl p-4 space-y-3 mb-4">
                  <input
                    type="text"
                    placeholder="Title"
                    value={milestoneForm.title}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                    className="w-full glass-card text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 placeholder-slate-400 text-sm"
                  />
                  <textarea
                    placeholder="Description"
                    value={milestoneForm.description}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                    className="w-full glass-card text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 placeholder-slate-400 text-sm resize-none"
                    rows={3}
                  />
                  <input
                    type="number"
                    placeholder="Balance"
                    value={milestoneForm.balance}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, balance: e.target.value })}
                    className="w-full glass-card text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 placeholder-slate-400 text-sm"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCreateMilestone}
                      className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-full font-semibold hover:bg-primary/90 transition-colors text-sm shadow-glow-primary"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setShowMilestoneForm(false)
                        setMilestoneForm({ title: '', description: '', balance: '' })
                      }}
                      className="flex-1 glass-card text-white px-4 py-2 rounded-full font-semibold hover:bg-white/15 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {milestones.length === 0 ? (
                <p className="text-slate-400 text-center text-sm py-8">No milestones yet</p>
              ) : (
                milestones.map((milestone) => (
                  <div key={milestone.id} className="glass-card rounded-xl p-4 space-y-3 hover:border-primary/20 transition-colors">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-white text-sm">{milestone.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-semibold text-white ${getStatusColor(milestone.status)}`}>
                        {milestone.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{milestone.description}</p>
                    {milestone.feedback && milestone.rating && (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Rating:</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={`text-sm ${
                                  star <= milestone.rating! ? 'text-yellow-400' : 'text-slate-600'
                                }`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 italic">"{milestone.feedback}"</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <span className="text-base font-bold text-primary">${Number(milestone.balance).toFixed(2)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {milestone.status === 'draft' && (
                        <>
                          {!isClient && (
                            <button
                              onClick={() => handleMilestoneAction(milestone.id, 'accept')}
                              disabled={updatingMilestone === milestone.id}
                              className="flex-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-glow-primary"
                            >
                              <FontAwesomeIcon icon={faCheck} className="text-xs" />
                              Accept
                            </button>
                          )}
                          {isClient && (
                            <button
                              onClick={() => handleMilestoneAction(milestone.id, 'cancel')}
                              disabled={updatingMilestone === milestone.id}
                              className="flex-1 bg-red-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
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
                                className="flex-1 bg-yellow-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <FontAwesomeIcon icon={faMoneyBillWave} className="text-xs" />
                                Withdraw
                              </button>
                            </>
                          )}
                          {/* Client cannot cancel after provider has accepted (status is PROCESSING) */}
                        </>
                      )}
                      {milestone.status === 'completed' && (
                        <>
                          {isClient && (
                            <>
                              <button
                                onClick={() => handleMilestoneAction(milestone.id, 'release')}
                                disabled={updatingMilestone === milestone.id}
                                className="flex-1 bg-purple-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <FontAwesomeIcon icon={faCheckCircle} className="text-xs" />
                                Release
                              </button>
                              <button
                                onClick={() => handleMilestoneAction(milestone.id, 'dispute')}
                                disabled={updatingMilestone === milestone.id}
                                className="flex-1 bg-yellow-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
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
                              className="flex-1 bg-yellow-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                            >
                              <FontAwesomeIcon icon={faGavel} className="text-xs" />
                              Dispute
                            </button>
                          )}
                        </>
                      )}
                      {milestone.status === 'released' && !milestone.feedback && isClient && (
                        <button
                          onClick={() => {
                            setReleaseForm({ milestoneId: milestone.id, feedback: '', rating: 0 })
                            setShowReleaseModal(true)
                          }}
                          className="flex-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1 shadow-glow-primary"
                        >
                          <FontAwesomeIcon icon={faStar} className="text-xs" />
                          Provide Feedback
                        </button>
                      )}
                      {milestone.status === 'released' && (
                        <>
                          {/* Only provider can dispute after milestone is released */}
                          {!isClient && (
                            <button
                              onClick={() => handleMilestoneAction(milestone.id, 'dispute')}
                              disabled={updatingMilestone === milestone.id}
                              className="flex-1 bg-yellow-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
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

      {/* Release Milestone Modal */}
      {showReleaseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">
              {(() => {
                const milestone = milestones.find(m => m.id === releaseForm.milestoneId)
                const isAdminReleased = milestone?.status === 'released' && !milestone?.feedback
                return isAdminReleased ? 'Provide Feedback' : 'Release Milestone'
              })()}
            </h2>
            <p className="text-slate-300 text-sm mb-4">
              {(() => {
                const milestone = milestones.find(m => m.id === releaseForm.milestoneId)
                const isAdminReleased = milestone?.status === 'released' && !milestone?.feedback
                return isAdminReleased
                  ? 'This milestone was released by admin. Please provide your feedback and rate the provider (1-5 stars).'
                  : 'Please provide feedback and rate the provider (1-5 stars) before releasing this milestone.'
              })()}
            </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Rating (1-5 stars) *
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReleaseForm({ ...releaseForm, rating: star })}
                    className={`text-2xl transition-all ${
                      releaseForm.rating >= star
                        ? 'text-yellow-400'
                        : 'text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
              {releaseForm.rating > 0 && (
                <p className="text-xs text-slate-400 mt-1">{releaseForm.rating} star{releaseForm.rating !== 1 ? 's' : ''} selected</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Feedback *
              </label>
              <textarea
                value={releaseForm.feedback}
                onChange={(e) => setReleaseForm({ ...releaseForm, feedback: e.target.value })}
                placeholder="Share your experience with this milestone..."
                className="w-full glass-card text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 placeholder-slate-400 text-sm resize-none"
                rows={4}
              />
            </div>
          </div>

          <div className="flex space-x-2 pt-4">
            <button
              onClick={handleReleaseMilestone}
              disabled={updatingMilestone === releaseForm.milestoneId || !releaseForm.feedback.trim() || releaseForm.rating < 1}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-full font-semibold hover:bg-primary/90 transition-colors text-sm shadow-glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatingMilestone === releaseForm.milestoneId ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                  {(() => {
                    const milestone = milestones.find(m => m.id === releaseForm.milestoneId)
                    const isAdminReleased = milestone?.status === 'released' && !milestone?.feedback
                    return isAdminReleased ? 'Submitting...' : 'Releasing...'
                  })()}
                </>
              ) : (
                (() => {
                  const milestone = milestones.find(m => m.id === releaseForm.milestoneId)
                  const isAdminReleased = milestone?.status === 'released' && !milestone?.feedback
                  return isAdminReleased ? 'Submit Feedback' : 'Release Milestone'
                })()
              )}
            </button>
            <button
              onClick={() => {
                setShowReleaseModal(false)
                setReleaseForm({ milestoneId: '', feedback: '', rating: 0 })
              }}
              disabled={updatingMilestone === releaseForm.milestoneId}
              className="flex-1 glass-card text-white px-4 py-2 rounded-full font-semibold hover:bg-white/15 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={closePreview}
        >
          <div
            className="glass-card rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FontAwesomeIcon
                  icon={getFileIcon(previewFile.name)}
                  className="text-primary text-xl flex-shrink-0"
                />
                <h3 className="text-white font-semibold truncate">{previewFile.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadFile(previewFile.url, previewFile.name)}
                  className="text-slate-400 hover:text-primary transition-colors p-2"
                  title="Download"
                >
                  <FontAwesomeIcon icon={faDownload} />
                </button>
                <button
                  onClick={closePreview}
                  className="text-slate-400 hover:text-red-400 transition-colors p-2"
                  title="Close"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/20">
              {previewFile.type === 'image' && (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  onClick={() => window.open(previewFile.url, '_blank')}
                />
              )}

              {previewFile.type === 'pdf' && (
                <iframe
                  src={previewFile.url}
                  className="w-full h-[70vh] rounded-lg"
                  title={previewFile.name}
                />
              )}

              {previewFile.type === 'video' && (
                <video
                  src={previewFile.url}
                  controls
                  className="max-w-full max-h-[70vh] rounded-lg"
                >
                  Your browser does not support the video tag.
                </video>
              )}

              {previewFile.type === 'audio' && (
                <div className="w-full max-w-md">
                  <div className="text-center mb-4">
                    <FontAwesomeIcon
                      icon={getFileIcon(previewFile.name)}
                      className="text-primary text-6xl mb-4"
                    />
                    <p className="text-white font-semibold">{previewFile.name}</p>
                  </div>
                  <audio
                    src={previewFile.url}
                    controls
                    className="w-full"
                  >
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              )}

              {previewFile.type === 'other' && (
                <div className="text-center">
                  <FontAwesomeIcon
                    icon={getFileIcon(previewFile.name)}
                    className="text-primary text-6xl mb-4"
                  />
                  <p className="text-white font-semibold mb-2">{previewFile.name}</p>
                  <p className="text-slate-400 text-sm mb-4">Preview not available for this file type</p>
                  <button
                    onClick={() => handleDownloadFile(previewFile.url, previewFile.name)}
                    className="bg-primary text-primary-foreground px-6 py-2 rounded-full font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <FontAwesomeIcon icon={faDownload} />
                    Download File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Chat

