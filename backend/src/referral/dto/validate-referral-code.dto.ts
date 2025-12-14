import { IsString, IsOptional, Matches } from 'class-validator';

export class ValidateReferralCodeDto {
  @IsString()
  @Matches(/^[A-Z0-9]{8,12}$/, { message: 'Invalid referral code format' })
  code: string;
}

export class ValidateReferralCodeResponseDto {
  isValid: boolean;
  referrer?: {
    id: string;
    userName?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  message?: string;
}

