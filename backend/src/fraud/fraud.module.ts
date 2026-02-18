import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../entities/conversation.entity';
import { FraudDetection } from '../entities/fraud-detection.entity';
import { ConversationReactivationRequest } from '../entities/conversation-reactivation-request.entity';
import { Message } from '../entities/message.entity';
import { NotificationModule } from '../notification/notification.module';
import { ChatModule } from '../chat/chat.module';
import { MessageModule } from '../message/message.module';
import { FraudDetectorService } from './fraud-detector.service';
import { FraudService } from './fraud.service';
import { FraudAdminController } from './fraud-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, FraudDetection, ConversationReactivationRequest, Message]),
    forwardRef(() => NotificationModule),
    forwardRef(() => ChatModule),
    forwardRef(() => MessageModule),
  ],
  controllers: [FraudAdminController],
  providers: [FraudDetectorService, FraudService],
  exports: [FraudService, FraudDetectorService],
})
export class FraudModule {}


