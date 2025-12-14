import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { PolygonWalletService } from './polygon-wallet.service';
import { TempWallet } from '../entities/temp-wallet.entity';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TempWallet]),
    forwardRef(() => PaymentModule),
  ],
  providers: [WalletService, PolygonWalletService],
  exports: [WalletService, PolygonWalletService],
})
export class WalletModule {}

