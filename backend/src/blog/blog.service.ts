import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post, PostStatus } from '../entities/post.entity';
import { PostLike } from '../entities/post-like.entity';
import { PostComment } from '../entities/post-comment.entity';
import { PostCommentLike } from '../entities/post-comment-like.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(PostLike)
    private postLikeRepository: Repository<PostLike>,
    @InjectRepository(PostComment)
    private postCommentRepository: Repository<PostComment>,
    @InjectRepository(PostCommentLike)
    private postCommentLikeRepository: Repository<PostCommentLike>,
  ) {}

  async create(userId: string, createPostDto: CreatePostDto): Promise<Post> {
    const post = this.postRepository.create({
      userId,
      content: createPostDto.content,
      images: createPostDto.images || [],
      status: PostStatus.PUBLISHED,
    });

    return this.postRepository.save(post);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    userId?: string, // For checking if user liked posts
  ): Promise<{ data: Post[]; total: number; page: number; limit: number; totalPages: number }> {
    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .leftJoinAndSelect('post.likes', 'likes')
      .leftJoinAndSelect('post.comments', 'comments')
      .leftJoinAndSelect('comments.user', 'commentUser')
      .where('post.status = :status', { status: PostStatus.PUBLISHED })
      .orderBy('post.createdAt', 'DESC');

    const total = await queryBuilder.getCount();

    const skip = (page - 1) * limit;
    const posts = await queryBuilder
      .skip(skip)
      .take(limit)
      .getMany();

    // Calculate like counts and check if user liked
    const postsWithStats = await Promise.all(
      posts.map(async (post) => {
        const likeCount = post.likes?.length || 0;
        let isLiked = false;

        if (userId) {
          const userLike = await this.postLikeRepository.findOne({
            where: { userId, postId: post.id },
          });
          isLiked = !!userLike;
        }

        // Get comment counts (including replies)
        const commentCount = await this.postCommentRepository.count({
          where: { postId: post.id, parentId: null },
        });

        return {
          ...post,
          likeCount,
          isLiked,
          commentCount,
        };
      }),
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: postsWithStats,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string, userId?: string): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id, status: PostStatus.PUBLISHED },
      relations: ['user', 'likes', 'likes.user', 'comments', 'comments.user', 'comments.replies', 'comments.replies.user'],
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    const likeCount = post.likes?.length || 0;
    let isLiked = false;

    if (userId) {
      const userLike = await this.postLikeRepository.findOne({
        where: { userId, postId: post.id },
      });
      isLiked = !!userLike;
    }

    // Calculate comment counts with replies
    const commentsWithStats = await Promise.all(
      (post.comments || []).map(async (comment) => {
        if (comment.parentId) return null; // Skip replies in main list
        
        const commentLikeCount = comment.likes?.length || 0;
        let commentIsLiked = false;
        
        if (userId) {
          const userCommentLike = await this.postCommentLikeRepository.findOne({
            where: { userId, commentId: comment.id },
          });
          commentIsLiked = !!userCommentLike;
        }

        const replyCount = await this.postCommentRepository.count({
          where: { parentId: comment.id },
        });

        return {
          ...comment,
          likeCount: commentLikeCount,
          isLiked: commentIsLiked,
          replyCount,
        };
      }),
    );

    return {
      ...post,
      likeCount,
      isLiked,
      comments: commentsWithStats.filter(Boolean) as PostComment[],
    };
  }

  async update(id: string, userId: string, updatePostDto: UpdatePostDto, isAdmin: boolean = false): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    if (!isAdmin && post.userId !== userId) {
      throw new ForbiddenException('You can only update your own posts');
    }

    if (updatePostDto.content !== undefined) {
      post.content = updatePostDto.content;
    }
    if (updatePostDto.images !== undefined) {
      post.images = updatePostDto.images;
    }
    if (updatePostDto.status !== undefined) {
      post.status = updatePostDto.status;
    }

    await this.postRepository.save(post);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string, isAdmin: boolean = false): Promise<void> {
    const post = await this.postRepository.findOne({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    if (!isAdmin && post.userId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.postRepository.remove(post);
  }

  async likePost(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    const existingLike = await this.postLikeRepository.findOne({
      where: { userId, postId },
    });

    if (existingLike) {
      await this.postLikeRepository.remove(existingLike);
      const likeCount = await this.postLikeRepository.count({ where: { postId } });
      return { liked: false, likeCount };
    } else {
      const like = this.postLikeRepository.create({ userId, postId });
      await this.postLikeRepository.save(like);
      const likeCount = await this.postLikeRepository.count({ where: { postId } });
      return { liked: true, likeCount };
    }
  }

  async createComment(postId: string, userId: string, createCommentDto: CreateCommentDto): Promise<PostComment> {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    const comment = this.postCommentRepository.create({
      userId,
      postId,
      content: createCommentDto.content,
      parentId: createCommentDto.parentId || null,
    });

    return this.postCommentRepository.save(comment);
  }

  async getComments(postId: string, userId?: string): Promise<PostComment[]> {
    const comments = await this.postCommentRepository.find({
      where: { postId, parentId: null },
      relations: ['user', 'replies', 'replies.user', 'likes'],
      order: { createdAt: 'DESC' },
    });

    return Promise.all(
      comments.map(async (comment) => {
        const likeCount = comment.likes?.length || 0;
        let isLiked = false;

        if (userId) {
          const userLike = await this.postCommentLikeRepository.findOne({
            where: { userId, commentId: comment.id },
          });
          isLiked = !!userLike;
        }

        const replyCount = await this.postCommentRepository.count({
          where: { parentId: comment.id },
        });

        return {
          ...comment,
          likeCount,
          isLiked,
          replyCount,
        };
      }),
    );
  }

  async likeComment(commentId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const comment = await this.postCommentRepository.findOne({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentId} not found`);
    }

    const existingLike = await this.postCommentLikeRepository.findOne({
      where: { userId, commentId },
    });

    if (existingLike) {
      await this.postCommentLikeRepository.remove(existingLike);
      const likeCount = await this.postCommentLikeRepository.count({ where: { commentId } });
      return { liked: false, likeCount };
    } else {
      const like = this.postCommentLikeRepository.create({ userId, commentId });
      await this.postCommentLikeRepository.save(like);
      const likeCount = await this.postCommentLikeRepository.count({ where: { commentId } });
      return { liked: true, likeCount };
    }
  }

  async deleteComment(commentId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    const comment = await this.postCommentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentId} not found`);
    }

    if (!isAdmin && comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.postCommentRepository.remove(comment);
  }
}

