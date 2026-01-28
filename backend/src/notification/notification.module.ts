import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationReminderService } from './notification-reminder.service';
import { Notification } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { ChatModule } from '../chat/chat.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
    forwardRef(() => ChatModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationReminderService],
  exports: [NotificationService],
})
export class NotificationModule {}

