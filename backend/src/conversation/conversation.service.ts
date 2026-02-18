import { Injectable, NotFoundException, ForbiddenException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, Brackets } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Service } from '../entities/service.entity';
import { Message } from '../entities/message.entity';
import { Milestone } from '../entities/milestone.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { MilestoneStatus } from '../entities/milestone.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { ConversationReactivationRequest, ReactivationRequestStatus } from '../entities/conversation-reactivation-request.entity';
import { FraudService } from '../fraud/fraud.service';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationReactivationRequest)
    private conversationReactivationRequestRepository: Repository<ConversationReactivationRequest>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Milestone)
    private milestoneRepository: Repository<Milestone>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    private fraudService: FraudService,
  ) {}

  private readonly publicUserFields = ['id', 'firstName', 'lastName', 'userName', 'avatar'];

  private publicUserSelect(alias: string): string[] {
    return this.publicUserFields.map((field) => `${alias}.${field}`);
  }

  async create(userId: string, createConversationDto: CreateConversationDto): Promise<Conversation> {
    // Get the service to find the provider
    const service = await this.serviceRepository.findOne({
      where: { id: createConversationDto.serviceId, deletedAt: null },
      relations: ['user'],
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Check if user is trying to connect with themselves
    if (service.userId === userId) {
      throw new ForbiddenException('You cannot connect with yourself');
    }

    // Check if conversation already exists
    const existingConversation = await this.conversationRepository.findOne({
      where: {
        serviceId: createConversationDto.serviceId,
        clientId: userId,
        deletedAt: null,
      },
    });

    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    const conversation = this.conversationRepository.create({
      serviceId: createConversationDto.serviceId,
      clientId: userId,
      providerId: service.userId,
    });

    const savedConversation = await this.conversationRepository.save(conversation);

    // Send first connection message
    const firstMessage = this.messageRepository.create({
      conversationId: savedConversation.id,
      senderId: userId,
      message: 'Hello! I\'m interested in your service. Let\'s discuss how we can work together.',
    });

    await this.messageRepository.save(firstMessage);

    // Get client info for notification
    const client = await this.userRepository.findOne({ where: { id: userId } });
    const clientName = client
      ? `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.userName || 'A client'
      : 'A client';

    // Create notification for provider about new connection
    await this.notificationService.createNotification(
      service.userId,
      NotificationType.MESSAGE,
      'New Connection Request',
      `${clientName} wants to connect with you about "${service.title}"`,
      { conversationId: savedConversation.id, serviceId: service.id, clientId: userId },
    );

    return this.findOne(savedConversation.id);
  }

  async findAll(userId: string): Promise<Conversation[]> {
    const conversations = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.service', 'service')
      .leftJoinAndSelect('service.category', 'category')
      .leftJoin('conversation.client', 'client')
      .leftJoin('conversation.provider', 'provider')
      .addSelect([
        ...this.publicUserSelect('client'),
        ...this.publicUserSelect('provider'),
      ])
      .where('conversation.deletedAt IS NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where('conversation.clientId = :userId', { userId })
            .orWhere('conversation.providerId = :userId', { userId });
        }),
      )
      .orderBy('conversation.updatedAt', 'DESC')
      .getMany();

    // Get unread counts for each conversation
    const unreadCounts = await Promise.all(
      conversations.map(async (conv) => {
        const count = await this.messageRepository.count({
          where: {
            conversationId: conv.id,
            senderId: Not(userId), // Messages not from current user
            readAt: IsNull(), // Unread messages
            deletedAt: IsNull(),
          },
        });
        return { conversationId: conv.id, count };
      })
    );

    // Attach unread counts to conversations
    const unreadMap = new Map(unreadCounts.map(({ conversationId, count }) => [conversationId, count]));
    return conversations.map((conv) => ({
      ...conv,
      unreadCount: unreadMap.get(conv.id) || 0,
    })) as any[];
  }

  async findOne(id: string, userId?: string, isAdmin: boolean = false): Promise<Conversation> {
    const conversation = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.service', 'service')
      .leftJoinAndSelect('service.category', 'category')
      .leftJoin('conversation.client', 'client')
      .leftJoin('conversation.provider', 'provider')
      .leftJoinAndSelect('conversation.messages', 'messages')
      .leftJoin('messages.sender', 'sender')
      .addSelect([
        ...this.publicUserSelect('client'),
        ...this.publicUserSelect('provider'),
        ...this.publicUserSelect('sender'),
      ])
      .where('conversation.id = :id', { id })
      .andWhere('conversation.deletedAt IS NULL')
      .orderBy('messages.createdAt', 'ASC')
      .getOne();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check if user has access to this conversation
    // Admin can access if there's a disputed milestone
    if (userId && !isAdmin && conversation.clientId !== userId && conversation.providerId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    // Mark fraud-flagged and admin-blocked messages for UI (but don't filter them out)
    // Similar to message service, show them with blocked indicators
    if (userId && !isAdmin && Array.isArray((conversation as any).messages) && (conversation as any).messages.length > 0) {
      const msgs: any[] = (conversation as any).messages;
      const fraudByMessageId = await this.fraudService.getFraudsByMessageIds(msgs.map((m) => m.id));
      (conversation as any).messages = msgs.map((m) => {
        const fd = fraudByMessageId.get(m.id);
        const isFraud = Boolean(fd);
        // Only block/hide content if confidence is high OR if it was auto-blocked (count reached 10)
        // Medium/low confidence fraud should NOT block - only request admin review
        const isHighConfidenceFraud = fd && fd.confidence === 'high';
        const isAdminBlocked = m.adminBlockedAt && m.senderId !== userId;
        // Only hide content if: (high confidence fraud AND not sender) OR (admin blocked)
        const shouldHideContent = (isHighConfidenceFraud && m.senderId !== userId) || isAdminBlocked;

        const viewModel: any = {
          ...m,
          // isFraud should be true only if it's actually blocked (high confidence or count reached 10)
          // Medium/low confidence fraud exists but shouldn't be marked as blocked
          isFraud: isHighConfidenceFraud || false,
          isAdminBlocked: isAdminBlocked,
          adminBlockedAt: m.adminBlockedAt,
          fraud: fd
            ? {
                category: fd.category || null,
                reason: fd.reason || null,
                confidence: fd.confidence || null,
              }
            : undefined,
          contentHiddenForViewer: shouldHideContent,
        };

        if (shouldHideContent) {
          viewModel.message = '';
          viewModel.attachmentFiles = [];
          if (isAdminBlocked) {
            viewModel.adminBlockReason = 'This message is blocked by admin';
          }
        }

        return viewModel;
      });
    }

    // Attach pending reactivation request summary for UI (disable button for both sides)
    const pending = await this.conversationReactivationRequestRepository.findOne({
      where: { conversationId: conversation.id, status: ReactivationRequestStatus.PENDING } as any,
      order: { createdAt: 'DESC' } as any,
    });
    (conversation as any).reactivationRequestPending = Boolean(pending);
    (conversation as any).pendingReactivationRequest = pending
      ? {
          id: pending.id,
          requesterId: pending.requesterId,
          createdAt: pending.createdAt,
          status: pending.status,
        }
      : null;

    return conversation;
  }

  async findByServiceId(serviceId: string, userId: string): Promise<Conversation | null> {
    return this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.service', 'service')
      .leftJoin('conversation.client', 'client')
      .leftJoin('conversation.provider', 'provider')
      .addSelect([
        ...this.publicUserSelect('client'),
        ...this.publicUserSelect('provider'),
      ])
      .where('conversation.serviceId = :serviceId', { serviceId })
      .andWhere('conversation.clientId = :userId', { userId })
      .andWhere('conversation.deletedAt IS NULL')
      .getOne();
  }

  async findByServiceIdAsProvider(serviceId: string, providerId: string): Promise<Conversation[]> {
    // Verify the service belongs to the provider
    const service = await this.serviceRepository.findOne({
      where: { id: serviceId, userId: providerId, deletedAt: null },
    });

    if (!service) {
      throw new ForbiddenException('You are not the provider of this service');
    }

    const conversations = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.service', 'service')
      .leftJoin('conversation.client', 'client')
      .addSelect(this.publicUserSelect('client'))
      .where('conversation.serviceId = :serviceId', { serviceId })
      .andWhere('conversation.providerId = :providerId', { providerId })
      .andWhere('conversation.deletedAt IS NULL')
      .orderBy('conversation.updatedAt', 'DESC')
      .getMany();

    // Load last message for each conversation
    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conversation) => {
        const messages = await this.messageRepository
          .createQueryBuilder('message')
          .leftJoin('message.sender', 'sender')
          .addSelect(this.publicUserSelect('sender'))
          .where('message.conversationId = :conversationId', { conversationId: conversation.id })
          .andWhere('message.deletedAt IS NULL')
          .orderBy('message.createdAt', 'DESC')
          .take(1)
          .getMany();
        return {
          ...conversation,
          messages: messages || [],
        };
      }),
    );

    return conversationsWithMessages;
  }

  async findDisputed(): Promise<Array<Conversation & { disputedMilestones: any[] }>> {
    // Find all milestones with dispute status
    const disputedMilestones = await this.milestoneRepository
      .createQueryBuilder('milestone')
      .leftJoin('milestone.client', 'client')
      .leftJoin('milestone.provider', 'provider')
      .leftJoinAndSelect('milestone.service', 'service')
      .addSelect([
        ...this.publicUserSelect('client'),
        ...this.publicUserSelect('provider'),
      ])
      .where('milestone.status = :status', { status: MilestoneStatus.DISPUTE })
      .andWhere('milestone.deletedAt IS NULL')
      .orderBy('milestone.createdAt', 'DESC')
      .getMany();

    if (disputedMilestones.length === 0) {
      return [];
    }

    // Group milestones by conversation
    const conversationMap = new Map<string, any[]>();
    const conversationIds = new Set<string>();

    for (const milestone of disputedMilestones) {
      // Find conversation by service, client, and provider
      const conversation = await this.conversationRepository.findOne({
        where: {
          serviceId: milestone.serviceId,
          clientId: milestone.clientId,
          providerId: milestone.providerId,
          deletedAt: null,
        },
      });
      if (conversation) {
        conversationIds.add(conversation.id);
        if (!conversationMap.has(conversation.id)) {
          conversationMap.set(conversation.id, []);
        }
        conversationMap.get(conversation.id)!.push(milestone);
      }
    }

    if (conversationIds.size === 0) {
      return [];
    }

    // Fetch all disputed conversations
    const conversations = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.service', 'service')
      .leftJoinAndSelect('service.category', 'category')
      .leftJoinAndSelect('conversation.client', 'client')
      .leftJoinAndSelect('conversation.provider', 'provider')
      .where('conversation.id IN (:...ids)', { ids: Array.from(conversationIds) })
      .andWhere('conversation.deletedAt IS NULL')
      .orderBy('conversation.updatedAt', 'DESC')
      .getMany();

    // Attach disputed milestones to each conversation
    return conversations.map(conv => ({
      ...conv,
      disputedMilestones: conversationMap.get(conv.id) || [],
    }));
  }
}

