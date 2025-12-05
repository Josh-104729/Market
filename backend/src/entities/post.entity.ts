import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('posts')
export class Post extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'json', nullable: true })
  images?: string[]; // Array of image paths

  @Column({
    type: 'enum',
    enum: PostStatus,
    default: PostStatus.PUBLISHED,
  })
  status: PostStatus;

  @OneToMany('PostLike', 'post', { cascade: true })
  likes: any[];

  @OneToMany('PostComment', 'post', { cascade: true })
  comments: any[];

  // Virtual field for like count (calculated in service)
  likeCount?: number;
  
  // Virtual field to check if current user liked
  isLiked?: boolean;
}

