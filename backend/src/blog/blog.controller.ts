import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
  Query,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { PostStatus } from '../entities/post.entity';

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: diskStorage({
        destination: './uploads/posts',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `post-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(new Error('Only image files (JPG, PNG, GIF, WEBP) are allowed!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per file
      },
    }),
  )
  async create(
    @Request() req,
    @Body() createPostDto: CreatePostDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const imagePaths = files?.map((file) => `/uploads/posts/${file.filename}`) || [];
    return this.blogService.create(req.user.id, {
      ...createPostDto,
      images: imagePaths,
    });
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req?: any,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const userId = req?.user?.id;
    return this.blogService.findAll(pageNum, limitNum, userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req?: any) {
    const userId = req?.user?.id;
    return this.blogService.findOne(id, userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: diskStorage({
        destination: './uploads/posts',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `post-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(new Error('Only image files (JPG, PNG, GIF, WEBP) are allowed!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async update(
    @Param('id') id: string,
    @Request() req,
    @Body() updatePostDto: UpdatePostDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    if (files && files.length > 0) {
      const imagePaths = files.map((file) => `/uploads/posts/${file.filename}`);
      updatePostDto.images = imagePaths;
    }
    return this.blogService.update(id, req.user.id, updatePostDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Request() req) {
    await this.blogService.remove(id, req.user.id);
    return { message: 'Post deleted successfully' };
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  async likePost(@Param('id') id: string, @Request() req) {
    return this.blogService.likePost(id, req.user.id);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  async createComment(@Param('id') id: string, @Request() req, @Body() createCommentDto: CreateCommentDto) {
    return this.blogService.createComment(id, req.user.id, createCommentDto);
  }

  @Get(':id/comments')
  async getComments(@Param('id') id: string, @Request() req?: any) {
    const userId = req?.user?.id;
    return this.blogService.getComments(id, userId);
  }

  @Post('comments/:commentId/like')
  @UseGuards(JwtAuthGuard)
  async likeComment(@Param('commentId') commentId: string, @Request() req) {
    return this.blogService.likeComment(commentId, req.user.id);
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  async deleteComment(@Param('commentId') commentId: string, @Request() req) {
    await this.blogService.deleteComment(commentId, req.user.id);
    return { message: 'Comment deleted successfully' };
  }

  // Admin routes
  @Patch(':id/status')
  @UseGuards(AdminGuard)
  async updateStatus(@Param('id') id: string, @Body('status') status: PostStatus) {
    return this.blogService.update(id, '', { status }, true);
  }

  @Delete(':id/admin')
  @UseGuards(AdminGuard)
  async removeByAdmin(@Param('id') id: string) {
    await this.blogService.remove(id, '', true);
    return { message: 'Post deleted successfully' };
  }
}

