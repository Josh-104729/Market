import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Notification, NotificationType } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { ChatGateway } from '../chat/chat.gateway';
import * as webpush from 'web-push';
import { PushSubscriptionDto } from './dto/push-subscription.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  async createNotification(
    userId: string | null,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId: userId || undefined,
      type,
      title,
      message,
      metadata,
    });

    const savedNotification = await this.notificationRepository.save(notification);

    // Emit WebSocket notification if user is online
    if (userId) {
      this.chatGateway.server.to(`user:${userId}`).emit('new_notification', savedNotification);
    } else {
      // Broadcast to all users
      this.chatGateway.server.emit('new_notification', savedNotification);
    }

    return savedNotification;
  }

  async broadcastNotification(
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<{ count: number }> {
    // Get all users and create individual notifications for each
    const users = await this.userRepository.find({
      where: { role: 'user' }, // Only notify regular users, not admins
    });

    if (users.length === 0) {
      return { count: 0 };
    }

    const userNotifications = users.map((user) =>
      this.notificationRepository.create({
        userId: user.id,
        type: NotificationType.BROADCAST,
        title,
        message,
        metadata,
      }),
    );

    const savedNotifications = await this.notificationRepository.save(userNotifications);

    // Emit to all users
    savedNotifications.forEach((notification) => {
      this.chatGateway.server.to(`user:${notification.userId}`).emit('new_notification', notification);
    });

    return { count: savedNotifications.length };
  }

  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: Notification[]; total: number; page: number; limit: number; totalPages: number; unreadCount: number }> {
    const skip = (page - 1) * limit;

    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const unreadCount = await this.notificationRepository.count({
      where: { userId, readAt: IsNull() },
    });

    // Update last notification check timestamp
    await this.userRepository.update(
      { id: userId },
      { lastNotificationCheckAt: new Date() },
    );

    // If everything is read, reset the "unread email sent" marker so future unread sessions can email again
    if (unreadCount === 0) {
      await this.userRepository.update(
        { id: userId },
        { lastNotificationEmailSentAt: null },
      );
    }

    return {
      data: notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationRepository.save(notification);

      // Count marking as read as "checking notifications" (used by reminder-email dedupe)
      await this.userRepository.update(
        { id: userId },
        { lastNotificationCheckAt: new Date() },
      );

      // If this was the last unread notification, reset the "unread email sent" marker
      const remainingUnread = await this.notificationRepository.count({
        where: { userId, readAt: IsNull() },
      });
      if (remainingUnread === 0) {
        await this.userRepository.update(
          { id: userId },
          { lastNotificationEmailSentAt: null },
        );
      }

      // Emit update to user
      this.chatGateway.server.to(`user:${userId}`).emit('notification_read', {
        notificationId: notification.id,
      });
    }

    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );

    // Count marking all as read as "checking notifications" (used by reminder-email dedupe)
    await this.userRepository.update(
      { id: userId },
      { lastNotificationCheckAt: new Date() },
    );

    // Reset the "unread email sent" marker now that everything is read
    await this.userRepository.update(
      { id: userId },
      { lastNotificationEmailSentAt: null },
    );

    // Emit update to user
    this.chatGateway.server.to(`user:${userId}`).emit('all_notifications_read', {
      userId,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, readAt: IsNull() },
    });
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.notificationRepository.remove(notification);

    // Emit update to user
    this.chatGateway.server.to(`user:${userId}`).emit('notification_deleted', {
      notificationId: notification.id,
    });
  }

  async savePushSubscription(userId: string, subscription: PushSubscriptionDto): Promise<void> {
    await this.userRepository.update(
      { id: userId },
      { pushSubscription: subscription },
    );
  }

  async removePushSubscription(userId: string): Promise<void> {
    await this.userRepository.update(
      { id: userId },
      { pushSubscription: null },
    );
  }

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user || !user.pushSubscription) {
        return; // User has no push subscription
      }

      // Initialize web-push with VAPID keys (should be in environment variables)
      const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
      const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@omnimart.com';

      if (!vapidPublicKey || !vapidPrivateKey) {
        console.warn('VAPID keys not configured, skipping push notification');
        return;
      }

      webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

      const payload = JSON.stringify({
        title,
        body,
        icon: user.avatar || '/favicon.ico',
        badge: '/favicon.ico',
        tag: data?.conversationId ? `chat-${data.conversationId}` : 'chat-message',
        data: data || {},
      });

      await webpush.sendNotification(user.pushSubscription as any, payload);
    } catch (error: any) {
      // If subscription is invalid, remove it
      if (error.statusCode === 410 || error.statusCode === 404) {
        await this.removePushSubscription(userId);
      }
      console.error('Error sending push notification:', error);
    }
  }
}

