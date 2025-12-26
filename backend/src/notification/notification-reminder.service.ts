import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import { User } from '../entities/user.entity';
import { Notification } from '../entities/notification.entity';
import { EmailService } from '../auth/email.service';

@Injectable()
export class NotificationReminderService {
  private readonly logger = new Logger(NotificationReminderService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private emailService: EmailService,
  ) {}

  /**
   * Check for users who haven't checked notifications in 5 minutes
   * and send email reminders if they have unread notifications
   * Runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndSendNotificationReminders() {
    try {
      // Calculate the time 5 minutes ago
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Find users who:
      // 1. Haven't checked notifications in the last 5 minutes (or never checked)
      // Note: We do per-user dedupe in the loop (based on last check time + last email time)
      // so we don't send repetitive emails for the same unseen unread notifications.

      const usersToCheck = await this.userRepository
        .createQueryBuilder('user')
        .where(
          '(user.lastNotificationCheckAt IS NULL OR user.lastNotificationCheckAt < :fiveMinutesAgo)',
          { fiveMinutesAgo },
        )
        .andWhere('user.emailVerified = :emailVerified', { emailVerified: true })
        .getMany();

      if (usersToCheck.length === 0) {
        return;
      }

      this.logger.debug(`Checking ${usersToCheck.length} users for notification reminders`);

      for (const user of usersToCheck) {
        try {
          // Count ALL unread notifications
          const unreadCount = await this.notificationRepository.count({
            where: { userId: user.id, readAt: IsNull() },
          });

          if (unreadCount === 0) continue;

          // Count unread notifications created AFTER the user's last check.
          // If they already opened notifications after these arrived, we don't email again.
          const unseenUnreadWhere: any = {
            userId: user.id,
            readAt: IsNull(),
          };
          if (user.lastNotificationCheckAt) {
            unseenUnreadWhere.createdAt = MoreThan(user.lastNotificationCheckAt);
          }

          const unseenUnreadCount = await this.notificationRepository.count({
            where: unseenUnreadWhere,
          });

          // Only email if there are unread notifications the user hasn't even seen yet
          if (unseenUnreadCount === 0) continue;

          // Use the most recent unseen-unread notification for the email snippet
          const latestUnseenUnread = await this.notificationRepository.findOne({
            where: unseenUnreadWhere,
            order: { createdAt: 'DESC' },
          });

          if (!latestUnseenUnread) continue;

          // Dedupe: if we've already sent an email AFTER this notification existed, don't resend
          if (
            user.lastNotificationEmailSentAt &&
            latestUnseenUnread.createdAt <= user.lastNotificationEmailSentAt
          ) {
            continue;
          }

          // Send email reminder
          await this.emailService.sendNotificationReminderEmail(
            user.email,
            {
              title: latestUnseenUnread.title,
              message: latestUnseenUnread.message,
            },
            unreadCount,
          );

          // Update last email sent timestamp
          await this.userRepository.update(
            { id: user.id },
            { lastNotificationEmailSentAt: new Date() },
          );

          this.logger.log(
            `Notification reminder email sent to user ${user.id} (${user.email}) - ${unreadCount} unread notifications`,
          );
        } catch (error) {
          this.logger.error(`Error sending notification reminder to user ${user.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error in checkAndSendNotificationReminders:', error);
    }
  }
}

