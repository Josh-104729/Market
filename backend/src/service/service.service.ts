import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Service, ServicePaymentDuration, ServiceStatus } from '../entities/service.entity';
import { Tag } from '../entities/tag.entity';
import { Milestone, MilestoneStatus } from '../entities/milestone.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @InjectRepository(Milestone)
    private milestoneRepository: Repository<Milestone>,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
  ) {}

  async create(
    userId: string,
    createServiceDto: CreateServiceDto,
    adImagePath?: string | null,
  ): Promise<Service> {
    const service = this.serviceRepository.create({
      userId,
      categoryId: createServiceDto.categoryId,
      title: createServiceDto.title,
      adText: createServiceDto.adText,
      adImage: adImagePath ?? null,
      balance: createServiceDto.balance,
      paymentDuration: createServiceDto.paymentDuration ?? ServicePaymentDuration.EACH_TIME,
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

    // Notify user that the service is pending approval
    await this.notificationService.createNotification(
      userId,
      NotificationType.SERVICE_PENDING_APPROVAL,
      'Service submitted',
      'Please wait until your service is approved.',
      { serviceId: savedService.id, serviceTitle: savedService.title },
    );

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
      // Split search query by spaces and trim each word
      const searchWords = search
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .map((word) => word.trim());

      if (searchWords.length > 0) {
        // For each word, create a condition that searches in title, description, or tags
        // All words must match (AND logic)
        searchWords.forEach((word, index) => {
          const paramName = `searchWord${index}`;
          const searchPattern = `%${word}%`;
          queryBuilder.andWhere(
            `(service.title LIKE :${paramName} OR service.adText LIKE :${paramName} OR tags.title LIKE :${paramName})`,
            { [paramName]: searchPattern },
          );
        });
      }
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

    // Calculate averageRating from milestones for each service
    const serviceIds = data.map((s) => s.id);
    const allMilestones = await this.milestoneRepository.find({
      where: { serviceId: In(serviceIds), deletedAt: null },
      relations: ['client'],
    });

    // Group milestones by serviceId and calculate averageRating
    const serviceRatings = new Map<string, { sum: number; count: number }>();
    allMilestones.forEach((milestone) => {
      if (
        milestone.status === MilestoneStatus.RELEASED &&
        milestone.rating !== null &&
        milestone.rating !== undefined
      ) {
        const serviceId = milestone.serviceId;
        if (!serviceRatings.has(serviceId)) {
          serviceRatings.set(serviceId, { sum: 0, count: 0 });
        }
        const current = serviceRatings.get(serviceId)!;
        current.sum += Number(milestone.rating);
        current.count += 1;
        serviceRatings.set(serviceId, current);
      }
    });

    // Add averageRating to each service
    const servicesWithRatings = data.map((service) => {
      const ratingData = serviceRatings.get(service.id);
      const averageRating =
        ratingData && ratingData.count > 0
          ? Math.round((ratingData.sum / ratingData.count) * 100) / 100
          : 0;
      return {
        ...service,
        averageRating,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: servicesWithRatings,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(
    id: string,
    feedbackPage: number = 1,
    feedbackLimit: number = 10,
  ): Promise<Service & { 
    totalMilestones: number;
    completedMilestones: number;
    averageRating: number;
    feedbackCount: number;
    feedbacks: Array<{
      id: string;
      title: string;
      feedback: string;
      rating: number;
      client: { id: string; firstName?: string; lastName?: string; userName?: string };
      createdAt: string;
    }>;
    feedbacksHasMore: boolean;
    feedbacksPage: number;
    feedbacksLimit: number;
  }> {
    const service = await this.serviceRepository.findOne({
      where: { id, deletedAt: null },
      relations: ['category', 'user', 'tags'],
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    // Get all milestones for this service
    const allMilestones = await this.milestoneRepository.find({
      where: { serviceId: id, deletedAt: null },
      relations: ['client'],
    });

    // Calculate statistics
    const totalMilestones = allMilestones.length;
    const completedMilestones = allMilestones.filter(
      (m) => m.status === MilestoneStatus.RELEASED,
    ).length;

    // Calculate average rating from completed milestones with ratings
    const completedWithRatings = allMilestones.filter(
      (m) => m.status === MilestoneStatus.RELEASED && m.rating !== null && m.rating !== undefined,
    );
    const averageRating =
      completedWithRatings.length > 0
        ? completedWithRatings.reduce((sum, m) => sum + Number(m.rating), 0) / completedWithRatings.length
        : 0;

    // Count feedbacks (milestones with feedback)
    const feedbackCount = allMilestones.filter(
      (m) => m.feedback && m.feedback.trim().length > 0,
    ).length;

    // Get feedbacks (completed milestones with feedback and rating)
    const allFeedbacks = allMilestones
      .filter(
        (m) =>
          m.status === MilestoneStatus.RELEASED &&
          m.feedback &&
          m.feedback.trim().length > 0 &&
          m.rating !== null &&
          m.rating !== undefined,
      )
      .map((m) => ({
        id: m.id,
        title: m.title,
        feedback: m.feedback!,
        rating: Number(m.rating!),
        client: {
          id: m.client.id,
          firstName: m.client.firstName,
          lastName: m.client.lastName,
          userName: m.client.userName,
        },
        createdAt: m.createdAt.toISOString(),
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Sort by newest first

    // Apply pagination
    const startIndex = (feedbackPage - 1) * feedbackLimit;
    const endIndex = startIndex + feedbackLimit;
    const paginatedFeedbacks = allFeedbacks.slice(startIndex, endIndex);
    const feedbacksHasMore = endIndex < allFeedbacks.length;

    return {
      ...service,
      totalMilestones,
      completedMilestones,
      averageRating: Math.round(averageRating * 100) / 100, // Round to 2 decimal places
      feedbackCount,
      feedbacks: paginatedFeedbacks,
      feedbacksHasMore,
      feedbacksPage: feedbackPage,
      feedbacksLimit: feedbackLimit,
    };
  }

  async update(id: string, userId: string, updateServiceDto: UpdateServiceDto, adImagePath?: string, isAdmin: boolean = false): Promise<Service> {
    const service = await this.findOne(id);

    // Check if user owns the service (unless admin is updating)
    if (!isAdmin && service.userId !== userId) {
      throw new ForbiddenException('You can only update your own services');
    }

    // Store old status to detect status changes
    const oldStatus = service.status;

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
    if (updateServiceDto.paymentDuration !== undefined) {
      service.paymentDuration = updateServiceDto.paymentDuration;
    }
    if (adImagePath) {
      service.adImage = adImagePath;
    }
    if (updateServiceDto.status) {
      service.status = updateServiceDto.status;
    }

    await this.serviceRepository.save(service);

    // Send notification if admin approved/unblocked the service
    if (isAdmin && updateServiceDto.status && oldStatus !== updateServiceDto.status) {
      if (oldStatus === ServiceStatus.DRAFT && updateServiceDto.status === ServiceStatus.ACTIVE) {
        // Service was approved
        await this.notificationService.createNotification(
          service.userId,
          NotificationType.SERVICE_APPROVED,
          'Service Approved',
          `Your service "${service.title}" has been approved and is now active.`,
          { serviceId: service.id, serviceTitle: service.title },
        );
      } else if (oldStatus === ServiceStatus.BLOCKED && updateServiceDto.status === ServiceStatus.ACTIVE) {
        // Service was unblocked
        await this.notificationService.createNotification(
          service.userId,
          NotificationType.SERVICE_UNBLOCKED,
          'Service Unblocked',
          `Your service "${service.title}" has been unblocked and is now active again.`,
          { serviceId: service.id, serviceTitle: service.title },
        );
      } else if (updateServiceDto.status === ServiceStatus.BLOCKED) {
        // Service was blocked
        await this.notificationService.createNotification(
          service.userId,
          NotificationType.SERVICE_BLOCKED,
          'Service Blocked',
          `Your service "${service.title}" has been blocked.`,
          { serviceId: service.id, serviceTitle: service.title },
        );
      }
    }

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
