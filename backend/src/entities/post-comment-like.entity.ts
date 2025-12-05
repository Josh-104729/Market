import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { PostComment } from './post-comment.entity';

@Entity('post_comment_likes')
@Unique(['userId', 'commentId'])
export class PostCommentLike extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'comment_id' })
  commentId: string;

  @ManyToOne(() => PostComment, (comment) => comment.likes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: PostComment;
}

