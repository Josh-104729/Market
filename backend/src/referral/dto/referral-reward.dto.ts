import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RewardStatus } from '../../entities/referral-reward.entity';

export class GetRewardsQueryDto {
  @IsOptional()
  @IsEnum(RewardStatus)
  status?: RewardStatus;

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

export class RewardListItemDto {
  id: string;
  amount: number;
  currency: string;
  rewardType: string;
  status: string;
  processedAt?: Date;
  description?: string;
  referredUser: {
    id: string;
    userName?: string;
    firstName?: string;
    lastName?: string;
  };
  createdAt: Date;
}

