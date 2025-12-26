import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum NotificationType {
  BROADCAST = 'broadcast',
  PAYMENT_CHARGE = 'payment_charge',
  PAYMENT_WITHDRAW = 'payment_withdraw',
  PAYMENT_TRANSFER = 'payment_transfer',
  MESSAGE = 'message',
  SERVICE_PENDING_APPROVAL = 'service_pending_approval',
  SERVICE_APPROVED = 'service_approved',
  SERVICE_BLOCKED = 'service_blocked',
  SERVICE_UNBLOCKED = 'service_unblocked',
  MILESTONE_CREATED = 'milestone_created',
  MILESTONE_UPDATED = 'milestone_updated',
  MILESTONE_PAYMENT_PENDING = 'milestone_payment_pending',
}

@Entity('notifications')
export class Notification extends BaseEntity {
  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt?: Date;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>; // For storing additional data like transactionId, conversationId, etc.
}

