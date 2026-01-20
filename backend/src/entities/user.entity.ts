import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
@Unique(['email'])
@Unique(['userName'])
export class User extends BaseEntity {
  @Column()
  email: string;

  @Column()
  password: string;

  @Column({ name: 'user_name', nullable: true })
  userName?: string;

  @Column({ name: 'first_name', nullable: true })
  firstName?: string;

  @Column({ name: 'last_name', nullable: true })
  lastName?: string;

  @Column({ name: 'middle_name', nullable: true })
  middleName?: string;

  @Column({ nullable: true, type: 'text' })
  bio?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber?: string;

  @Column({ default: 'user' })
  role: string;

  @Column({ nullable: true, name: 'google_id' })
  googleId?: string;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'phone_verified', default: false })
  phoneVerified: boolean;

  @Column({ name: 'two_factor_enabled', default: false })
  twoFactorEnabled: boolean;

  @Column({ name: 'two_factor_secret', nullable: true })
  twoFactorSecret?: string;

  @Column({ name: 'two_factor_method', nullable: true, default: 'totp' })
  twoFactorMethod?: string; // 'totp', 'sms', 'email'

  @Column({ name: 'backup_codes', type: 'text', nullable: true })
  backupCodes?: string; // JSON array of hashed backup codes

  @Column({ name: 'two_factor_verified_at', nullable: true })
  twoFactorVerifiedAt?: Date;

  @Column({ default: 'active' })
  status: string;

  @Column({ name: 'referral_code', nullable: true, unique: true, length: 12 })
  referralCode?: string;

  @Column({ name: 'referred_by', nullable: true })
  referredBy?: string;

  @Column({ name: 'referral_code_created_at', nullable: true })
  referralCodeCreatedAt?: Date;

  @Column({ name: 'total_referrals', default: 0 })
  totalReferrals: number;

  @Column({ name: 'total_referral_earnings', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalReferralEarnings: number;

  @Column({ name: 'last_notification_check_at', type: 'timestamp', nullable: true })
  lastNotificationCheckAt?: Date;

  @Column({ name: 'last_notification_email_sent_at', type: 'timestamp', nullable: true })
  lastNotificationEmailSentAt?: Date;

  @Column({ name: 'reset_password_token', type: 'varchar', length: 255, nullable: true })
  resetPasswordToken?: string | null;

  @Column({ name: 'reset_password_expires', type: 'datetime', nullable: true })
  resetPasswordExpires?: Date | null;
}

