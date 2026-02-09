import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { conversationApi, messageApi, Conversation, Message } from "../services/api"
import { useAppSelector } from "../store/hooks"
import { getSocket } from "../services/socket"
import { Socket } from "socket.io-client"
import Chat from "./Chat"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, Loader2, MessageSquareText, Search } from "lucide-react"

interface ConversationWithLastMessage extends Conversation {
  lastMessage?: Message
  unreadCount?: number
  otherUser?: {
    id: string
    firstName?: string
    lastName?: string
    userName?: string
    avatar?: string
  }
}

function ChatList() {
  const navigate = useNavigate()
  const { id: selectedConversationId } = useParams<{ id?: string }>()
  const { user } = useAppSelector((state) => state.auth)
  const [conversations, setConversations] = useState<ConversationWithLastMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    fetchConversations()
    
    // Listen for conversation viewed event to clear unread count
    const handleConversationViewed = (event: CustomEvent) => {
      const { conversationId } = event.detail
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
        )
      )
    }
    
    window.addEventListener('conversation-viewed', handleConversationViewed as EventListener)
    
    return () => {
      window.removeEventListener('conversation-viewed', handleConversationViewed as EventListener)
    }
  }, [])

  // Set up socket separately so it can access current selectedConversationId
  useEffect(() => {
    const cleanup = setupSocket()
    return cleanup
  }, [selectedConversationId, user?.id])

  const setupSocket = () => {
    const socket = getSocket()
    if (!socket) return () => {}

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
          
          // Increment unread count if message is from another user and not currently viewing this conversation
          // Use current selectedConversationId from the closure
          const currentSelectedId = selectedConversationId
          const isFromOtherUser = message.senderId !== user?.id
          const isNotViewing = message.conversationId !== currentSelectedId
          const currentUnreadCount = typeof conv.unreadCount === 'number' ? conv.unreadCount : 0
          const newUnreadCount = isFromOtherUser && isNotViewing 
            ? currentUnreadCount + 1 
            : currentUnreadCount
          
          updated.unshift({
            ...conv,
            lastMessage: message,
            updatedAt: message.createdAt,
            unreadCount: newUnreadCount,
          })
        } else {
          // New conversation - add it with unread count if from other user
          const isFromOtherUser = message.senderId !== user?.id
          const currentSelectedId = selectedConversationId
          const isNotViewing = message.conversationId !== currentSelectedId
          updated.unshift({
            id: message.conversationId,
            lastMessage: message,
            updatedAt: message.createdAt,
            unreadCount: isFromOtherUser && isNotViewing ? 1 : 0,
          } as ConversationWithLastMessage)
        }
        
        return updated
      })
    }

    // Register the new_message handler
    socket.on('new_message', handleNewMessage)

    // Listen for user status changes
    const handleUserStatusChange = (data: { userId: string; isOnline: boolean; conversationId: string }) => {
      setOnlineUsers((prev) => {
        const updated = new Set(prev)
        if (data.isOnline) {
          updated.add(data.userId)
        } else {
          updated.delete(data.userId)
        }
        return updated
      })
    }

    socket.on('user_status_change', handleUserStatusChange)

    // Request initial online status for all conversation partners
    const requestOnlineStatus = () => {
      if (conversations.length > 0 && socket.connected) {
        const userIds = conversations
          .map((conv) => {
            const otherUserId = conv.clientId === user?.id ? conv.providerId : conv.clientId
            return otherUserId
          })
          .filter((id): id is string => Boolean(id))
        
        if (userIds.length > 0) {
          socket.emit('get_online_status', { userIds })
        }
      }
    }

    const handleOnlineStatusResponse = (statusMap: Record<string, boolean>) => {
      const onlineSet = new Set<string>()
      Object.entries(statusMap).forEach(([userId, isOnline]) => {
        if (isOnline) {
          onlineSet.add(userId)
        }
      })
      setOnlineUsers(onlineSet)
    }

    socket.on('online_status_response', handleOnlineStatusResponse)

    // Request status when socket connects and conversations are loaded
    const requestStatusWhenReady = () => {
      if (conversations.length > 0 && socket.connected) {
        requestOnlineStatus()
      }
    }

    // Request status immediately if socket is already connected and conversations are loaded
    if (conversations.length > 0 && socket.connected) {
      requestOnlineStatus()
    }

    // Request status when socket connects
    socket.on('connect', () => {
      requestStatusWhenReady()
    })

    // Request status when conversations are loaded (in case socket was already connected)
    if (conversations.length > 0) {
      requestStatusWhenReady()
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('new_message', handleNewMessage)
        socketRef.current.off('user_status_change', handleUserStatusChange)
        socketRef.current.off('online_status_response', handleOnlineStatusResponse)
        socketRef.current.off('connect', requestStatusWhenReady)
      }
    }
  }

  // Request online status when conversations are loaded
  useEffect(() => {
    const socket = socketRef.current
    if (socket && socket.connected && conversations.length > 0) {
      const userIds = conversations
        .map((conv) => {
          const otherUserId = conv.clientId === user?.id ? conv.providerId : conv.clientId
          return otherUserId
        })
        .filter((id): id is string => Boolean(id))
      
      if (userIds.length > 0) {
        socket.emit('get_online_status', { userIds })
      }
    }
  }, [conversations, user?.id])

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
            unreadCount: typeof conv.unreadCount === 'number' ? conv.unreadCount : (typeof (conv as any).unreadCount === 'number' ? (conv as any).unreadCount : 0),
            otherUser: otherUser ? {
              id: otherUser.id,
              firstName: otherUser.firstName,
              lastName: otherUser.lastName,
              userName: otherUser.userName,
              avatar: otherUser.avatar,
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
      if (userName) {
        return userName
      }
      if (firstName || lastName) {
        return `${firstName || ''} ${lastName || ''}`.trim()
      }
      return 'Unknown User'
    }
    return 'Unknown User'
  }

  const formatMessagePreview = (message?: Message): string => {
    if (!message) return 'No messages yet'
    if (message.message.length > 40) {
      return message.message.substring(0, 40) + '...'
    }
    return message.message
  }

  const formatServiceTitle = (title?: string): string => {
    if (!title) return ''
    const maxLength = 32
    if (title.length > maxLength) {
      return title.substring(0, maxLength) + '...'
    }
    return title
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

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId),
    [conversations, selectedConversationId]
  )

  const selectedTitle = selectedConversation ? getOtherUserName(selectedConversation) : "Messages"

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="grid h-full gap-4 md:grid-cols-[360px_1fr]">
        {/* Left: conversations */}
        <Card className={cn("h-full overflow-hidden", selectedConversationId ? "hidden md:flex md:flex-col" : "flex flex-col")}>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquareText className="h-4 w-4 text-primary" />
                Messages
              </CardTitle>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="pl-9"
              />
            </div>
          </CardHeader>
          <Separator />

          <ScrollArea className="flex-1">
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-1 p-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg p-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-3 w-56" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <MessageSquareText className="h-10 w-10 text-muted-foreground" />
                  <div className="mt-3 text-sm font-semibold">
                    {searchQuery ? "No conversations found" : "No conversations yet"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {searchQuery
                      ? "Try a different search term."
                      : "Start a conversation by connecting with a service provider."}
                  </div>
                </div>
              ) : (
                <div className="p-2">
                  {filteredConversations.map((conversation) => {
                    const otherUserName = getOtherUserName(conversation)
                    const unreadCount = conversation.unreadCount ?? 0
                    const isUnread = unreadCount > 0
                    const isSelected = conversation.id === selectedConversationId

                    return (
                      <button
                        key={conversation.id}
                        onClick={() => {
                          // Clear unread count when selecting conversation
                          if (isUnread) {
                            setConversations((prev) =>
                              prev.map((conv) =>
                                conv.id === conversation.id ? { ...conv, unreadCount: 0 } : conv
                              )
                            )
                          }
                          navigate(`/chat/${conversation.id}`)
                        }}
                        className={cn(
                          "w-full rounded-xl p-3 text-left transition-colors hover:bg-muted/40",
                          isSelected && "bg-muted/60",
                          isUnread && !isSelected && "bg-muted/20"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={conversation.otherUser?.avatar || undefined} alt={otherUserName} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {(otherUserName[0] || "U").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {(() => {
                              const otherUserId = conversation.clientId === user?.id ? conversation.providerId : conversation.clientId
                              return otherUserId && onlineUsers.has(otherUserId) ? (
                                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
                              ) : null
                            })()}
                          </div>

                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-start justify-between gap-2 min-w-0">
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className={cn("truncate text-sm font-semibold", isUnread && "text-foreground")}>
                                  {otherUserName}
                                </div>
                                {conversation.service?.title ? (
                                  <div className="truncate text-xs text-muted-foreground" title={conversation.service.title}>
                                    {formatServiceTitle(conversation.service.title)}
                                  </div>
                                ) : null}
                              </div>

                              <div className="flex shrink-0 flex-col items-end gap-1 ml-2">
                                {conversation.lastMessage ? (
                                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                    {formatTime(conversation.lastMessage.createdAt)}
                                  </span>
                                ) : null}
                                {(conversation.unreadCount ?? 0) > 0 ? (
                                  <Badge className="h-5 min-w-5 px-1.5 flex items-center justify-center text-[10px] font-semibold bg-primary text-primary-foreground shrink-0">
                                    {conversation.unreadCount! > 99 ? '99+' : conversation.unreadCount}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>

                            <div className={cn("mt-1 truncate text-xs", isUnread ? "text-foreground" : "text-muted-foreground")}>
                              {formatMessagePreview(conversation.lastMessage)}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Right: thread */}
        <Card className={cn("h-full overflow-hidden", selectedConversationId ? "flex flex-col" : "hidden md:flex md:flex-col")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => navigate("/chat")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{selectedConversationId ? selectedTitle : "Messages"}</CardTitle>
                <div className="text-xs text-muted-foreground">
                  {selectedConversationId ? "Conversation" : "Select a conversation to start chatting"}
                </div>
              </div>
            </div>
          </CardHeader>
          <Separator />

          <div className="flex-1 min-h-0">
            {selectedConversationId ? (
              <Chat />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div className="space-y-2">
                  <MessageSquareText className="mx-auto h-12 w-12 text-muted-foreground" />
                  <div className="text-sm font-semibold">Select a conversation</div>
                  <div className="text-xs text-muted-foreground">
                    Choose a conversation from the list to start chatting.
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default ChatList


