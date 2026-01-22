import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post, PostStatus } from '../entities/post.entity';
import { PostLike } from '../entities/post-like.entity';
import { PostComment } from '../entities/post-comment.entity';
import { PostCommentLike } from '../entities/post-comment-like.entity';
import { PostReport, PostReportStatus } from '../entities/post-report.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);
  
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(PostLike)
    private postLikeRepository: Repository<PostLike>,
    @InjectRepository(PostComment)
    private postCommentRepository: Repository<PostComment>,
    @InjectRepository(PostCommentLike)
    private postCommentLikeRepository: Repository<PostCommentLike>,
    @InjectRepository(PostReport)
    private postReportRepository: Repository<PostReport>,
  ) {}

  async create(userId: string, createPostDto: CreatePostDto): Promise<Post> {
    // Ensure images is always an array, even if empty
    const images = Array.isArray(createPostDto.images) ? createPostDto.images : [];
    
    const post = this.postRepository.create({
      userId,
      title: createPostDto.title,
      content: createPostDto.content,
      images: images,
      status: PostStatus.PENDING,
    });

    const savedPost = await this.postRepository.save(post);
    
    // Verify images were saved correctly - reload to ensure JSON is properly parsed
    const reloadedPost = await this.postRepository.findOne({ where: { id: savedPost.id } });
    
    if (images.length > 0) {
      const savedImages = Array.isArray(reloadedPost?.images) ? reloadedPost.images : [];
      if (savedImages.length === 0) {
        this.logger.error(`Failed to save post images. Expected ${images.length}, got 0. Post ID: ${savedPost.id}`);
        // Try to save again with explicit JSON
        await this.postRepository.update(savedPost.id, { images: images });
        const retryPost = await this.postRepository.findOne({ where: { id: savedPost.id } });
        if (retryPost) {
          return retryPost;
        }
      }
    }
    
    return reloadedPost || savedPost;
  }

  async reportPost(postId: string, userId: string, createReportDto: CreateReportDto): Promise<PostReport> {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const report = this.postReportRepository.create({
      postId,
      userId,
      reason: createReportDto.reason,
      details: createReportDto.details,
      status: PostReportStatus.OPEN,
    });

    return this.postReportRepository.save(report);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    userId?: string, // For checking if user liked posts
    search?: string,
  ): Promise<{ data: Post[]; total: number; page: number; limit: number; totalPages: number }> {
    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .leftJoinAndSelect('post.likes', 'likes')
      .leftJoinAndSelect('post.comments', 'comments')
      .leftJoinAndSelect('comments.user', 'commentUser')
      .where('post.status = :status', { status: PostStatus.PUBLISHED });

    if (search) {
      // Split search query by spaces and trim each word
      const searchWords = search
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .map((word) => word.trim());

      if (searchWords.length > 0) {
        // For each word, create a condition that searches in content or user name
        // All words must match (AND logic)
        searchWords.forEach((word, index) => {
          const paramName = `searchWord${index}`;
          const searchPattern = `%${word}%`;
          queryBuilder.andWhere(
            `(post.content LIKE :${paramName} OR user.firstName LIKE :${paramName} OR user.lastName LIKE :${paramName} OR user.userName LIKE :${paramName} OR user.email LIKE :${paramName})`,
            { [paramName]: searchPattern },
          );
        });
      }
    }

    queryBuilder.orderBy('post.createdAt', 'DESC');

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

        // Ensure images is always an array
        const normalizedImages = Array.isArray(post.images) ? post.images : (post.images ? [post.images] : []);
        
        return {
          ...post,
          images: normalizedImages,
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

  async findAllAdmin(
    page: number = 1,
    limit: number = 10,
    status?: PostStatus,
    search?: string,
  ): Promise<{ data: Post[]; total: number; page: number; limit: number; totalPages: number }> {
    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .leftJoinAndSelect('post.likes', 'likes')
      .leftJoinAndSelect('post.comments', 'comments')
      .leftJoinAndSelect('comments.user', 'commentUser')
      .orderBy('post.createdAt', 'DESC');

    if (status) {
      queryBuilder.where('post.status = :status', { status });
    }

    if (search) {
      const searchWords = search
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .map((word) => word.trim());

      if (searchWords.length > 0) {
        searchWords.forEach((word, index) => {
          const paramName = `searchWord${index}`;
          const searchPattern = `%${word}%`;
          queryBuilder.andWhere(
            `(post.content LIKE :${paramName} OR user.firstName LIKE :${paramName} OR user.lastName LIKE :${paramName} OR user.userName LIKE :${paramName} OR user.email LIKE :${paramName})`,
            { [paramName]: searchPattern },
          );
        });
      }
    }

    const total = await queryBuilder.getCount();
    const skip = (page - 1) * limit;
    const posts = await queryBuilder.skip(skip).take(limit).getMany();

    const postsWithStats = await Promise.all(
      posts.map(async (post) => {
        const likeCount = post.likes?.length || 0;
        const commentCount = await this.postCommentRepository.count({
          where: { postId: post.id, parentId: null },
        });

        // Ensure images is always an array
        const normalizedImages = Array.isArray(post.images) ? post.images : (post.images ? [post.images] : []);
        
        return {
          ...post,
          images: normalizedImages,
          likeCount,
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

    // Ensure images is always an array
    const normalizedImages = Array.isArray(post.images) ? post.images : (post.images ? [post.images] : []);
    
    return {
      ...post,
      images: normalizedImages,
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

    // Store original images BEFORE any modifications
    const originalImages = Array.isArray(post.images) ? [...post.images] : (post.images ? [post.images] : []);

    if (updatePostDto.title !== undefined) {
      post.title = updatePostDto.title;
    }
    if (updatePostDto.content !== undefined) {
      post.content = updatePostDto.content;
    }
    // Only update images if explicitly provided (not undefined)
    // This preserves existing images when updating other fields like status
    if (updatePostDto.images !== undefined) {
      // Ensure images is always an array
      post.images = Array.isArray(updatePostDto.images) ? updatePostDto.images : [];
    } else {
      // Explicitly preserve existing images if not provided in update
      post.images = originalImages;
    }
    // Preserve existing images if status is being updated without image changes
    if (updatePostDto.status !== undefined) {
      post.status = updatePostDto.status;
      // Ensure images are preserved when updating status
      if (updatePostDto.images === undefined) {
        // Explicitly set images to original to ensure they're preserved
        post.images = originalImages;
      }
    }
    
    const savedPost = await this.postRepository.save(post);
    
    // Reload post to ensure JSON is properly parsed
    const reloadedPost = await this.postRepository.findOne({ where: { id: savedPost.id } });
    
    // Verify images were preserved if they existed before
    if (originalImages.length > 0 && updatePostDto.images === undefined) {
      const savedImages = Array.isArray(reloadedPost?.images) ? reloadedPost.images : [];
      if (savedImages.length === 0) {
        this.logger.error(`Failed to preserve post images during update. Post ID: ${id}, Original images: ${originalImages.length}`);
        // Try to restore images
        await this.postRepository.update(id, { images: originalImages });
        const retryPost = await this.postRepository.findOne({ where: { id } });
        if (retryPost) {
          return this.findOne(id, userId);
        }
      }
    }
    
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

    const saved = await this.postCommentRepository.save(comment);

    // Return with user relation so frontend can display commenter immediately
    const withUser = await this.postCommentRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    return withUser as PostComment;
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

  async getReports(
    page: number = 1,
    limit: number = 10,
    status?: PostReportStatus,
  ): Promise<{ data: PostReport[]; total: number; page: number; limit: number; totalPages: number }> {
    const queryBuilder = this.postReportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.post', 'post')
      .leftJoinAndSelect('report.user', 'user')
      .orderBy('report.createdAt', 'DESC');

    if (status) {
      queryBuilder.where('report.status = :status', { status });
    }

    const total = await queryBuilder.getCount();
    const reports = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data: reports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateReportStatus(reportId: string, updateReportStatusDto: UpdateReportStatusDto): Promise<PostReport> {
    const report = await this.postReportRepository.findOne({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    report.status = updateReportStatusDto.status;
    report.resolutionNote = updateReportStatusDto.resolutionNote;
    await this.postReportRepository.save(report);

    const updated = await this.postReportRepository.findOne({
      where: { id: reportId },
      relations: ['post', 'user'],
    });

    if (!updated) {
      throw new NotFoundException('Report not found after update');
    }

    return updated;
  }
}

