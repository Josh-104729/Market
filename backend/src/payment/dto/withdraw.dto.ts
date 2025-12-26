import { IsNumber, IsNotEmpty, IsString, Min, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentNetwork } from '../../entities/transaction.entity';

export class WithdrawDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  // More than 5 (strict) as requested.
  @Min(5.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @IsIn([PaymentNetwork.USDT_TRC20, PaymentNetwork.USDC_POLYGON])
  @IsOptional()
  paymentNetwork?: PaymentNetwork = PaymentNetwork.USDT_TRC20;
}

