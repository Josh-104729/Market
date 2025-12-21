import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
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
      // 2. Haven't been sent an email in the last hour (to avoid spam)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const usersToCheck = await this.userRepository
        .createQueryBuilder('user')
        .where(
          '(user.lastNotificationCheckAt IS NULL OR user.lastNotificationCheckAt < :fiveMinutesAgo)',
          { fiveMinutesAgo },
        )
        .andWhere(
          '(user.lastNotificationEmailSentAt IS NULL OR user.lastNotificationEmailSentAt < :oneHourAgo)',
          { oneHourAgo },
        )
        .andWhere('user.emailVerified = :emailVerified', { emailVerified: true })
        .getMany();

      if (usersToCheck.length === 0) {
        return;
      }

      this.logger.debug(`Checking ${usersToCheck.length} users for notification reminders`);

      for (const user of usersToCheck) {
        try {
          // Get unread notifications count
          const unreadCount = await this.notificationRepository.count({
            where: { userId: user.id, readAt: IsNull() },
          });

          // Only send email if there are unread notifications
          if (unreadCount === 0) {
            continue;
          }

          // Get the last notification (most recent unread or read)
          const lastNotification = await this.notificationRepository.findOne({
            where: { userId: user.id },
            order: { createdAt: 'DESC' },
          });

          if (!lastNotification) {
            continue;
          }

          // Send email reminder
          await this.emailService.sendNotificationReminderEmail(
            user.email,
            {
              title: lastNotification.title,
              message: lastNotification.message,
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

