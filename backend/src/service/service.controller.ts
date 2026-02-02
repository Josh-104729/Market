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
  UploadedFile,
  Query,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { ServiceStatus } from '../entities/service.entity';
import { StorageService } from '../storage/storage.service';

@Controller('services')
export class ServiceController {
  constructor(
    private readonly serviceService: ServiceService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('adImage', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(new Error('Only image files (JPG, PNG, GIF, WEBP) are allowed!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async create(
    @Request() req,
    @Body() createServiceDto: CreateServiceDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
        ],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    let adImageUrl: string | null = null;
    if (file) {
      // Upload to Backblaze B2 with compression for service images
      adImageUrl = await this.storageService.uploadFile(file, 'services', true);
    }
    return this.serviceService.create(req.user.id, createServiceDto, adImageUrl);
  }

  @Get()
  async findAll(
    @Query('status') status?: ServiceStatus,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.serviceService.findAll(status, categoryId, search, pageNum, limitNum);
  }

  @Get('my-services')
  @UseGuards(JwtAuthGuard)
  async findMyServices(
    @Request() req,
    @Query('status') status?: ServiceStatus,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.serviceService.findAll(status, categoryId, search, pageNum, limitNum, req.user.id);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('feedbackPage') feedbackPage?: string,
    @Query('feedbackLimit') feedbackLimit?: string,
  ) {
    const feedbackPageNum = feedbackPage ? parseInt(feedbackPage, 10) : 1;
    const feedbackLimitNum = feedbackLimit ? parseInt(feedbackLimit, 10) : 10;
    return this.serviceService.findOne(id, feedbackPageNum, feedbackLimitNum);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('adImage', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(new Error('Only image files (JPG, PNG, GIF, WEBP) are allowed!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateServiceDto: UpdateServiceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let adImageUrl: string | undefined;
    if (file) {
      // Upload to Backblaze B2 with compression for service images
      adImageUrl = await this.storageService.uploadFile(file, 'services', true);
    }
    return this.serviceService.update(id, req.user.id, updateServiceDto, adImageUrl);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Request() req) {
    await this.serviceService.remove(id, req.user.id);
    return { message: 'Service deleted successfully' };
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  async updateStatus(@Param('id') id: string, @Body('status') status: ServiceStatus) {
    return this.serviceService.update(id, '', { status }, undefined, true);
  }

  @Delete(':id/admin')
  @UseGuards(AdminGuard)
  async removeByAdmin(@Param('id') id: string) {
    await this.serviceService.remove(id, '', true);
    return { message: 'Service deleted successfully' };
  }
}

