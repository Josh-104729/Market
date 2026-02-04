import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('fraud_detections')
export class FraudDetection extends BaseEntity {
  @Index()
  @Column({ name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(
    () => require('./conversation.entity').Conversation,
    (conversation: any) => conversation.fraudDetections,
    { createForeignKeyConstraints: false },
  )
  @JoinColumn({ name: 'conversation_id' })
  conversation: any;

  @Index()
  @Column({ name: 'message_id' })
  messageId: string;

  @ManyToOne(() => require('./message.entity').Message, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'message_id' })
  message: any;

  @Index()
  @Column({ name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'message_text', type: 'text' })
  messageText: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  confidence?: 'low' | 'medium' | 'high';

  @Column({ type: 'json', nullable: true })
  signals?: string[];

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'reviewed_by_id', nullable: true })
  reviewedById?: string;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy?: User;
}


