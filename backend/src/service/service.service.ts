import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Service, ServiceStatus } from '../entities/service.entity';
import { Tag } from '../entities/tag.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
  ) {}

  async create(userId: string, createServiceDto: CreateServiceDto, adImagePath: string): Promise<Service> {
    const service = this.serviceRepository.create({
      userId,
      categoryId: createServiceDto.categoryId,
      title: createServiceDto.title,
      adText: createServiceDto.adText,
      adImage: adImagePath,
      balance: createServiceDto.balance,
      status: ServiceStatus.DRAFT,
    });

    const savedService = await this.serviceRepository.save(service);

    // Create tags
    if (createServiceDto.tags && createServiceDto.tags.length > 0) {
      const tags = createServiceDto.tags.map((tagTitle) =>
        this.tagRepository.create({
          serviceId: savedService.id,
          title: tagTitle.trim(),
        }),
      );
      await this.tagRepository.save(tags);
    }

    return this.findOne(savedService.id);
  }

  async findAll(
    status?: ServiceStatus,
    categoryId?: string,
    search?: string,
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ): Promise<{ data: Service[]; total: number; page: number; limit: number; totalPages: number }> {
    const queryBuilder = this.serviceRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.category', 'category')
      .leftJoinAndSelect('service.user', 'user')
      .leftJoinAndSelect('service.tags', 'tags')
      .where('service.deletedAt IS NULL');

    if (userId) {
      queryBuilder.andWhere('service.userId = :userId', { userId });
    }

    if (status) {
      queryBuilder.andWhere('service.status = :status', { status });
    }

    if (categoryId) {
      queryBuilder.andWhere('service.categoryId = :categoryId', { categoryId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(service.title LIKE :search OR service.adText LIKE :search OR tags.title LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    const data = await queryBuilder
      .orderBy('service.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.serviceRepository.findOne({
      where: { id, deletedAt: null },
      relations: ['category', 'user', 'tags'],
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    return service;
  }

  async update(id: string, userId: string, updateServiceDto: UpdateServiceDto, adImagePath?: string, isAdmin: boolean = false): Promise<Service> {
    const service = await this.findOne(id);

    // Check if user owns the service (unless admin is updating)
    if (!isAdmin && service.userId !== userId) {
      throw new ForbiddenException('You can only update your own services');
    }

    if (updateServiceDto.categoryId) {
      service.categoryId = updateServiceDto.categoryId;
    }
    if (updateServiceDto.title) {
      service.title = updateServiceDto.title;
    }
    if (updateServiceDto.adText) {
      service.adText = updateServiceDto.adText;
    }
    if (updateServiceDto.balance !== undefined) {
      service.balance = updateServiceDto.balance;
    }
    if (adImagePath) {
      service.adImage = adImagePath;
    }
    if (updateServiceDto.status) {
      service.status = updateServiceDto.status;
    }

    await this.serviceRepository.save(service);

    // Update tags if provided
    if (updateServiceDto.tags) {
      // Delete existing tags
      await this.tagRepository.delete({ serviceId: id });
      // Create new tags
      if (updateServiceDto.tags.length > 0) {
        const tags = updateServiceDto.tags.map((tagTitle) =>
          this.tagRepository.create({
            serviceId: id,
            title: tagTitle.trim(),
          }),
        );
        await this.tagRepository.save(tags);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string, userId: string, isAdmin: boolean = false): Promise<void> {
    const service = await this.findOne(id);

    if (!isAdmin && service.userId !== userId) {
      throw new ForbiddenException('You can only delete your own services');
    }

    await this.serviceRepository.softDelete(id);
  }

  async getActiveServicesCountByCategory(categoryId: string): Promise<number> {
    return this.serviceRepository.count({
      where: {
        categoryId,
        status: ServiceStatus.ACTIVE,
        deletedAt: null,
      },
    });
  }
}

