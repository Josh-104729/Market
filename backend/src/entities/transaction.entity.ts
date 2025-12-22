import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Milestone } from './milestone.entity';
import { TempWallet } from './temp-wallet.entity';

export enum TransactionType {
  CHARGE = 'charge',
  WITHDRAW = 'withdraw',
  MILESTONE_PAYMENT = 'milestone_payment',
  PLATFORM_FEE = 'platform_fee',
}

export enum TransactionStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  WITHDRAW = 'withdraw',
}

export enum PaymentNetwork {
  USDT_TRC20 = 'USDT_TRC20',
  USDC_POLYGON = 'USDC_POLYGON',
}

@Entity('transactions')
export class Transaction extends BaseEntity {
  @Column({ name: 'client_id', nullable: true })
  clientId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'client_id' })
  client?: User;

  @Column({ name: 'provider_id', nullable: true })
  providerId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'provider_id' })
  provider?: User;

  @Column({ name: 'milestone_id', nullable: true })
  milestoneId?: string;

  @ManyToOne(() => Milestone, { nullable: true })
  @JoinColumn({ name: 'milestone_id' })
  milestone?: Milestone;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.DRAFT,
  })
  status: TransactionStatus;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: any) => value,
      from: (value: any) => (value === null || value === undefined ? value : Number(value)),
    },
  })
  amount: number;

  @Column({ name: 'transaction_hash', nullable: true })
  transactionHash?: string;

  @Column({ name: 'wallet_address', nullable: true })
  walletAddress?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'temp_wallet_id', nullable: true })
  tempWalletId?: string;

  @ManyToOne(() => TempWallet, { nullable: true })
  @JoinColumn({ name: 'temp_wallet_id' })
  tempWallet?: TempWallet;

  @Column({
    name: 'expected_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: any) => value,
      from: (value: any) => (value === null || value === undefined ? value : Number(value)),
    },
  })
  expectedAmount?: number; // For charge transactions

  @Column({
    name: 'platform_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: any) => value,
      from: (value: any) => (value === null || value === undefined ? value : Number(value)),
    },
  })
  platformFee?: number;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt?: Date; // For pending charge transactions

  @Column({
    type: 'enum',
    enum: PaymentNetwork,
    default: PaymentNetwork.USDT_TRC20,
    nullable: true,
  })
  paymentNetwork?: PaymentNetwork; // Payment network: USDT TRC20 or USDC Polygon
}

