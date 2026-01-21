import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faSpinner,
  faPaperPlane,
  faUser,
  faPlus,
  faCheck,
  faCheckDouble,
  faTrash,
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
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { showToast } from '../utils/toast'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2 } from "lucide-react"

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
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const markReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesAreaRef = useRef<HTMLDivElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [requestingReactivation, setRequestingReactivation] = useState(false)
  const [reactivationRequested, setReactivationRequested] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set())
  const [isMouseSelectingMessages, setIsMouseSelectingMessages] = useState(false)
  const selectionAnchorRef = useRef<{
    index: number
    mode: 'select' | 'deselect'
    baseline: Set<string>
  } | null>(null)
  const clickSuppressRef = useRef(false)
  const lastRangeAnchorRef = useRef<number | null>(null)
  const [showDeleteSelectedDialog, setShowDeleteSelectedDialog] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const isBlocked = Boolean(conversation?.isBlocked)
  const reactivationPending = Boolean(conversation?.reactivationRequestPending) || reactivationRequested
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const selectionMode = selectedMessageIds.size > 0 || isMouseSelectingMessages

  const messageIndexById = useMemo(() => {
    const map = new Map<string, number>()
    messages.forEach((m, idx) => map.set(m.id, idx))
    return map
  }, [messages])

  const selectedDeletableIds = useMemo(() => {
    if (!user?.id) return []
    const msgById = new Map(messages.map((m) => [m.id, m] as const))
    return Array.from(selectedMessageIds).filter((id) => msgById.get(id)?.senderId === user.id)
  }, [selectedMessageIds, messages, user?.id])

  useEffect(() => {
    // Reset selection when switching conversations
    setSelectedMessageIds(new Set())
    setIsMouseSelectingMessages(false)
    selectionAnchorRef.current = null
    clickSuppressRef.current = false
    lastRangeAnchorRef.current = null
  }, [id])

  useEffect(() => {
    if (!isMouseSelectingMessages) return
    const handleMouseUp = () => {
      setIsMouseSelectingMessages(false)
      selectionAnchorRef.current = null
      // allow click after mouseup
      setTimeout(() => {
        clickSuppressRef.current = false
      }, 0)
    }
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [isMouseSelectingMessages])

  useEffect(() => {
    if (selectedMessageIds.size === 0) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedMessageIds(new Set())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedMessageIds])

  const applySelectionRange = (fromIndex: number, toIndex: number, mode: 'select' | 'deselect') => {
    // Additive range selection (used for shift+click).
    const start = Math.min(fromIndex, toIndex)
    const end = Math.max(fromIndex, toIndex)
    setSelectedMessageIds((prev) => {
      const next = new Set(prev)
      for (let i = start; i <= end; i++) {
        const mid = messages[i]?.id
        if (!mid) continue
        if (mode === 'select') next.add(mid)
        else next.delete(mid)
      }
      return next
    })
  }

  const applyDragSelection = (fromIndex: number, toIndex: number) => {
    // Telegram-like drag selection: selection is derived from baseline +/- current range,
    // so dragging back will unselect previously swept messages.
    const anchor = selectionAnchorRef.current
    if (!anchor) return

    const start = Math.min(fromIndex, toIndex)
    const end = Math.max(fromIndex, toIndex)

    const rangeIds: string[] = []
    for (let i = start; i <= end; i++) {
      const mid = messages[i]?.id
      if (mid) rangeIds.push(mid)
    }

    const next = new Set(anchor.baseline)
    if (anchor.mode === 'select') {
      rangeIds.forEach((id) => next.add(id))
    } else {
      rangeIds.forEach((id) => next.delete(id))
    }
    setSelectedMessageIds(next)
  }

  const isClickOnChatClickable = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement | null
    return Boolean(
      el &&
        (el.closest?.('[data-chat-clickable="true"]') ||
          el.closest?.('button,a,input,textarea,select')),
    )
  }

  const handleMessageMouseDown = (e: React.MouseEvent, messageId: string, messageIndex: number) => {
    if (e.button !== 0) return
    if (messageIndex < 0) return
    // Prevent text selection and enable drag-to-select like Telegram
    e.preventDefault()
    const mode: 'select' | 'deselect' = selectedMessageIds.has(messageId) ? 'deselect' : 'select'
    selectionAnchorRef.current = { index: messageIndex, mode, baseline: new Set(selectedMessageIds) }
    clickSuppressRef.current = true
    setIsMouseSelectingMessages(true)
    applyDragSelection(messageIndex, messageIndex)
    lastRangeAnchorRef.current = messageIndex
  }

  const handleMessageMouseEnter = (_e: React.MouseEvent, messageIndex: number) => {
    if (!isMouseSelectingMessages) return
    const anchor = selectionAnchorRef.current
    if (!anchor) return
    if (messageIndex < 0) return
    applyDragSelection(anchor.index, messageIndex)
  }

  const handleMessageClick = (e: React.MouseEvent, messageId: string, messageIndex: number) => {
    if (messageIndex < 0) return
    if (clickSuppressRef.current) {
      // Selection already handled by mouse down / drag logic
      clickSuppressRef.current = false
      return
    }

    if (e.shiftKey && lastRangeAnchorRef.current !== null) {
      applySelectionRange(lastRangeAnchorRef.current, messageIndex, 'select')
      return
    }

    setSelectedMessageIds((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
    lastRangeAnchorRef.current = messageIndex
  }

  const handleConfirmDeleteSelectedMessages = async () => {
    if (selectedMessageIds.size === 0) return
    if (!user?.id) return

    const deletable = selectedDeletableIds

    if (deletable.length === 0) {
      showToast.error("You can only delete your own messages")
      return
    }

    try {
      setDeleteSubmitting(true)
      const res = await messageApi.deleteBulk(deletable)
      const deletedIds = new Set(res.deletedIds || deletable)
      setMessages((prev) => prev.filter((m) => !deletedIds.has(m.id)))
      setSelectedMessageIds((prev) => {
        const next = new Set(prev)
        deletedIds.forEach((id) => next.delete(id))
        return next
      })
      showToast.success("Messages deleted")
      setShowDeleteSelectedDialog(false)
    } catch (error: any) {
      console.error('Failed to delete messages:', error)
      const msg = error.response?.data?.message || 'Failed to delete messages'
      showToast.error(msg)
    } finally {
      setDeleteSubmitting(false)
    }
  }

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

    // Track current conversation ID to prevent stale joins
    let currentConversationId = id
    let hasJoined = false

    // Wait for connection before joining room
    const setupSocket = () => {
      // Only proceed if we're still on the same conversation
      if (currentConversationId !== id) {
        console.log('⚠️ Conversation ID changed during setup, aborting')
        return
      }

      if (socket.connected && !hasJoined) {
        console.log('Socket connected, joining conversation:', id)
        socket.emit('join_conversation', { conversationId: id })
        hasJoined = true
      } else if (!socket.connected) {
        // Ensure we join when connected
        const onConnect = () => {
          // Double-check we're still on the same conversation
          if (socket && currentConversationId === id && !hasJoined) {
            console.log('Socket connected after wait, joining conversation:', id)
            socket.emit('join_conversation', { conversationId: id })
            hasJoined = true
          }
        }
        socket.once('connect', onConnect)
        // Also try to connect if not already connected
        if (!socket.connected) {
          console.log('Socket not connected, attempting to connect...')
          socket.connect()
        }
      }
    }

    setupSocket()
    
    // Re-join conversation on reconnect (only if still on same conversation)
    const handleReconnect = () => {
      if (socket && socket.connected && currentConversationId === id && !hasJoined) {
        console.log('Socket reconnected, re-joining conversation:', id)
        socket.emit('join_conversation', { conversationId: id })
        hasJoined = true
      }
    }
    socket.on('reconnect', handleReconnect)

    // Listen for new messages
    const handleNewMessage = (message: Message) => {
      // Only add message if it belongs to the current conversation
      if (message.conversationId !== id) {
        return
      }
      
      // Log for debugging
      console.log('📨 Received new message:', {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        currentUserId: user?.id,
        message: message.message?.substring(0, 50),
      })
      
      setMessages((prev) => {
        // Check if message already exists (by real ID)
        const existingIndex = prev.findIndex((m) => m.id === message.id)
        if (existingIndex !== -1) {
          // Update existing message (for optimistic updates or status changes)
          console.log('🔄 Updating existing message:', message.id)
          return prev.map((m) => (m.id === message.id ? message : m))
        }
        
        // Check if there's an optimistic message from the same sender with similar content
        // This helps replace optimistic messages when server confirms
        const optimisticIndex = prev.findIndex(
          (m) => m.id.startsWith('temp-') && 
                 m.senderId === message.senderId && 
                 m.message === message.message &&
                 Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) < 5000
        )
        
        if (optimisticIndex !== -1) {
          // Replace optimistic message with real message
          console.log('✅ Replacing optimistic message with real message:', message.id)
          const newMessages = [...prev]
          newMessages[optimisticIndex] = message
          return newMessages
        }
        
        // Add new message - ensure it's added immediately
        console.log('➕ Adding new message to chat:', message.id)
        return [...prev, message]
      })
      
      // Mark messages as read when new message arrives in current conversation
      if (message.senderId !== user?.id) {
        markMessagesAsRead()
      }
    }

    // Follow-up fraud flag after message is sent
    const handleMessageFraud = (data: { conversationId: string; messageId: string; fraud?: any }) => {
      if (data.conversationId !== id) return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? {
                ...m,
                isFraud: true,
                fraud: data.fraud || { category: null, reason: null, confidence: null },
                contentHiddenForViewer: m.senderId !== user?.id && user?.role !== 'admin' ? true : m.contentHiddenForViewer,
                message: m.senderId !== user?.id && user?.role !== 'admin' ? '' : m.message,
                attachmentFiles: m.senderId !== user?.id && user?.role !== 'admin' ? [] : m.attachmentFiles,
              }
            : m,
        ),
      )
    }

    const handleConversationBlocked = (data: { conversationId: string; reason?: string }) => {
      if (data.conversationId !== id) return
      showToast.error('Conversation was blocked due to fraud detection.')
      setConversation((prev) => (prev ? { ...prev, isBlocked: true, blockedReason: data.reason || 'fraud_threshold_reached' } as any : prev))
      fetchConversation()
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
        
        // Immediately notify ChatList to clear badge when messages are read
        if (data.messageIds && data.messageIds.length > 0) {
          window.dispatchEvent(new CustomEvent('conversation-viewed', { detail: { conversationId: id } }))
        }
      }
    }

    const handleMessageDeleted = (data: { conversationId: string; messageId: string }) => {
      if (data.conversationId !== id) return
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId))
      setSelectedMessageIds((prev) => {
        if (!prev.has(data.messageId)) return prev
        const next = new Set(prev)
        next.delete(data.messageId)
        return next
      })
    }

    socket.on('new_message', handleNewMessage)
    socket.on('message_fraud', handleMessageFraud)
    socket.on('conversation_blocked', handleConversationBlocked)
    socket.on('milestone_updated', handleMilestoneUpdate)
    socket.on('payment_pending', handlePaymentPending)
    socket.on('payment_accepted', handlePaymentAccepted)
    socket.on('user_typing', handleTyping)
    socket.on('user_stopped_typing', handleStopTyping)
    socket.on('messages_read', handleMessagesRead)
    socket.on('message_deleted', handleMessageDeleted)
    socket.on('joined_conversation', (data: { conversationId?: string }) => {
      const joinedId = data?.conversationId || id
      console.log('✅ Joined conversation room:', joinedId, 'Current id:', id)
      
      // Only proceed if we're still on this conversation (in case user navigated away)
      if (joinedId !== id || currentConversationId !== id) {
        console.log('⚠️ Joined different conversation, ignoring')
        return
      }
      
      hasJoined = true
      
      // Mark messages as read when joining
      markMessagesAsRead()
      // Notify ChatList to clear unread count
      window.dispatchEvent(new CustomEvent('conversation-viewed', { detail: { conversationId: id } }))
    })
    socket.on('error', (error) => {
      console.error('Socket error:', error)
      const msg = (error as any)?.message || ''
      if (typeof msg === 'string' && msg.toLowerCase().includes('blocked')) {
        showToast.error(msg)
        fetchConversation()
      } else if (typeof msg === 'string' && msg.toLowerCase().includes('not authenticated')) {
        // Handle authentication error - socket will attempt to re-authenticate
        console.warn('Socket authentication error, attempting to reconnect...')
        // The socket service will handle re-authentication automatically
      }
    })

    // Cleanup on unmount or when conversation ID changes
    return () => {
      console.log('🧹 Cleaning up socket listeners for conversation:', id)
      
      // Mark that we're no longer on this conversation
      currentConversationId = ''
      hasJoined = false
      
      if (socket) {
        // Leave the conversation room first (only if still connected)
        if (id && socket.connected) {
          console.log('Leaving conversation room:', id)
          socket.emit('leave_conversation', { conversationId: id })
        }
        
        // Remove all event listeners
        socket.off('new_message', handleNewMessage)
        socket.off('message_fraud', handleMessageFraud)
        socket.off('conversation_blocked', handleConversationBlocked)
        socket.off('milestone_updated', handleMilestoneUpdate)
        socket.off('payment_pending', handlePaymentPending)
        socket.off('payment_accepted', handlePaymentAccepted)
        socket.off('user_typing', handleTyping)
        socket.off('user_stopped_typing', handleStopTyping)
        socket.off('messages_read', handleMessagesRead)
        socket.off('message_deleted', handleMessageDeleted)
        socket.off('joined_conversation')
        socket.off('error')
        socket.off('connect_error')
        socket.off('reconnect', handleReconnect)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current)
      }
    }
  }, [id, user?.id, user?.role])

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
    if (!socketRef.current || !id || !user) {
      console.log('⚠️ Cannot mark messages as read:', { socket: !!socketRef.current, id, user: !!user })
      return
    }

    // Clear previous timeout
    if (markReadTimeoutRef.current) {
      clearTimeout(markReadTimeoutRef.current)
    }

    // Mark as read after a short delay (when user is viewing)
    markReadTimeoutRef.current = setTimeout(() => {
      // Re-check socket and connection state
      if (!socketRef.current || !socketRef.current.connected) {
        console.log('⚠️ Socket not connected, cannot mark messages as read. Socket:', !!socketRef.current, 'Connected:', socketRef.current?.connected)
        return
      }

      const unreadMessageIds = messages
        .filter((msg) => msg.senderId !== user.id && !msg.readAt)
        .map((msg) => msg.id)

      if (unreadMessageIds.length > 0) {
        console.log('📖 Marking messages as read:', unreadMessageIds.length, 'messages in conversation', id)
        socketRef.current.emit('mark_messages_read', {
          conversationId: id,
          messageIds: unreadMessageIds,
        })
        // Immediately notify ChatList to clear badge
        window.dispatchEvent(new CustomEvent('conversation-viewed', { detail: { conversationId: id } }))
      }
    }, 100) // Immediate marking for faster badge updates
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
      // If conversation becomes unblocked, reset local request state
      if (!data?.isBlocked) {
        setReactivationRequested(false)
      }
      if (data?.reactivationRequestPending) {
        setReactivationRequested(true)
      }
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
    if (isBlocked) {
      showToast.error('This conversation is blocked. You can request reactivation.')
      return
    }

    // Store message content and files for optimistic update
    const messageContent = messageText.trim() || (selectedFiles.length > 0 ? '📎 Sent file(s)' : '')
    const tempMessageId = `temp-${Date.now()}-${Math.random()}`
    
    // Create optimistic message (without readAt, will be updated when server confirms)
    const optimisticMessage: Message = {
      id: tempMessageId,
      conversationId: id,
      senderId: user?.id || '',
      message: messageContent,
      attachmentFiles: selectedFiles.length > 0 ? [] : undefined, // Will be updated when files are uploaded
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sender: user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        avatar: user.avatar,
      } : undefined,
    }

    // Add optimistic message immediately
    setMessages((prev) => [...prev, optimisticMessage])
    setMessageText('')
    const filesToUpload = [...selectedFiles]
    setSelectedFiles([])

    try {
      setSending(true)
      setUploadingFiles(true)

      let attachmentFiles: string[] = []

      // Upload files if any
      if (filesToUpload.length > 0) {
        try {
          const uploadResult = await messageApi.uploadFiles(filesToUpload)
          attachmentFiles = uploadResult.urls
          
          // Update optimistic message with file URLs
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempMessageId
                ? { ...m, attachmentFiles: uploadResult.urls }
                : m
            )
          )
        } catch (error: any) {
          console.error('Failed to upload files:', error)
          // Remove optimistic message on error
          setMessages((prev) => prev.filter((m) => m.id !== tempMessageId))
          showToast.error(error.response?.data?.message || 'Failed to upload files. Please try again.')
          setSending(false)
          setUploadingFiles(false)
          // Restore message text and files
          setMessageText(messageContent)
          setSelectedFiles(filesToUpload)
          return
        }
      }

      // Try WebSocket first, fallback to HTTP API
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('send_message', {
          conversationId: id,
          message: messageContent,
          attachmentFiles: attachmentFiles.length > 0 ? attachmentFiles : undefined,
        })
        // Message will be replaced via WebSocket 'new_message' event with real ID
        // The optimistic message will be replaced when server confirms
      } else {
        // Fallback to HTTP API if WebSocket not available
        const createdMessage = await messageApi.create(id, messageContent, attachmentFiles.length > 0 ? attachmentFiles : undefined)
        // Replace optimistic message with real message
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMessageId ? createdMessage : m))
        )
      }
    } catch (error: any) {
      console.error('Failed to send message:', error)
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempMessageId))
      // Restore message text and files
      setMessageText(messageContent)
      setSelectedFiles(filesToUpload)
      showToast.error(error.response?.data?.message || 'Failed to send message. Please try again.')
      if (String(error.response?.data?.message || '').toLowerCase().includes('blocked')) {
        fetchConversation()
      }
    } finally {
      setSending(false)
      setUploadingFiles(false)
    }
  }

  const handleRequestReactivation = async () => {
    if (!id) return
    try {
      setRequestingReactivation(true)
      await conversationApi.requestReactivation(id)
      setReactivationRequested(true)
      showToast.success('Reactivation request sent to admin.')
      fetchConversation()
    } catch (error: any) {
      console.error('Failed to request reactivation:', error)
      showToast.error(error.response?.data?.message || 'Failed to send reactivation request')
      // If it's already pending, refresh conversation so the button disables for this user too
      fetchConversation()
    } finally {
      setRequestingReactivation(false)
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
    // Use semantic tokens so it works in light/dark
    const colors: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      processing: "bg-primary/10 text-primary",
      canceled: "bg-destructive/10 text-destructive",
      completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      withdraw: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
      released: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
      dispute: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    }
    return colors[status] || "bg-muted text-muted-foreground"
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
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Conversation not found</p>
          <button
            onClick={() => navigate('/services')}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 shadow-glow-primary hover:shadow-glow-primary-lg hover:-tranneutral-y-1 transition-all"
          >
            Back to Services
          </button>
        </div>
      </div>
    )
  }

  const otherUser = getOtherUser()
  const isClient = conversation.clientId === user?.id
  const otherUserName = otherUser?.userName 
    || (otherUser?.firstName && otherUser?.lastName
      ? `${otherUser.firstName} ${otherUser.lastName}`
      : "User")

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <Dialog open={showDeleteSelectedDialog} onOpenChange={setShowDeleteSelectedDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete selected messages?</DialogTitle>
                  <DialogDescription>
                    {selectedDeletableIds.length === selectedMessageIds.size ? (
                      <span>
                        This will permanently delete <strong>{selectedDeletableIds.length}</strong> message(s).
                      </span>
                    ) : (
                      <span>
                        You can only delete your own messages. This will delete{" "}
                        <strong>{selectedDeletableIds.length}</strong> out of{" "}
                        <strong>{selectedMessageIds.size}</strong> selected.
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDeleteSelectedDialog(false)}
                    disabled={deleteSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleConfirmDeleteSelectedMessages}
                    disabled={deleteSubmitting || selectedDeletableIds.length === 0}
                    className="gap-2"
                  >
                    {deleteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Header */}
            <div className="glass-card border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
              {selectedMessageIds.size > 0 ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2"
                      onClick={() => setSelectedMessageIds(new Set())}
                      title="Cancel selection (Esc)"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                    <div className="font-semibold text-foreground truncate">
                      {selectedMessageIds.size} selected
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive transition-colors p-2 disabled:opacity-50"
                    disabled={selectedDeletableIds.length === 0}
                    onClick={() => setShowDeleteSelectedDialog(true)}
                    title={
                      selectedDeletableIds.length === 0
                        ? "You can only delete your own messages"
                        : "Delete selected"
                    }
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {/* <button
                      onClick={() => navigate('/services')}
                      className="text-neutral-400 hover:text-primary transition-colors p-2 -ml-2"
                    >
                      <FontAwesomeIcon icon={faArrowLeft} />
                    </button> */}
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={(otherUser as any)?.avatar || undefined} alt={otherUserName} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {otherUser?.firstName?.[0] || otherUser?.userName?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-semibold text-foreground truncate">
                        {otherUserName}
                      </h2>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground truncate">{conversation.service?.title}</p>
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
                  <button className="text-muted-foreground hover:text-foreground transition-colors p-2">
                    <FontAwesomeIcon icon={faEllipsisV} />
                  </button>
                </>
              )}
            </div>

            {/* Messages Area */}
            <div
              ref={messagesAreaRef}
              className="flex-1 overflow-y-auto overflow-x-hidden relative min-h-0"
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
              <div className="relative p-4 space-y-1 overflow-x-hidden" ref={messagesContainerRef}>
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
                      const hideContentForViewer =
                        Boolean((message as any).contentHiddenForViewer) ||
                        ((!isOwn && user?.role !== 'admin') && Boolean((message as any).isFraud || (message as any).fraud))
                      const fraudReason = (message as any).fraud?.reason
                      const sender = message.sender
                      const messageIndex = messageIndexById.get(message.id) ?? -1
                      const isSelected = selectedMessageIds.has(message.id)

                      return (
                        <div key={`msg-${message.id}`}>
                          {showDateSeparator && (
                            <div className="flex justify-center my-4">
                              <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                                {itemDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                              </div>
                            </div>
                          )}
                          <div
                            className={[
                              `flex items-end gap-2 mb-1 w-full rounded-lg px-1 py-0.5 transition-colors duration-150 ease-out`,
                              isOwn ? 'flex-row-reverse' : 'flex-row',
                              isSelected ? 'bg-primary/5' : 'bg-transparent',
                              selectionMode ? 'select-none' : '',
                            ].join(' ')}
                            onMouseDown={(e) => {
                              // Start selection from anywhere on the message row (full width).
                              // Allow normal media clicks unless selection is active or shift is held.
                              if (selectedMessageIds.size === 0 && !isMouseSelectingMessages && !e.shiftKey && isClickOnChatClickable(e)) {
                                return
                              }
                              handleMessageMouseDown(e, message.id, messageIndex)
                            }}
                            onMouseEnter={(e) => handleMessageMouseEnter(e, messageIndex)}
                            onClick={(e) => {
                              if (selectedMessageIds.size === 0 && !isMouseSelectingMessages && !e.shiftKey && isClickOnChatClickable(e)) {
                                return
                              }
                              handleMessageClick(e, message.id, messageIndex)
                            }}
                            onClickCapture={(e) => {
                              if (selectedMessageIds.size > 0 || isMouseSelectingMessages) {
                                // Prevent opening previews/menus while selecting
                                e.stopPropagation()
                              }
                            }}
                          >
                            {/* Selection gutter (Telegram style) */}
                            <div
                              className={[
                                "flex-shrink-0 flex items-center justify-center pb-1 overflow-hidden",
                                "transition-[width,opacity] duration-150 ease-out",
                                selectionMode ? "w-7 opacity-100" : "w-0 opacity-0",
                              ].join(" ")}
                              aria-hidden={!selectionMode}
                            >
                              <div
                                className={[
                                  "h-5 w-5 rounded-full border flex items-center justify-center",
                                  "transition-[transform,background-color,border-color,color] duration-150 ease-out",
                                  isSelected
                                    ? "bg-primary border-primary text-primary-foreground scale-100"
                                    : "bg-background/50 border-border text-transparent scale-95",
                                ].join(" ")}
                              >
                                <FontAwesomeIcon
                                  icon={faCheck}
                                  className={[
                                    "text-[10px] transition-opacity duration-150 ease-out",
                                    isSelected ? "opacity-100" : "opacity-0",
                                  ].join(" ")}
                                />
                              </div>
                            </div>

                            {/* Avatar for incoming messages */}
                            {!isOwn && (
                              <Avatar className="h-8 w-8 flex-shrink-0 mb-1">
                                <AvatarImage
                                  src={sender?.avatar || undefined}
                                  alt={
                                    sender?.userName 
                                      || (sender?.firstName && sender?.lastName
                                        ? `${sender.firstName} ${sender.lastName}`
                                        : "User")
                                  }
                                />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                  {sender?.firstName?.[0] || sender?.userName?.[0] || (
                                    <FontAwesomeIcon icon={faUser} className="text-xs" />
                                  )}
                                </AvatarFallback>
                              </Avatar>
                            )}

                            <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[65%] ${isOwn ? 'mr-0' : 'ml-0'}`}>
                              {/* Sender name for incoming messages */}
                              {!isOwn && sender && (
                                <span className="text-muted-foreground text-xs px-2 mb-0.5">
                                  {sender.userName 
                                    || (sender.firstName && sender.lastName
                                      ? `${sender.firstName} ${sender.lastName}`
                                      : 'User')}
                                </span>
                              )}

                              {/* Message bubble */}
                              <div
                                className={[
                                  `relative px-3 py-2 rounded-2xl shadow-sm transition-[box-shadow,transform] duration-150 ease-out`,
                                  isOwn
                                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                    : 'glass-card text-foreground rounded-tl-sm',
                                  isSelected ? 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background' : 'ring-0',
                                  selectionMode ? 'cursor-pointer select-none' : '',
                                ].join(' ')}
                              >
                                {message.message && !hideContentForViewer && (
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words mb-2">{message.message}</p>
                                )}

                                {/* File Attachments */}
                                {message.attachmentFiles && message.attachmentFiles.length > 0 && !hideContentForViewer && (
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
                                              data-chat-clickable="true"
                                              onClick={() => handlePreviewFile(fileUrl, fileName)}
                                            >
                                              <img
                                                src={fileUrl}
                                                alt={fileName}
                                                className="w-full max-w-md object-cover rounded-lg transition-transform group-hover:scale-[1.02]"
                                                style={{ maxHeight: '400px' }}
                                              />
                                              {/* Overlay with download button on hover */}
                                              <div className="absolute inset-0 bg-transparent group-hover:bg-muted/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
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
                                            <div className="rounded-lg overflow-hidden border border-border">
                                              <div
                                                className="relative cursor-pointer group"
                                                data-chat-clickable="true"
                                                onClick={() => handlePreviewFile(fileUrl, fileName)}
                                              >
                                                <video
                                                  src={fileUrl}
                                                  className="max-w-full max-h-64 object-contain rounded-t-lg"
                                                  preload="metadata"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center bg-muted/40 group-hover:bg-muted/50 transition-colors">
                                                  <div className="w-16 h-16 rounded-full bg-background/40 backdrop-blur-sm flex items-center justify-center">
                                                    <FontAwesomeIcon icon={faCheckCircle} className="text-foreground text-2xl" />
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="flex items-center justify-between px-2 py-1.5 bg-muted/40">
                                                <p className={`text-xs truncate flex-1 ${isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                                  {fileName}
                                                </p>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDownloadFile(fileUrl, fileName)
                                                  }}
                                                  className={`flex-shrink-0 p-1 rounded hover:bg-muted/40 transition-colors ml-2 ${
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
                                              className={`p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40 transition-colors ${
                                                isOwn ? 'bg-primary/10 border-primary/20' : 'bg-muted/30'
                                              }`}
                                              onClick={() => handlePreviewFile(fileUrl, fileName)}
                                            >
                                              <div className="flex items-center gap-3 mb-2">
                                                <FontAwesomeIcon
                                                  icon={getFileIcon(fileName)}
                                                  className={`text-2xl ${isOwn ? 'text-primary-foreground' : 'text-primary'}`}
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className={`text-sm font-medium truncate ${isOwn ? 'text-primary-foreground' : 'text-foreground'}`}>
                                                    {fileName}
                                                  </p>
                                                </div>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDownloadFile(fileUrl, fileName)
                                                  }}
                                                  className={`flex-shrink-0 p-1.5 rounded hover:bg-muted/40 transition-colors ${
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
                                              className="rounded-lg overflow-hidden border border-border cursor-pointer group hover:border-primary/50 transition-all -mx-1"
                                              onClick={() => handlePreviewFile(fileUrl, fileName)}
                                            >
                                              {/* Header with file info */}
                                              <div className={`px-3 py-2.5 flex items-center gap-3 ${isOwn ? 'bg-primary/10' : 'bg-muted/30'}`}>
                                                <FontAwesomeIcon
                                                  icon={getFileIcon(fileName)}
                                                  className={`text-lg flex-shrink-0 ${isOwn ? 'text-primary-foreground' : 'text-primary'}`}
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className={`text-sm font-medium truncate ${isOwn ? 'text-primary-foreground' : 'text-foreground'}`}>
                                                    {fileName}
                                                  </p>
                                                </div>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDownloadFile(fileUrl, fileName)
                                                  }}
                                                  className={`flex-shrink-0 p-1.5 rounded hover:bg-muted/40 transition-colors opacity-0 group-hover:opacity-100 ${
                                                    isOwn ? 'text-primary-foreground' : 'text-primary'
                                                  }`}
                                                  title="Download"
                                                >
                                                  <FontAwesomeIcon icon={faDownload} className="text-sm" />
                                                </button>
                                              </div>
                                              
                                              {/* PDF Preview - Full Stretch */}
                                              <div className="relative bg-muted/30 w-full">
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
                                                <div className="absolute inset-0 bg-transparent group-hover:bg-muted/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
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
                                              className={`flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40 transition-colors ${
                                                isOwn ? 'bg-primary/10 border-primary/20' : 'bg-muted/30'
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
                                                <p className={`text-sm font-medium truncate ${isOwn ? 'text-primary-foreground' : 'text-foreground'}`}>
                                                  {fileName}
                                                </p>
                                                <p className={`text-xs ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                                  Click to preview or download
                                                </p>
                                              </div>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleDownloadFile(fileUrl, fileName)
                                                }}
                                                className={`flex-shrink-0 p-1.5 rounded hover:bg-muted/40 transition-colors ${
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

                                {/* Fraud flag (shadcn UI) */}
                                {((message as any).isFraud || (message as any).fraud) && (
                                  <Alert
                                    variant={isOwn ? "default" : "destructive"}
                                    className={`mt-2 rounded-xl border px-3 py-2 ${
                                      isOwn
                                        ? 'border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground'
                                        : 'border-destructive/25 bg-destructive/10'
                                    }`}
                                  >
                                    <div className="flex items-start gap-2">
                                      <Badge
                                        variant={isOwn ? "secondary" : "destructive"}
                                        className={`h-5 px-2 text-[10px] tracking-wide ${
                                          isOwn
                                            ? 'border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground'
                                            : 'bg-destructive text-destructive-foreground'
                                        }`}
                                      >
                                        FRAUD
                                      </Badge>
                                      <div className="min-w-0">
                                        <AlertTitle className={`text-[11px] ${isOwn ? 'text-primary-foreground' : ''}`}>
                                          This message was flagged by fraud detection
                                        </AlertTitle>
                                        {fraudReason ? (
                                          <AlertDescription className={`text-[11px] ${isOwn ? 'text-primary-foreground/75' : ''}`}>
                                            {fraudReason}
                                          </AlertDescription>
                                        ) : null}
                                        {hideContentForViewer && (
                                          <AlertDescription className={`text-[11px] ${isOwn ? 'text-primary-foreground/75' : ''}`}>
                                            Message content is hidden for your safety.
                                          </AlertDescription>
                                        )}
                                      </div>
                                    </div>
                                  </Alert>
                                )}

                                {/* Timestamp and Read Status */}
                                <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                  <span className={`text-[10px] ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
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
                              <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                                {itemDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                              </div>
                            </div>
                          )}
                          <div className={`flex items-end gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[65%]`}>
                              <div
                                className={`relative px-4 py-3 rounded-2xl ${isOwn
                                  ? 'bg-primary/10 border border-primary/20 text-foreground rounded-tr-sm'
                                  : 'glass-card text-foreground rounded-tl-sm'
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
                                <div className="flex items-center justify-between pt-2 border-t border-border">
                                  <span className="text-lg font-bold text-primary">${Number(milestone.balance).toFixed(2)}</span>
                                  <span className={`text-[10px] ${isOwn ? 'text-primary' : 'text-muted-foreground'}`}>
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
                              <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                                {itemDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                              </div>
                            </div>
                          )}
                          <div className={`flex items-end gap-2 mb-1 ${paymentIsOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`flex flex-col ${paymentIsOwn ? 'items-end' : 'items-start'} max-w-[65%]`}>
                              <div className={`relative px-4 py-3 rounded-2xl bg-muted/40 border border-border text-foreground shadow-lg ${
                                paymentIsOwn ? 'rounded-tr-sm' : 'rounded-tl-sm'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">Payment Pending</span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                    {isClient ? 'WAITING FOR PROVIDER' : 'ACTION REQUIRED'}
                                  </span>
                                </div>
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                                    <FontAwesomeIcon icon={faMoneyBillWave} className="text-primary text-lg" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold mb-1 text-base text-foreground">
                                      {isClient ? 'Payment Released - Awaiting Provider Acceptance' : 'Payment Pending Acceptance'}
                                    </h4>
                                    <p className="text-sm mb-2 opacity-90 leading-relaxed text-muted-foreground">
                                      {isClient ? (
                                        <>
                                          You have released payment for milestone: <span className="font-semibold text-foreground">{milestone.title}</span>. Waiting for provider to accept.
                                        </>
                                      ) : (
                                        <>
                                          Client has released payment for milestone: <span className="font-semibold text-foreground">{milestone.title}</span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 mb-3 p-2 rounded-lg bg-muted/30">
                                  <div>
                                    <span className="text-muted-foreground text-xs block mb-1">Amount</span>
                                    <p className="text-primary font-bold text-xl">${Number(payment.amount).toFixed(2)}</p>
                                  </div>
                                  <div className="h-8 w-px bg-border"></div>
                                  <div>
                                    <span className="text-muted-foreground text-xs block mb-1">Milestone</span>
                                    <p className="text-foreground font-semibold text-sm">{milestone.title}</p>
                                  </div>
                                </div>
                                {!isClient && (
                                  <div className="flex gap-2 pt-2 border-t border-border">
                                    <button
                                      onClick={() => handleAcceptPayment(payment.id, milestone.id)}
                                      disabled={acceptingPayment === payment.id}
                                      className="flex-1 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
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
                                  <div className="pt-2 border-t border-border">
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
                                      <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                      <span>Waiting for provider to accept payment...</span>
                                    </div>
                                  </div>
                                )}
                                <div className={`flex items-center mt-2 ${paymentIsOwn ? 'justify-start' : 'justify-end'}`}>
                                  <span className="text-[10px] text-muted-foreground">
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
                              <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                                {itemDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                              </div>
                            </div>
                          )}
                          <div className={`flex items-end gap-2 mb-1 ${paymentIsOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`flex flex-col ${paymentIsOwn ? 'items-end' : 'items-start'} max-w-[65%]`}>
                              <div className={`relative px-4 py-3 rounded-2xl bg-muted/40 border border-border text-foreground shadow-lg ${
                                paymentIsOwn ? 'rounded-tr-sm' : 'rounded-tl-sm'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Payment Successful</span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    COMPLETED
                                  </span>
                                </div>
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                                    <FontAwesomeIcon icon={faCheckCircle} className="text-primary text-lg" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold mb-1 text-base text-foreground">
                                      {isClient ? 'Payment Completed Successfully' : 'Payment Received Successfully'}
                                    </h4>
                                    <p className="text-sm mb-2 opacity-90 leading-relaxed text-muted-foreground">
                                      {isClient ? (
                                        <>
                                          Provider has accepted your payment for milestone: <span className="font-semibold text-foreground">{milestone.title}</span>
                                        </>
                                      ) : (
                                        <>
                                          You have successfully received payment for milestone: <span className="font-semibold text-foreground">{milestone.title}</span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 mb-3 p-2 rounded-lg bg-muted/30">
                                  <div>
                                    <span className="text-muted-foreground text-xs block mb-1">Amount</span>
                                    <p className="text-emerald-400 font-bold text-xl">${Number(payment.amount).toFixed(2)}</p>
                                  </div>
                                  <div className="h-8 w-px bg-border"></div>
                                  <div>
                                    <span className="text-muted-foreground text-xs block mb-1">Milestone</span>
                                    <p className="text-foreground font-semibold text-sm">{milestone.title}</p>
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-border">
                                  <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs">
                                    <FontAwesomeIcon icon={faCheckCircle} />
                                    <span>Payment processed successfully</span>
                                  </div>
                                </div>
                                <div className={`flex items-center mt-2 ${paymentIsOwn ? 'justify-start' : 'justify-end'}`}>
                                  <span className="text-[10px] text-muted-foreground">
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
            <div className="glass-card border-t border-border px-4 py-3 flex-shrink-0 relative">
              {/* Blocked banner */}
              {isBlocked && (
                <div className="mb-3 p-3 rounded-xl border border-red-500/30 bg-red-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-sm">
                    <div className="text-red-200 font-medium">Conversation blocked</div>
                    <div className="text-red-200/80">
                      Messaging is disabled due to fraud detections. You can request reactivation from the admin.
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleRequestReactivation}
                    disabled={requestingReactivation || reactivationPending}
                    variant={reactivationPending ? "secondary" : "default"}
                  >
                    {reactivationPending ? "Request pending" : requestingReactivation ? "Sending..." : "Request reactivation"}
                  </Button>
                </div>
              )}

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
                      <span className="text-foreground text-xs truncate max-w-[150px]">{file.name}</span>
                      <span className="text-muted-foreground text-xs">{formatFileSize(file.size)}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-1"
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
                  disabled={isBlocked}
                  className="text-muted-foreground hover:text-foreground transition-colors p-2 flex-shrink-0"
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
                    disabled={isBlocked}
                    className="w-full glass-card text-foreground rounded-2xl px-4 py-2.5 pr-12 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 resize-none max-h-32 overflow-y-auto placeholder:text-muted-foreground text-sm leading-5"
                    style={{ minHeight: '42px', maxHeight: '128px' }}
                  />
                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      disabled={isBlocked}
                      className="text-muted-foreground hover:text-foreground transition-colors p-2 absolute right-1 bottom-1"
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
                              className="text-2xl hover:bg-muted/40 rounded p-1 transition-colors"
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
                  disabled={isBlocked || (!messageText.trim() && selectedFiles.length === 0) || sending || uploadingFiles}
                  className={`p-2.5 rounded-full flex-shrink-0 transition-all ${(messageText.trim() || selectedFiles.length > 0)
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow-primary'
                    : 'glass-card text-muted-foreground cursor-not-allowed'
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
          <div className="w-80 glass-card border-l border-border flex flex-col flex-shrink-0 min-h-0">
            <div className="p-4 border-b border-border flex-shrink-0 h-[64px]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Milestones</h3>
                {isClient && (
                  <Dialog
                    open={showMilestoneForm}
                    onOpenChange={(open) => {
                      setShowMilestoneForm(open)
                      if (!open) setMilestoneForm({ title: "", description: "", balance: "" })
                    }}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-primary hover:text-primary/80"
                      onClick={() => setShowMilestoneForm(true)}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                    </Button>

                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Create milestone</DialogTitle>
                        <DialogDescription>
                          Add a milestone for this service. The provider can accept and complete it.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="milestone-title">Title</Label>
                          <Input
                            id="milestone-title"
                            value={milestoneForm.title}
                            onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                            placeholder="e.g. Design homepage"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="milestone-description">Description</Label>
                          <Textarea
                            id="milestone-description"
                            value={milestoneForm.description}
                            onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                            placeholder="Describe what will be delivered..."
                            rows={4}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="milestone-balance">Amount (USD)</Label>
                          <Input
                            id="milestone-balance"
                            type="number"
                            inputMode="decimal"
                            value={milestoneForm.balance}
                            onChange={(e) => setMilestoneForm({ ...milestoneForm, balance: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <Separator />

                      <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowMilestoneForm(false)
                            setMilestoneForm({ title: "", description: "", balance: "" })
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={handleCreateMilestone}
                          disabled={!milestoneForm.title || !milestoneForm.description || !milestoneForm.balance}
                        >
                          Create milestone
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {milestones.length === 0 ? (
                <p className="text-muted-foreground text-center text-sm py-8">No milestones yet</p>
              ) : (
                milestones.map((milestone) => (
                  <div key={milestone.id} className="glass-card rounded-xl p-4 space-y-3 hover:border-primary/20 transition-colors">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-foreground text-sm">{milestone.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${getStatusColor(milestone.status)}`}>
                        {milestone.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{milestone.description}</p>
                    {milestone.feedback && milestone.rating && (
                      <div className="pt-2 border-t border-border space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Rating:</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={`text-sm ${
                                  star <= milestone.rating! ? 'text-yellow-400' : 'text-muted-foreground'
                                }`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground italic">"{milestone.feedback}"</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
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
                              className="flex-1 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
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
                                className="flex-1 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <FontAwesomeIcon icon={faCheckCircle} className="text-xs" />
                                Complete
                              </button>
                              <button
                                onClick={() => handleMilestoneAction(milestone.id, 'withdraw')}
                                disabled={updatingMilestone === milestone.id}
                                className="flex-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-yellow-500/15 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
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
                                className="flex-1 bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-purple-500/15 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <FontAwesomeIcon icon={faCheckCircle} className="text-xs" />
                                Release
                              </button>
                              <button
                                onClick={() => handleMilestoneAction(milestone.id, 'dispute')}
                                disabled={updatingMilestone === milestone.id}
                                className="flex-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-yellow-500/15 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
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
                              className="flex-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-yellow-500/15 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
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
                              className="flex-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-yellow-500/15 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
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
            <h2 className="text-xl font-bold text-foreground mb-4">
              {(() => {
                const milestone = milestones.find(m => m.id === releaseForm.milestoneId)
                const isAdminReleased = milestone?.status === 'released' && !milestone?.feedback
                return isAdminReleased ? 'Provide Feedback' : 'Release Milestone'
              })()}
            </h2>
            <p className="text-muted-foreground text-sm mb-4">
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
              <label className="block text-sm font-medium text-foreground mb-2">
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
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
              {releaseForm.rating > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{releaseForm.rating} star{releaseForm.rating !== 1 ? 's' : ''} selected</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Feedback *
              </label>
              <textarea
                value={releaseForm.feedback}
                onChange={(e) => setReleaseForm({ ...releaseForm, feedback: e.target.value })}
                placeholder="Share your experience with this milestone..."
                className="w-full glass-card text-foreground rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 placeholder:text-muted-foreground text-sm resize-none"
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
              className="flex-1 glass-card text-foreground px-4 py-2 rounded-full font-semibold hover:bg-muted/40 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FontAwesomeIcon
                  icon={getFileIcon(previewFile.name)}
                  className="text-primary text-xl flex-shrink-0"
                />
                <h3 className="text-foreground font-semibold truncate">{previewFile.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadFile(previewFile.url, previewFile.name)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-2"
                  title="Download"
                >
                  <FontAwesomeIcon icon={faDownload} />
                </button>
                <button
                  onClick={closePreview}
                  className="text-muted-foreground hover:text-destructive transition-colors p-2"
                  title="Close"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/30">
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
                    <p className="text-foreground font-semibold">{previewFile.name}</p>
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
                  <p className="text-foreground font-semibold mb-2">{previewFile.name}</p>
                  <p className="text-muted-foreground text-sm mb-4">Preview not available for this file type</p>
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

