import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentMonitorService } from './payment-monitor.service';
import { Balance } from '../entities/balance.entity';
import { Transaction } from '../entities/transaction.entity';
import { User } from '../entities/user.entity';
import { Milestone } from '../entities/milestone.entity';
import { Conversation } from '../entities/conversation.entity';
import { TempWallet } from '../entities/temp-wallet.entity';
import { ChatModule } from '../chat/chat.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationModule } from '../notification/notification.module';
import { ReferralModule } from '../referral/referral.module';
import { PolygonWalletModule } from '../polygon-wallet/polygon-wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Balance, Transaction, User, Milestone, Conversation, TempWallet]),
    forwardRef(() => ChatModule),
    forwardRef(() => WalletModule),
    PolygonWalletModule,
    forwardRef(() => NotificationModule),
    forwardRef(() => ReferralModule),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentMonitorService],
  exports: [PaymentService],
})
export class PaymentModule {}

