import { IsNumber, IsNotEmpty, IsString, Min, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentNetwork } from '../../entities/transaction.entity';

export class WithdrawDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(5)
  amount: number;

  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @IsEnum(PaymentNetwork)
  @IsOptional()
  paymentNetwork?: PaymentNetwork = PaymentNetwork.USDT_TRC20;
}

