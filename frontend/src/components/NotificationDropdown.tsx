import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faCheck, faCheckDouble, faTrash, faTimes, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { notificationApi, Notification } from '../services/api';
import { getSocket } from '../services/socket';
import { Socket } from 'socket.io-client';

interface NotificationDropdownProps {
  userId: string;
}

function NotificationDropdown({ userId }: NotificationDropdownProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Fetch unread count first to ensure badge shows correct count
    fetchUnreadCount();
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
        await fetchNotifications();
        await fetchUnreadCount();
      };

      const handleAllNotificationsRead = async () => {
        // Refresh notifications to get updated readAt from server
        await fetchNotifications();
        await fetchUnreadCount();
      };

      const handleNotificationDeleted = (data: { notificationId: string }) => {
        setNotifications((prev) => prev.filter((notif) => notif.id !== data.notificationId));
        // Refresh unread count after deletion
        fetchUnreadCount();
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
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationApi.getAll({ page: 1, limit: 5 });
      setNotifications(response.data);
      // Don't update unreadCount from getAll response, use dedicated endpoint instead
      // This ensures we always have the accurate unread count
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationApi.getUnreadCount();
      setUnreadCount(response.count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
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
      await fetchUnreadCount();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      // Refresh notifications and unread count
      await fetchNotifications();
      await fetchUnreadCount();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await notificationApi.delete(notificationId);
      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
      // Refresh unread count after deletion
      await fetchUnreadCount();
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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <FontAwesomeIcon icon={faBell} className="text-xl" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 md:w-96 backdrop-blur-xl bg-[rgba(13,17,28,0.95)] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-[500px] flex flex-col">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <FontAwesomeIcon icon={faCheckDouble} className="text-xs" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No notifications</div>
            ) : (
              <div className="divide-y divide-white/10">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-white/5 transition-colors ${
                      !notification.readAt || notification.readAt === null ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-white truncate">
                            {notification.title}
                          </h4>
                          {(!notification.readAt || notification.readAt === null) && (
                            <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {(!notification.readAt || notification.readAt === null) && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="p-1 text-slate-400 hover:text-primary transition-colors"
                            title="Mark as read"
                          >
                            <FontAwesomeIcon icon={faCheck} className="text-xs" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <FontAwesomeIcon icon={faTrash} className="text-xs" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {notifications.length > 0 && (
            <div className="p-4 border-t border-white/10">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notifications');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <span>More notifications</span>
                <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;

