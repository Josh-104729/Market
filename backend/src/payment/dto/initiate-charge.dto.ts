import { IsNumber, IsNotEmpty, Min, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentNetwork } from '../../entities/transaction.entity';

export class InitiateChargeDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentNetwork)
  @IsOptional()
  paymentNetwork?: PaymentNetwork = PaymentNetwork.USDT_TRC20;
}

