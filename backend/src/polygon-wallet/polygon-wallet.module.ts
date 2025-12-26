import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TempWallet } from '../entities/temp-wallet.entity';
import { PolygonWalletService } from './polygon-wallet.service';

@Module({
  imports: [TypeOrmModule.forFeature([TempWallet])],
  providers: [PolygonWalletService],
  exports: [PolygonWalletService],
})
export class PolygonWalletModule {}


