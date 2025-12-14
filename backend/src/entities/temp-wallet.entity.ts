import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum TempWalletStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  INACTIVE = 'INACTIVE',
}

export enum WalletNetwork {
  TRON = 'TRON',
  POLYGON = 'POLYGON',
}

@Entity('temp_wallets')
export class TempWallet extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'address', unique: true })
  address: string; // Wallet address (TRC20 or Polygon)

  @Column({
    type: 'enum',
    enum: WalletNetwork,
    default: WalletNetwork.TRON,
  })
  network: WalletNetwork; // Network type: TRON or POLYGON

  @Column({ name: 'private_key', type: 'text' })
  privateKey: string; // Encrypted private key

  @Column({ name: 'encryption_key_hash', nullable: true, length: 64 })
  encryptionKeyHash?: string; // Hash of the encryption key used to encrypt this wallet's private key

  @Column({
    type: 'enum',
    enum: TempWalletStatus,
    default: TempWalletStatus.ACTIVE,
  })
  status: TempWalletStatus;

  @Column({ name: 'last_checked_at', nullable: true })
  lastCheckedAt?: Date;

  @Column({ name: 'total_received', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalReceived: number;
}

