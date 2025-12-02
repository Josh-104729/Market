import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
@Unique(['email'])
@Unique(['userName'])
export class User extends BaseEntity {
  @Column()
  email: string;

  @Column()
  password: string;

  @Column({ name: 'user_name', nullable: true })
  userName?: string;

  @Column({ name: 'first_name', nullable: true })
  firstName?: string;

  @Column({ name: 'last_name', nullable: true })
  lastName?: string;

  @Column({ name: 'middle_name', nullable: true })
  middleName?: string;

  @Column({ nullable: true, type: 'text' })
  bio?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber?: string;

  @Column({ default: 'user' })
  role: string;

  @Column({ nullable: true, name: 'google_id' })
  googleId?: string;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'phone_verified', default: false })
  phoneVerified: boolean;

  @Column({ default: 'active' })
  status: string;
}

