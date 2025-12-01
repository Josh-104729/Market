import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('examples')
export class Example extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;
}

