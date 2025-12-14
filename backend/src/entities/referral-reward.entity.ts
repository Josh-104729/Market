import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Referral } from './referral.entity';
import { Transaction } from './transaction.entity';

export enum RewardType {
  SIGNUP_BONUS = 'signup_bonus',
  FIRST_PURCHASE = 'first_purchase',
  MILESTONE = 'milestone',
  CUSTOM = 'custom',
}

export enum RewardStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('referral_rewards')
export class ReferralReward extends BaseEntity {
  @Column({ name: 'referral_id' })
  referralId: string;

  @ManyToOne(() => Referral)
  @JoinColumn({ name: 'referral_id' })
  referral: Referral;

  @Column({ name: 'referrer_id' })
  referrerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @Column({ name: 'referred_user_id' })
  referredUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referred_user_id' })
  referredUser: User;

  @Column({
    type: 'enum',
    enum: RewardType,
  })
  rewardType: RewardType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'USDT' })
  currency: string;

  @Column({
    type: 'enum',
    enum: RewardStatus,
    default: RewardStatus.PENDING,
  })
  status: RewardStatus;

  @Column({ name: 'processed_at', nullable: true })
  processedAt?: Date;

  @Column({ name: 'transaction_id', nullable: true })
  transactionId?: string;

  @ManyToOne(() => Transaction, { nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction?: Transaction;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: any;
}

