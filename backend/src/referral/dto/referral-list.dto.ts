import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReferralStatus } from '../../entities/referral.entity';

export class GetReferralsQueryDto {
  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class ReferralListItemDto {
  id: string;
  referredUser: {
    id: string;
    userName?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    email: string;
  };
  status: string;
  referredAt: Date;
  activatedAt?: Date;
  completedAt?: Date;
  earnings: number;
}

