import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faSpinner,
  faPaperPlane,
  faCheckCircle,
  faDownload,
  faFile,
  faImage,
  faFilePdf,
  faFileWord,
  faFileExcel,
  faFileArchive,
  faTimes,
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
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (id) {
      fetchConversation()
      fetchMessages(50) // Load latest 50 messages
      fetchMilestones()
      setHasMoreMessages(true) // Reset hasMore when conversation changes
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

  const fetchMessages = async (limit: number = 50, before?: string) => {
    if (!id) return
    try {
      const data = await messageApi.getByConversation(id, limit, before)
      if (before) {
        // Loading older messages - prepend to existing messages and preserve scroll position
        const container = messagesContainerRef.current?.parentElement
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
    } catch (error: any) {
      console.error('Failed to fetch messages:', error)
      showToast.error('Failed to load messages')
    } finally {
      setLoading(false)
    }
  }

  const loadMoreMessages = async () => {
    if (loadingMoreMessages || !hasMoreMessages || messages.length === 0 || !id) return

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
      // Refresh messages to get the new one
      const data = await messageApi.getByConversation(id, 50)
      setMessages(data.messages)
      setHasMoreMessages(data.hasMore)
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
    if (messagesEndRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current.parentElement
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
        // Only auto-scroll if user is near bottom
        if (isNearBottom || messages.length <= 50) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      }
    }
  }

  const getUserName = (user?: { firstName?: string; lastName?: string; userName?: string; email?: string }) => {
    if (!user) return 'Unknown'
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim()
    }
    return user.userName || user.email || 'Unknown'
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
            <p className="text-neutral-300">
              {getUserName(conversation.client)} ↔ {getUserName(conversation.provider)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="glass-card p-4 mb-4" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
            <div
              className="flex-1 overflow-y-auto mb-4 space-y-4"
              ref={messagesContainerRef}
              onScroll={(e) => {
                const target = e.currentTarget
                // Load more when scrolled to top (within 100px)
                if (target.scrollTop < 100 && hasMoreMessages && !loadingMoreMessages) {
                  loadMoreMessages()
                }
              }}
            >
              {/* Loading indicator for older messages */}
              {loadingMoreMessages && (
                <div className="flex justify-center py-4">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-primary text-xl" />
                </div>
              )}
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
                      <div className="text-xs text-neutral-300 mb-1">
                        {isAdmin ? '👤 Admin' : getUserName(message.sender)}
                      </div>
                      {message.message && (
                        <div className="whitespace-pre-wrap mb-2">{message.message}</div>
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
                                    className="cursor-pointer group relative overflow-hidden rounded-lg"
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
                                        className="p-2 rounded-full backdrop-blur-sm bg-white/80 text-primary hover:scale-110 transition-transform"
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
                                      <p className="text-xs truncate flex-1 text-white/80">
                                        {fileName}
                                      </p>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDownloadFile(fileUrl, fileName)
                                        }}
                                        className="flex-shrink-0 p-1 rounded hover:bg-white/20 transition-colors ml-2 text-primary"
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
                                    className="p-3 rounded-lg border border-white/10 cursor-pointer hover:bg-white/5 transition-colors bg-white/5"
                                    onClick={() => handlePreviewFile(fileUrl, fileName)}
                                  >
                                    <div className="flex items-center gap-3 mb-2">
                                      <FontAwesomeIcon
                                        icon={getFileIcon(fileName)}
                                        className="text-2xl text-primary"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate text-white">
                                          {fileName}
                                        </p>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDownloadFile(fileUrl, fileName)
                                        }}
                                        className="flex-shrink-0 p-1.5 rounded hover:bg-white/20 transition-colors text-primary"
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
                                    className="rounded-lg overflow-hidden border border-white/10 cursor-pointer group hover:border-primary/50 transition-all"
                                    onClick={() => handlePreviewFile(fileUrl, fileName)}
                                  >
                                    {/* Header with file info */}
                                    <div className="px-3 py-2.5 flex items-center gap-3 bg-white/5">
                                      <FontAwesomeIcon
                                        icon={getFileIcon(fileName)}
                                        className="text-lg flex-shrink-0 text-primary"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate text-white">
                                          {fileName}
                                        </p>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDownloadFile(fileUrl, fileName)
                                        }}
                                        className="flex-shrink-0 p-1.5 rounded hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100 text-primary"
                                        title="Download"
                                      >
                                        <FontAwesomeIcon icon={faDownload} className="text-sm" />
                                      </button>
                                    </div>
                                    
                                    {/* PDF Preview - Full Stretch */}
                                    <div className="relative bg-neutral-900/50 w-full">
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
                                        <div className="px-4 py-2 rounded-full backdrop-blur-sm bg-white/80 text-primary">
                                          <span className="text-sm font-medium">Click to view full PDF</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Other Files */}
                                {!isImage && !isVideo && !isAudio && !isPdf && (
                                  <div
                                    className="flex items-center gap-3 p-3 rounded-lg border border-white/10 cursor-pointer hover:bg-white/5 transition-colors bg-white/5"
                                    onClick={() => handlePreviewFile(fileUrl, fileName)}
                                  >
                                    <div className="flex-shrink-0">
                                      <FontAwesomeIcon
                                        icon={getFileIcon(fileName)}
                                        className="text-2xl text-primary"
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate text-white">
                                        {fileName}
                                      </p>
                                      <p className="text-xs text-neutral-400">
                                        Click to preview or download
                                      </p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDownloadFile(fileUrl, fileName)
                                      }}
                                      className="flex-shrink-0 p-1.5 rounded hover:bg-white/20 transition-colors text-primary"
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
                      
                      <div className="text-xs text-neutral-400 mt-1">
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
                className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-neutral-400 focus:outline-none focus:border-primary"
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
              <p className="text-neutral-300">No disputed milestones</p>
            ) : (
              <div className="space-y-4">
                {disputedMilestones.map((milestone) => (
                  <div key={milestone.id} className="bg-black/20 p-4 rounded-lg border border-white/10">
                    <h3 className="text-white font-semibold mb-2">{milestone.title}</h3>
                    <p className="text-neutral-300 text-sm mb-2">{milestone.description}</p>
                    <div className="text-neutral-300 text-sm mb-3">
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
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-neutral-400 focus:outline-none focus:border-primary"
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
                  className="text-neutral-400 hover:text-primary transition-colors p-2"
                  title="Download"
                >
                  <FontAwesomeIcon icon={faDownload} />
                </button>
                <button
                  onClick={closePreview}
                  className="text-neutral-400 hover:text-red-400 transition-colors p-2"
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
                  <p className="text-neutral-400 text-sm mb-4">Preview not available for this file type</p>
                  <button
                    onClick={() => handleDownloadFile(previewFile.url, previewFile.name)}
                    className="bg-primary text-white px-6 py-2 rounded-full font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto"
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

