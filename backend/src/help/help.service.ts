import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageService } from '../storage/storage.service';
import { HelpRequest, HelpRequestStatus } from '../entities/help-request.entity';
import { CreateHelpRequestDto } from './dto/create-help-request.dto';

@Injectable()
export class HelpService {
  constructor(
    @InjectRepository(HelpRequest)
    private readonly helpRepository: Repository<HelpRequest>,
    private readonly storageService: StorageService,
  ) {}

  async create(userId: string, dto: CreateHelpRequestDto, file?: Express.Multer.File) {
    let imageUrl: string | undefined;
    if (file) {
      imageUrl = await this.storageService.uploadFile(file, 'help');
    }

    const help = this.helpRepository.create({
      userId,
      title: dto.title,
      content: dto.content,
      imageUrl,
      status: HelpRequestStatus.PENDING,
    });

    return await this.helpRepository.save(help);
  }

  async findMy(userId: string) {
    return this.helpRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async adminFindAll() {
    return this.helpRepository.find({
      relations: ['user', 'approvedByUser'],
      order: { createdAt: 'DESC' },
    });
  }

  async adminFindOne(id: string) {
    const help = await this.helpRepository.findOne({
      where: { id },
      relations: ['user', 'approvedByUser'],
    });
    if (!help) throw new NotFoundException('Help request not found');
    return help;
  }

  async approve(id: string, adminUserId: string) {
    const help = await this.helpRepository.findOne({ where: { id } });
    if (!help) throw new NotFoundException('Help request not found');

    if (help.status !== HelpRequestStatus.APPROVED) {
      help.status = HelpRequestStatus.APPROVED;
      help.approvedAt = new Date();
      help.approvedBy = adminUserId;
      await this.helpRepository.save(help);
    }

    return this.helpRepository.findOne({
      where: { id },
      relations: ['user', 'approvedByUser'],
    });
  }
}


