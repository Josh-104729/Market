import { IsString, IsNotEmpty, IsNumber, IsArray, IsOptional, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ServicePaymentDuration } from '../../entities/service.entity';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  adText: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  balance: number;

  @IsEnum(ServicePaymentDuration)
  @IsOptional()
  paymentDuration?: ServicePaymentDuration;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  tags: string[];
}

