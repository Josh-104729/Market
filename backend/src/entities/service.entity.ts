import { Entity, Column, DeleteDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Category } from './category.entity';
import { Tag } from './tag.entity';

export enum ServiceStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}

export enum ServicePaymentDuration {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  EACH_TIME = 'each_time',
}

@Entity('services')
export class Service extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'category_id' })
  categoryId: string;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column()
  title: string;

  @Column({ name: 'ad_text', type: 'text' })
  adText: string;

  @Column({ name: 'ad_image', nullable: true })
  adImage?: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balance: number;

  @Column({
    name: 'payment_duration',
    type: 'enum',
    enum: ServicePaymentDuration,
    default: ServicePaymentDuration.EACH_TIME,
  })
  paymentDuration: ServicePaymentDuration;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, default: 0 })
  rating: number;

  @Column({
    type: 'enum',
    enum: ServiceStatus,
    default: ServiceStatus.DRAFT,
  })
  status: ServiceStatus;

  @OneToMany(() => Tag, (tag) => tag.service, { cascade: true })
  tags: Tag[];

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}

