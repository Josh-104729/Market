import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
// import { SmsService } from './sms.service'; // SMS phone verification disabled
import { TwoFactorService } from './two-factor.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../entities/user.entity';
import { LoginHistory } from '../entities/login-history.entity';
import { ReferralModule } from '../referral/referral.module';
import { StorageModule } from '../storage/storage.module';
import { PaymentModule } from '../payment/payment.module';
import { ServiceModule } from '../service/service.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, LoginHistory]),
    PassportModule,
    ReferralModule,
    StorageModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => ServiceModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService, /* SmsService, */ TwoFactorService, JwtStrategy], // SMS phone verification disabled
  exports: [AuthService, TwoFactorService, EmailService],
})
export class AuthModule {}

