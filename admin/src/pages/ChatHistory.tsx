import { useEffect, useState } from "react"
import { adminApi } from "../services/api"
import { showToast } from "../utils/toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { MessageSquare, Search, Mail, Calendar, User, Eye, Ban, CheckCircle2 } from "lucide-react"
import { useNavigate } from "react-router-dom"

function formatDate(d?: string | null) {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleString()
  } catch {
    return String(d)
  }
}

function getUserName(user: any) {
  if (!user) return "—"
  const full = `${user.firstName || ""} ${user.lastName || ""}`.trim()
  return full || user.userName || user.email || user.id
}

interface ChatHistoryItem {
  id: string
  serviceId: string
  service?: {
    id: string
    title: string
  }
  clientId: string
  client?: {
    id: string
    email: string
    userName?: string
    firstName?: string
    lastName?: string
    avatar?: string
  }
  providerId: string
  provider?: {
    id: string
    email: string
    userName?: string
    firstName?: string
    lastName?: string
    avatar?: string
  }
  isBlocked: boolean
  blockedAt?: string
  blockedReason?: string
  messageCount: number
  unreviewedFraudCount?: number
  lastMessage?: {
    id: string
    message: string
    senderId: string
    sender?: {
      id: string
      email: string
      userName?: string
      firstName?: string
      lastName?: string
    }
    createdAt: string
  }
  createdAt: string
  updatedAt: string
}

export default function ChatHistory() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<ChatHistoryItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [itemsPerPage] = useState(20)
  const [selectedConversation, setSelectedConversation] = useState<ChatHistoryItem | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messagesDialogOpen, setMessagesDialogOpen] = useState(false)
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [conversationToBlock, setConversationToBlock] = useState<string | null>(null)

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
  }, [itemsPerPage])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchChatHistory()
    }, searchTerm ? 500 : 0)
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm, itemsPerPage])

  const fetchChatHistory = async () => {
    try {
      setLoading(true)
      const response = await adminApi.getChatHistory({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm || undefined,
      })
      setConversations(response.data)
      setTotal(response.total)
      setTotalPages(response.totalPages)
    } catch (error: any) {
      console.error("Failed to fetch chat history:", error)
      showToast.error(error.response?.data?.message || "Failed to load chat history")
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (conversationId: string) => {
    try {
      setLoadingMessages(true)
      const response = await adminApi.getConversationMessages(conversationId, {
        page: 1,
        limit: 500, // Get all messages
      })
      setMessages(response.data)
    } catch (error: any) {
      console.error("Failed to fetch messages:", error)
      showToast.error(error.response?.data?.message || "Failed to load messages")
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleViewMessages = async (conversation: ChatHistoryItem) => {
    setSelectedConversation(conversation)
    setMessagesDialogOpen(true)
    await fetchMessages(conversation.id)
  }

  const handleViewChat = (conversationId: string) => {
    navigate(`/chat/${conversationId}`)
  }

  const handleMarkAsReviewed = async (conversationId: string) => {
    try {
      await adminApi.markFraudAsReviewed(conversationId)
      showToast.success('Fraud marked as reviewed')
      // Refresh the data to update the badge
      await fetchChatHistory()
    } catch (error: any) {
      console.error('Failed to mark fraud as reviewed:', error)
      showToast.error(error.response?.data?.message || 'Failed to mark as reviewed')
    }
  }

  const handleBlockConversation = (conversationId: string) => {
    setConversationToBlock(conversationId)
    setBlockDialogOpen(true)
  }

  const confirmBlockConversation = async () => {
    if (!conversationToBlock) return
    try {
      await adminApi.blockConversation(conversationToBlock)
      showToast.success('Conversation blocked and fraud marked as reviewed')
      setBlockDialogOpen(false)
      setConversationToBlock(null)
      // Refresh the data to update the badge
      await fetchChatHistory()
    } catch (error: any) {
      console.error('Failed to block conversation:', error)
      showToast.error(error.response?.data?.message || 'Failed to block conversation')
    }
  }

  const { pages } = (() => {
    const pageCount = totalPages
    const current = currentPage
    const delta = 2
    const range = []
    const rangeWithDots = []

    for (let i = Math.max(2, current - delta); i <= Math.min(pageCount - 1, current + delta); i++) {
      range.push(i)
    }

    if (current - delta > 2) {
      rangeWithDots.push(1, "...")
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (current + delta < pageCount - 1) {
      rangeWithDots.push("...", pageCount)
    } else {
      rangeWithDots.push(pageCount)
    }

    return {
      pages: rangeWithDots.filter((p) => p !== 1 || pageCount === 1 ? true : current !== 1),
    }
  })()

  const startItem = total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, total)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <MessageSquare className="w-7 h-7" />
            Chat History
          </h1>
          <p className="text-muted-foreground">
            View all chat conversations and messages between users.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by service, user..."
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchChatHistory}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>All Conversations</CardTitle>
            <CardDescription>
              Showing {startItem} to {endItem} of {total} conversations
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No conversations found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Last Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversations.map((conv) => (
                    <TableRow key={conv.id}>
                      <TableCell>
                        <div className="font-medium">
                          {conv.service?.title || "Unknown Service"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{getUserName(conv.client)}</span>
                          {conv.client?.email && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {conv.client.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{getUserName(conv.provider)}</span>
                          {conv.provider?.email && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {conv.provider.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{conv.messageCount}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {conv.lastMessage ? (
                          <div className="text-sm">
                            <div className="truncate">{conv.lastMessage.message}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <User className="h-3 w-3" />
                              {getUserName(conv.lastMessage.sender)}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(conv.lastMessage.createdAt)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No messages</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {conv.isBlocked ? (
                            <Badge variant="destructive" className="gap-1">
                              <Ban className="h-3 w-3" />
                              Blocked
                            </Badge>
                          ) : (
                            <Badge variant="default">Active</Badge>
                          )}
                          {conv.unreviewedFraudCount && conv.unreviewedFraudCount > 0 && (
                            <div className="flex items-center gap-1">
                              <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600 text-white">
                                {conv.unreviewedFraudCount} needs review
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => handleMarkAsReviewed(conv.id)}
                                title="Mark as reviewed"
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => handleBlockConversation(conv.id)}
                                title="Block conversation and mark as reviewed"
                              >
                                <Ban className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(conv.updatedAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewMessages(conv)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Messages
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleViewChat(conv.id)}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Open Chat
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {totalPages > 1 && (
          <CardContent>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {pages.map((page, index) => (
                  <PaginationItem key={index}>
                    {page === "..." ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        onClick={() => setCurrentPage(page as number)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardContent>
        )}
      </Card>

      <Dialog open={messagesDialogOpen} onOpenChange={setMessagesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Messages - {selectedConversation?.service?.title || "Conversation"}
            </DialogTitle>
            <DialogDescription>
              Client: {getUserName(selectedConversation?.client)} | Provider: {getUserName(selectedConversation?.provider)}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            {loadingMessages ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No messages found.
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isAdmin = selectedConversation && 
                    message.senderId !== selectedConversation.clientId && 
                    message.senderId !== selectedConversation.providerId
                  
                  return (
                    <div key={message.id}>
                      <div className={`rounded-lg border p-4 ${
                        isAdmin 
                          ? 'bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-300 dark:border-purple-700 shadow-md' 
                          : 'bg-muted/30'
                      }`}>
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-2">
                            <User className={`h-4 w-4 ${isAdmin ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`} />
                            <span className={`font-medium ${isAdmin ? 'text-purple-700 dark:text-purple-300' : ''}`}>
                              {isAdmin ? (
                                <span className="flex items-center gap-1">
                                  <span>👤</span>
                                  <span>Admin</span>
                                </span>
                              ) : (
                                getUserName(message.sender)
                              )}
                            </span>
                            {!isAdmin && message.sender?.email && (
                              <span className="text-xs text-muted-foreground">
                                ({message.sender.email})
                              </span>
                            )}
                          </div>
                          <div className={`text-xs flex items-center gap-1 ${isAdmin ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}>
                            <Calendar className="h-3 w-3" />
                            {formatDate(message.createdAt)}
                          </div>
                        </div>
                        <div className={`text-sm whitespace-pre-wrap break-words ${isAdmin ? 'text-purple-900 dark:text-purple-100' : ''}`}>
                          {message.message}
                        </div>
                        {message.attachmentFiles && message.attachmentFiles.length > 0 && (
                          <div className={`mt-2 text-xs ${isAdmin ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}>
                            Attachments: {message.attachmentFiles.length}
                          </div>
                        )}
                        {message.readAt && (
                          <div className={`mt-2 text-xs ${isAdmin ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}>
                            Read at: {formatDate(message.readAt)}
                          </div>
                        )}
                      </div>
                      {index < messages.length - 1 && <Separator className="my-2" />}
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Block Conversation Confirmation Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to block this conversation? This will mark all unreviewed fraud messages as reviewed and block the conversation. Users will not be able to send messages until the conversation is reactivated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBlockDialogOpen(false)
                setConversationToBlock(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBlockConversation}
            >
              Block Conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

