import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCheckDouble, faTrash, faBell } from '@fortawesome/free-solid-svg-icons';
import { notificationApi, Notification } from '../services/api';
import { getSocket } from '../services/socket';
import { Socket } from 'socket.io-client';

function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchNotifications();

    // Set up WebSocket listener
    const socket = getSocket();
    if (socket) {
      socketRef.current = socket;

      const handleNewNotification = (notification: Notification) => {
        setNotifications((prev) => [notification, ...prev]);
        setUnreadCount((prev) => prev + 1);
      };

      const handleNotificationRead = async () => {
        // Refresh notifications to get updated readAt from server
        await fetchNotifications(1, false);
        const countResponse = await notificationApi.getUnreadCount();
        setUnreadCount(countResponse.count);
      };

      const handleAllNotificationsRead = async () => {
        // Refresh notifications to get updated readAt from server
        await fetchNotifications(1, false);
        const countResponse = await notificationApi.getUnreadCount();
        setUnreadCount(countResponse.count);
      };

      const handleNotificationDeleted = async (data: { notificationId: string }) => {
        // Remove from local state immediately for instant feedback
        setNotifications((prev) => prev.filter((notif) => notif.id !== data.notificationId));
        // Refresh the notifications list to ensure consistency, especially with pagination
        await fetchNotifications(1, false);
        // Refresh unread count after deletion
        const countResponse = await notificationApi.getUnreadCount();
        setUnreadCount(countResponse.count);
      };

      socket.on('new_notification', handleNewNotification);
      socket.on('notification_read', handleNotificationRead);
      socket.on('all_notifications_read', handleAllNotificationsRead);
      socket.on('notification_deleted', handleNotificationDeleted);

      return () => {
        socket.off('new_notification', handleNewNotification);
        socket.off('notification_read', handleNotificationRead);
        socket.off('all_notifications_read', handleAllNotificationsRead);
        socket.off('notification_deleted', handleNotificationDeleted);
      };
    }
  }, []);

  const fetchNotifications = async (pageNum: number = 1, append: boolean = false) => {
    setLoading(true);
    try {
      const response = await notificationApi.getAll({ page: pageNum, limit: 20 });
      if (append) {
        setNotifications((prev) => [...prev, ...response.data]);
      } else {
        setNotifications(response.data);
      }
      setUnreadCount(response.unreadCount);
      setHasMore(pageNum < response.totalPages);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNotifications(nextPage, true);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const updatedNotification = await notificationApi.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? updatedNotification : notif
        )
      );
      // Refresh unread count
      const countResponse = await notificationApi.getUnreadCount();
      setUnreadCount(countResponse.count);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      // Refresh notifications and unread count
      await fetchNotifications(1, false);
      const countResponse = await notificationApi.getUnreadCount();
      setUnreadCount(countResponse.count);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await notificationApi.delete(notificationId);
      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
      // Refresh unread count after deletion
      const countResponse = await notificationApi.getUnreadCount();
      setUnreadCount(countResponse.count);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <FontAwesomeIcon icon={faBell} className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-slate-400 mt-1">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faCheckDouble} />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p>Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <FontAwesomeIcon icon={faBell} className="text-6xl text-slate-600 mb-4" />
            <p className="text-slate-400 text-lg">No notifications yet</p>
            <p className="text-slate-500 text-sm mt-2">You'll see notifications here when you receive them</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/10">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-6 hover:bg-white/5 transition-colors ${
                    !notification.readAt || notification.readAt === null ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base font-semibold text-white">
                          {notification.title}
                        </h3>
                        {(!notification.readAt || notification.readAt === null) && (
                          <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mb-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(!notification.readAt || notification.readAt === null) && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="p-2 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-white/5"
                          title="Mark as read"
                        >
                          <FontAwesomeIcon icon={faCheck} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-white/5"
                        title="Delete"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {hasMore && (
              <div className="p-4 border-t border-white/10 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Notifications;

