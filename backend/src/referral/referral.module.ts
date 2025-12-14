import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
import { Referral } from '../entities/referral.entity';
import { ReferralReward } from '../entities/referral-reward.entity';
import { User } from '../entities/user.entity';
import { Transaction } from '../entities/transaction.entity';
import { Balance } from '../entities/balance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Referral, ReferralReward, User, Transaction, Balance]),
  ],
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}

