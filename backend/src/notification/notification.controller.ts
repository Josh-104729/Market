import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { PushSubscriptionDto } from './dto/push-subscription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getUserNotifications(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.id;
    return this.notificationService.getUserNotifications(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const userId = req.user.id;
    console.log('userId---->', userId);
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    return this.notificationService.markAsRead(id, userId);
  }

  @Patch('read-all')
  async markAllAsRead(@Request() req: any) {
    const userId = req.user.id;
    await this.notificationService.markAllAsRead(userId);
    return { message: 'All notifications marked as read' };
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    await this.notificationService.deleteNotification(id, userId);
    return { message: 'Notification deleted' };
  }

  @Post('push/subscribe')
  async subscribeToPush(
    @Request() req: any,
    @Body() dto: { subscription: PushSubscriptionDto },
  ) {
    const userId = req.user.id;
    await this.notificationService.savePushSubscription(userId, dto.subscription);
    return { message: 'Push subscription saved' };
  }

  @Post('push/unsubscribe')
  async unsubscribeFromPush(@Request() req: any) {
    const userId = req.user.id;
    await this.notificationService.removePushSubscription(userId);
    return { message: 'Push subscription removed' };
  }
}

