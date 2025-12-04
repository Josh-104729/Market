import { Entity, Column, DeleteDateColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('categories')
export class Category extends BaseEntity {
  @Column()
  title: string;

  @Column({ nullable: true })
  icon?: string;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}

