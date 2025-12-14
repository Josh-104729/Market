import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum ReferralStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

@Entity('referrals')
export class Referral extends BaseEntity {
  @Column({ name: 'referrer_id' })
  referrerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @Column({ name: 'referred_user_id', unique: true })
  referredUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referred_user_id' })
  referredUser: User;

  @Column({ name: 'referral_code_used', length: 12 })
  referralCodeUsed: string;

  @Column({
    type: 'enum',
    enum: ReferralStatus,
    default: ReferralStatus.PENDING,
  })
  status: ReferralStatus;

  @Column({ name: 'referred_at', default: () => 'CURRENT_TIMESTAMP(6)' })
  referredAt: Date;

  @Column({ name: 'activated_at', nullable: true })
  activatedAt?: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'json', nullable: true })
  metadata?: any;
}

