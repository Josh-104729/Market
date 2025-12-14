import { IsEmail, IsString, MinLength, Matches, IsOptional } from 'class-validator';

export class SignUpStep1Dto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(8)
  repassword: string;

  @IsString()
  @IsOptional()
  referralCode?: string;
}

export class SignUpStep4Dto {
  @IsString()
  @MinLength(3)
  userName: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsString()
  @IsOptional()
  middleName?: string;
}

export class SignUpStep5Dto {
  @IsString()
  @MinLength(1)
  country: string;
}

export class SignUpStep6Dto {
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number format' })
  phoneNumber: string;
}

export class SignUpStep7Dto {
  @IsString()
  @MinLength(4)
  @Matches(/^\d+$/, { message: 'Verification code must contain only digits' })
  verificationCode: string;
}

