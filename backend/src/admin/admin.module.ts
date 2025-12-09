import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../entities/user.entity';
import { AdminInitService } from './admin-init.service';
import { TempWallet } from '../entities/temp-wallet.entity';
import { Balance } from '../entities/balance.entity';
import { Transaction } from '../entities/transaction.entity';
import { WalletService } from '../wallet/wallet.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, TempWallet, Balance, Transaction]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
    WalletModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminInitService],
  exports: [AdminService],
})
export class AdminModule {}

