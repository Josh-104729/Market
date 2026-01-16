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
import { memoryStorage } from 'multer';
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { PostStatus } from '../entities/post.entity';
import { PostReportStatus } from '../entities/post-report.entity';
import { StorageService } from '../storage/storage.service';

@Controller('blog')
export class BlogController {
  constructor(
    private readonly blogService: BlogService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
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
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      // Upload all files to Backblaze B2
      imageUrls = await this.storageService.uploadFiles(files, 'posts');
    }
    return this.blogService.create(req.user.id, {
      ...createPostDto,
      images: imageUrls,
    });
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  async reportPost(@Param('id') id: string, @Request() req, @Body() createReportDto: CreateReportDto) {
    return this.blogService.reportPost(id, req.user.id, createReportDto);
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

  @Get('reports')
  @UseGuards(AdminGuard)
  async getReports(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: PostReportStatus,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.blogService.getReports(pageNum, limitNum, status);
  }

  @Get('admin')
  @UseGuards(AdminGuard)
  async findAllAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: PostStatus,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.blogService.findAllAdmin(pageNum, limitNum, status);
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
      storage: memoryStorage(),
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
      // Upload all files to Backblaze B2
      const imageUrls = await this.storageService.uploadFiles(files, 'posts');
      updatePostDto.images = imageUrls;
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

  @Patch('reports/:reportId/status')
  @UseGuards(AdminGuard)
  async updateReportStatus(@Param('reportId') reportId: string, @Body() body: UpdateReportStatusDto) {
    return this.blogService.updateReportStatus(reportId, body);
  }

  @Delete(':id/admin')
  @UseGuards(AdminGuard)
  async removeByAdmin(@Param('id') id: string) {
    await this.blogService.remove(id, '', true);
    return { message: 'Post deleted successfully' };
  }
}

