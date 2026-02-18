import { Entity, Column, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('messages')
export class Message extends BaseEntity {
  @Column({ name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(() => require('./conversation.entity').Conversation, (conversation: any) => conversation.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation: any;

  @Column({ name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'attachment_files', type: 'json', nullable: true })
  attachmentFiles?: string[];

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt?: Date;

  @Column({ name: 'admin_blocked_at', type: 'timestamp', nullable: true })
  adminBlockedAt?: Date;

  @Column({ name: 'admin_blocked_by_id', type: 'varchar', length: 36, nullable: true })
  adminBlockedById?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'admin_blocked_by_id' })
  adminBlockedBy?: User;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}

