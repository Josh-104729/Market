import { IsNumber, IsNotEmpty, Min, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentNetwork } from '../../entities/transaction.entity';

export class InitiateChargeDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsIn([PaymentNetwork.USDT_TRC20, PaymentNetwork.USDC_POLYGON])
  @IsOptional()
  paymentNetwork?: PaymentNetwork = PaymentNetwork.USDT_TRC20;
}

