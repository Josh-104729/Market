import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('login_history')
export class LoginHistory extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'device_type', nullable: true })
  deviceType?: string; // 'desktop', 'mobile', 'tablet', 'unknown'

  @Column({ name: 'browser', nullable: true })
  browser?: string; // 'Chrome', 'Firefox', 'Safari', etc.

  @Column({ name: 'os', nullable: true })
  os?: string; // 'Windows', 'macOS', 'Linux', 'iOS', 'Android', etc.

  @Column({ name: 'device_name', nullable: true })
  deviceName?: string; // Device model or name

  @Column({ name: 'location', nullable: true })
  location?: string; // Country/City if available from IP

  @Column({ name: 'login_type', default: 'password' })
  loginType: string; // 'password', '2fa', 'google', etc.

  @Column({ name: 'success', default: true })
  success: boolean;

  @Column({ name: 'failure_reason', nullable: true, type: 'text' })
  failureReason?: string;
}

