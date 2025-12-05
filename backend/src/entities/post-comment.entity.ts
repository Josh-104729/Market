import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Post } from './post.entity';
import { PostCommentLike } from './post-comment-like.entity';

@Entity('post_comments')
export class PostComment extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'post_id' })
  postId: string;

  @ManyToOne(() => Post, (post) => post.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'parent_id', nullable: true })
  parentId?: string; // For nested comments/replies

  @ManyToOne(() => PostComment, (comment) => comment.replies, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: PostComment;

  @OneToMany(() => PostComment, (comment) => comment.parent)
  replies: PostComment[];

  @OneToMany(() => PostCommentLike, (like) => like.comment, { cascade: true })
  likes: PostCommentLike[];

  // Virtual fields
  likeCount?: number;
  isLiked?: boolean;
  replyCount?: number;
}

