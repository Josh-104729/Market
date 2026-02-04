import { Controller, Get, Post, Body, Param, UseGuards, Request, UseInterceptors, UploadedFiles, BadRequestException, Query, Delete } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { DeleteMessagesDto } from './dto/delete-messages.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';

@Controller('messages')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly storageService: StorageService,
  ) {}

  @Post('conversation/:conversationId')
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('conversationId') conversationId: string,
    @Request() req,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    const isAdmin = req.user.role === 'admin';
    return this.messageService.create(conversationId, req.user.id, createMessageDto, isAdmin);
  }

  @Get('conversation/:conversationId')
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Param('conversationId') conversationId: string,
    @Request() req,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const isAdmin = req.user.role === 'admin';
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.messageService.findAll(conversationId, req.user.id, isAdmin, limitNum, before);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.messageService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Request() req) {
    const isAdmin = req.user.role === 'admin';
    return this.messageService.remove(id, req.user.id, isAdmin);
  }

  @Post('delete-bulk')
  @UseGuards(JwtAuthGuard)
  async removeBulk(@Body() dto: DeleteMessagesDto, @Request() req) {
    const isAdmin = req.user.role === 'admin';
    return this.messageService.removeBulk(dto.messageIds, req.user.id, isAdmin);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB per file
      },
    }),
  )
  async uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    try {
      // Upload all files to Backblaze B2 in 'chat' folder
      // Images will be checked for fraud when message is created
      const fileUrls = await this.storageService.uploadFiles(files, 'chat');
      
      return {
        urls: fileUrls,
        files: files.map((file, index) => ({
          url: fileUrls[index],
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
        })),
      };
    } catch (error) {
      throw new BadRequestException(`Failed to upload files: ${error.message}`);
    }
  }
}

