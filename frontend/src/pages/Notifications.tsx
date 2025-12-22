import { useEffect, useMemo, useRef, useState } from "react"
import { notificationApi, Notification } from "../services/api"
import { getSocket } from "../services/socket"
import type { Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell, Check, CheckCheck, Dot, Loader2, Trash2 } from "lucide-react"

function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [tab, setTab] = useState<"all" | "unread">("all")
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    fetchNotifications()

    // Set up WebSocket listener
    const socket = getSocket()
    if (socket) {
      socketRef.current = socket

      const handleNewNotification = (notification: Notification) => {
        setNotifications((prev) => [notification, ...prev])
        setUnreadCount((prev) => prev + 1)
      }

      const handleNotificationRead = async () => {
        // Refresh notifications to get updated readAt from server
        await fetchNotifications(1, false)
        const countResponse = await notificationApi.getUnreadCount()
        setUnreadCount(countResponse.count)
      }

      const handleAllNotificationsRead = async () => {
        // Refresh notifications to get updated readAt from server
        await fetchNotifications(1, false)
        const countResponse = await notificationApi.getUnreadCount()
        setUnreadCount(countResponse.count)
      }

      const handleNotificationDeleted = async (data: { notificationId: string }) => {
        // Remove from local state immediately for instant feedback
        setNotifications((prev) => prev.filter((notif) => notif.id !== data.notificationId))
        // Refresh the notifications list to ensure consistency, especially with pagination
        await fetchNotifications(1, false)
        // Refresh unread count after deletion
        const countResponse = await notificationApi.getUnreadCount()
        setUnreadCount(countResponse.count)
      }

      socket.on("new_notification", handleNewNotification)
      socket.on("notification_read", handleNotificationRead)
      socket.on("all_notifications_read", handleAllNotificationsRead)
      socket.on("notification_deleted", handleNotificationDeleted)

      return () => {
        socket.off("new_notification", handleNewNotification)
        socket.off("notification_read", handleNotificationRead)
        socket.off("all_notifications_read", handleAllNotificationsRead)
        socket.off("notification_deleted", handleNotificationDeleted)
      }
    }
  }, [])

  const fetchNotifications = async (pageNum: number = 1, append: boolean = false) => {
    setLoading(true)
    try {
      const response = await notificationApi.getAll({ page: pageNum, limit: 20 })
      if (append) {
        setNotifications((prev) => [...prev, ...response.data])
      } else {
        setNotifications(response.data)
      }
      setUnreadCount(response.unreadCount)
      setHasMore(pageNum < response.totalPages)
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchNotifications(nextPage, true)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const updatedNotification = await notificationApi.markAsRead(notificationId)
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? updatedNotification : notif
        )
      )
      // Refresh unread count
      const countResponse = await notificationApi.getUnreadCount()
      setUnreadCount(countResponse.count)
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead()
      // Refresh notifications and unread count
      setPage(1)
      await fetchNotifications(1, false)
      const countResponse = await notificationApi.getUnreadCount()
      setUnreadCount(countResponse.count)
    } catch (error) {
      console.error("Failed to mark all as read:", error)
    }
  }

  const handleDelete = async (notificationId: string) => {
    try {
      await notificationApi.delete(notificationId)
      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId))
      // Refresh unread count after deletion
      const countResponse = await notificationApi.getUnreadCount()
      setUnreadCount(countResponse.count)
    } catch (error) {
      console.error("Failed to delete notification:", error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const filteredNotifications = useMemo(() => {
    if (tab === "unread") return notifications.filter((n) => !n.readAt)
    return notifications
  }, [notifications, tab])

  const unreadInList = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications])

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold tracking-tight">Notifications</div>
            {unreadCount > 0 ? (
              <div className="text-sm text-muted-foreground">
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">You’re all caught up.</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">
                Unread {unreadInList > 0 ? <Badge variant="secondary" className="ml-2 h-5 px-2 text-[10px]">{unreadInList}</Badge> : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            type="button"
            variant="outline"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || loading}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Mark all read
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Inbox</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && notifications.length === 0 ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-10 text-center">
              <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
              <div className="pt-3 text-sm text-muted-foreground">
                {tab === "unread" ? "No unread notifications." : "No notifications yet."}
              </div>
            </div>
          ) : (
            <ScrollArea className="max-h-[70vh]">
              <div className="divide-y">
                {filteredNotifications.map((notification) => {
                  const isUnread = !notification.readAt
                  return (
                    <div
                      key={notification.id}
                      className={["flex gap-4 p-4 sm:p-5", isUnread ? "bg-primary/5" : ""].join(" ")}
                    >
                      <div className="pt-0.5">
                        {isUnread ? <Dot className="h-8 w-8 text-primary" /> : <Dot className="h-8 w-8 text-muted-foreground/30" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="truncate text-sm font-semibold text-foreground">{notification.title}</div>
                              {isUnread ? <Badge variant="secondary">New</Badge> : null}
                            </div>
                            <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {notification.message}
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">{formatDate(notification.createdAt)}</div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            {isUnread ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => handleMarkAsRead(notification.id)}
                                title="Mark as read"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(notification.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {hasMore ? (
                <>
                  <Separator />
                  <div className="flex justify-center p-4">
                    <Button type="button" variant="outline" onClick={handleLoadMore} disabled={loading} className="gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {loading ? "Loading..." : "Load more"}
                    </Button>
                  </div>
                </>
              ) : null}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Notifications

