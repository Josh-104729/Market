import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HelpService } from './help.service';
import { CreateHelpRequestDto } from './dto/create-help-request.dto';

@Controller('help')
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async my(@Request() req) {
    return this.helpService.findMy(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
        ];
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
    @Body() dto: CreateHelpRequestDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    try {
      return await this.helpService.create(req.user.id, dto, file);
    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to create help request');
    }
  }
}


