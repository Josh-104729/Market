import { IsString, IsOptional, IsNumber, IsArray, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ServicePaymentDuration, ServiceStatus } from '../../entities/service.entity';

export class UpdateServiceDto {
  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  adText?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  balance?: number;

  @IsEnum(ServicePaymentDuration)
  @IsOptional()
  paymentDuration?: ServicePaymentDuration;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;
}

