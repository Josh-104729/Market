import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../entities/user.entity';
import { AdminInitService } from './admin-init.service';
import { TempWallet } from '../entities/temp-wallet.entity';
import { Balance } from '../entities/balance.entity';
import { Transaction } from '../entities/transaction.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { LoginHistory } from '../entities/login-history.entity';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentModule } from '../payment/payment.module';
import { NotificationModule } from '../notification/notification.module';
import { ConversationModule } from '../conversation/conversation.module';
import { MilestoneModule } from '../milestone/milestone.module';
import { PolygonWalletModule } from '../polygon-wallet/polygon-wallet.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, TempWallet, Balance, Transaction, Conversation, Message, LoginHistory]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
    WalletModule,
    PolygonWalletModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => ConversationModule),
    forwardRef(() => MilestoneModule),
    forwardRef(() => ChatModule),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminInitService],
  exports: [AdminService],
})
export class AdminModule {}

