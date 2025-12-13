import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Milestone, MilestoneStatus } from '../entities/milestone.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneStatusDto } from './dto/update-milestone-status.dto';
import { ReleaseMilestoneDto } from './dto/release-milestone.dto';
import { ChatGateway } from '../chat/chat.gateway';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class MilestoneService {
  constructor(
    @InjectRepository(Milestone)
    private milestoneRepository: Repository<Milestone>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
    @Inject(forwardRef(() => PaymentService))
    private paymentService: PaymentService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
  ) {}

  async create(conversationId: string, userId: string, createMilestoneDto: CreateMilestoneDto): Promise<Milestone> {
    // Verify conversation exists and user is the client
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, deletedAt: null },
      relations: ['service'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.clientId !== userId) {
      throw new ForbiddenException('Only the client can create milestones');
    }

    // Check client balance
    const balance = await this.paymentService.getBalance(userId);
    if (Number(balance.amount) < Number(createMilestoneDto.balance)) {
      throw new BadRequestException('Insufficient balance to create milestone');
    }

    const milestone = this.milestoneRepository.create({
      clientId: conversation.clientId,
      providerId: conversation.providerId,
      serviceId: createMilestoneDto.serviceId || conversation.serviceId,
      title: createMilestoneDto.title,
      description: createMilestoneDto.description,
      attachedFiles: createMilestoneDto.attachedFiles,
      balance: createMilestoneDto.balance,
      status: MilestoneStatus.DRAFT,
    });

    const savedMilestone = await this.milestoneRepository.save(milestone);
    
    // Deduct balance and create transaction
    await this.paymentService.createMilestoneTransaction(
      userId,
      savedMilestone.id,
      createMilestoneDto.balance,
      conversation.clientId,
      conversation.providerId,
    );
    
    // Get client info for notification
    const client = await this.userRepository.findOne({ where: { id: userId } });
    const clientName = client
      ? `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.userName || 'A client'
      : 'A client';

    // Send notification to provider about new milestone
    await this.notificationService.createNotification(
      conversation.providerId,
      NotificationType.MILESTONE_CREATED,
      'New Milestone Created',
      `${clientName} created a new milestone "${savedMilestone.title}" for ${Number(savedMilestone.balance).toFixed(2)} USDT`,
      { milestoneId: savedMilestone.id, conversationId, clientId: userId },
    );

    // Send notification to client confirming milestone creation
    await this.notificationService.createNotification(
      userId,
      NotificationType.MILESTONE_CREATED,
      'Milestone Created',
      `You created a milestone "${savedMilestone.title}" for ${Number(savedMilestone.balance).toFixed(2)} USDT. Waiting for provider to accept.`,
      { milestoneId: savedMilestone.id, conversationId },
    );
    
    // Emit milestone update via WebSocket
    this.chatGateway.emitMilestoneUpdate(conversationId, savedMilestone).catch((error) => {
      console.error('Failed to emit milestone update:', error);
    });

    return savedMilestone;
  }

  async findAll(conversationId: string, userId: string, isAdmin: boolean = false): Promise<Milestone[]> {
    // Verify conversation exists and user has access
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, deletedAt: null },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Admin can access if there's a disputed milestone
    if (!isAdmin && conversation.clientId !== userId && conversation.providerId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    return this.milestoneRepository.find({
      where: [
        { clientId: conversation.clientId, providerId: conversation.providerId, serviceId: conversation.serviceId, deletedAt: null },
      ],
      relations: ['client', 'provider', 'service'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId?: string, isAdmin: boolean = false): Promise<Milestone> {
    const milestone = await this.milestoneRepository.findOne({
      where: { id, deletedAt: null },
      relations: ['client', 'provider', 'service'],
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    // Admin can access any milestone
    if (userId && !isAdmin && milestone.clientId !== userId && milestone.providerId !== userId) {
      throw new ForbiddenException('You do not have access to this milestone');
    }

    return milestone;
  }

  async updateStatus(id: string, userId: string, updateStatusDto: UpdateMilestoneStatusDto, isAdmin: boolean = false): Promise<Milestone> {
    const milestone = await this.findOne(id, userId, isAdmin);
    const oldStatus = milestone.status;

    // Validate status transitions (admin can bypass validation for dispute resolution)
    if (!isAdmin) {
      const validTransitions = this.getValidStatusTransitions(milestone.status, userId, milestone.clientId, milestone.providerId);
      
      if (!validTransitions.includes(updateStatusDto.status)) {
        throw new BadRequestException(`Invalid status transition from ${milestone.status} to ${updateStatusDto.status}`);
      }
    }

    // Prevent ALL users (including admins) from releasing milestone through updateStatus
    // Everyone must use the releaseMilestone endpoint which requires feedback and rating
    // This ensures data consistency - all released milestones must have feedback and rating
    if (updateStatusDto.status === MilestoneStatus.RELEASED) {
      throw new BadRequestException('To release a milestone, please use the /release endpoint which requires feedback and rating');
    }

    milestone.status = updateStatusDto.status;
    const savedMilestone = await this.milestoneRepository.save(milestone);
    
    // If milestone is withdrawn, update transaction status and refund client balance
    if (updateStatusDto.status === MilestoneStatus.WITHDRAW) {
      await this.paymentService.withdrawMilestoneTransaction(savedMilestone.id, savedMilestone.providerId);
    }
    
    // If milestone is cancelled, update transaction status and refund client balance
    if (updateStatusDto.status === MilestoneStatus.CANCELED) {
      await this.paymentService.cancelMilestoneTransaction(savedMilestone.id, savedMilestone.clientId);
    }
    
    // Find conversation ID from milestone
    const milestoneWithConversation = await this.milestoneRepository.findOne({
      where: { id: savedMilestone.id },
      relations: ['service'],
    });
    
    if (milestoneWithConversation) {
      // Find conversation by service, client, and provider
      const conv = await this.conversationRepository.findOne({
        where: {
          serviceId: milestoneWithConversation.serviceId,
          clientId: milestone.clientId,
          providerId: milestone.providerId,
          deletedAt: null,
        },
      });
      
      if (conv) {
        // Get user info for notifications
        const updatedBy = await this.userRepository.findOne({ where: { id: userId } });
        const updatedByName = updatedBy
          ? `${updatedBy.firstName || ''} ${updatedBy.lastName || ''}`.trim() || updatedBy.userName || 'Someone'
          : 'Someone';

        // Determine status change message
        let statusMessage = '';
        switch (updateStatusDto.status) {
          case MilestoneStatus.PROCESSING:
            statusMessage = 'accepted and started processing';
            break;
          case MilestoneStatus.COMPLETED:
            statusMessage = 'marked as completed';
            break;
          // RELEASED status is handled by releaseMilestone endpoint, not updateStatus
          // This case is unreachable due to validation check above
          case MilestoneStatus.CANCELED:
            statusMessage = 'canceled';
            break;
          case MilestoneStatus.WITHDRAW:
            statusMessage = 'requested withdrawal';
            break;
          case MilestoneStatus.DISPUTE:
            statusMessage = 'disputed';
            break;
          default:
            statusMessage = `changed to ${updateStatusDto.status}`;
        }

        // Send notification to the other party (not the one who made the change)
        const recipientId = userId === milestone.clientId ? milestone.providerId : milestone.clientId;
        if (recipientId) {
          await this.notificationService.createNotification(
            recipientId,
            NotificationType.MILESTONE_UPDATED,
            'Milestone Updated',
            `${updatedByName} ${statusMessage} the milestone "${milestone.title}"`,
            { milestoneId: savedMilestone.id, conversationId: conv.id, status: updateStatusDto.status },
          );
        }

        // Also notify the person who made the change (confirmation)
        await this.notificationService.createNotification(
          userId,
          NotificationType.MILESTONE_UPDATED,
          'Milestone Updated',
          `You ${statusMessage} the milestone "${milestone.title}"`,
          { milestoneId: savedMilestone.id, conversationId: conv.id, status: updateStatusDto.status },
        );
        
        // Create a system message for milestone status update
        const statusChangeMessage = this.messageRepository.create({
          conversationId: conv.id,
          senderId: userId,
          message: `Milestone "${milestone.title}" status changed from ${oldStatus} to ${updateStatusDto.status}`,
        });
        
        const savedMessage = await this.messageRepository.save(statusChangeMessage);
        
        // Update conversation's updatedAt
        await this.conversationRepository.update(conv.id, { updatedAt: new Date() });
        
        // Load message with sender info
        const messageWithSender = await this.messageRepository.findOne({
          where: { id: savedMessage.id },
          relations: ['sender'],
        });
        
        // Emit new message via WebSocket
        if (messageWithSender) {
          this.chatGateway.server.to(`conversation:${conv.id}`).emit('new_message', messageWithSender);
        }
        
        // Also emit milestone update via WebSocket
        this.chatGateway.emitMilestoneUpdate(conv.id, savedMilestone).catch((error) => {
          console.error('Failed to emit milestone update:', error);
        });
      }
    }
    
    return savedMilestone;
  }

  async releaseMilestone(id: string, userId: string, releaseMilestoneDto: ReleaseMilestoneDto, isAdmin: boolean = false): Promise<Milestone> {
    const milestone = await this.findOne(id, userId, isAdmin);
    
    // Only client can release milestone or add feedback to admin-released milestones
    if (!isAdmin && milestone.clientId !== userId) {
      throw new ForbiddenException('Only the client can release a milestone or provide feedback');
    }

    // Check if milestone is already released by admin (RELEASED status but no feedback)
    const isAdminReleased = milestone.status === MilestoneStatus.RELEASED && 
                           (!milestone.feedback || milestone.feedback.trim().length === 0);

    // If milestone is already released by admin, allow client to add feedback
    if (isAdminReleased) {
      // Validate feedback and rating are provided
      if (!releaseMilestoneDto.feedback || !releaseMilestoneDto.feedback.trim()) {
        throw new BadRequestException('Feedback is required');
      }

      if (!releaseMilestoneDto.rating || releaseMilestoneDto.rating < 1 || releaseMilestoneDto.rating > 5) {
        throw new BadRequestException('Rating must be between 1 and 5');
      }

      // Update milestone with feedback and rating (status already RELEASED)
      milestone.feedback = releaseMilestoneDto.feedback;
      milestone.rating = releaseMilestoneDto.rating;
    } else {
      // Normal release flow - validate status transition
      if (!isAdmin) {
        const validTransitions = this.getValidStatusTransitions(milestone.status, userId, milestone.clientId, milestone.providerId);
        
        if (!validTransitions.includes(MilestoneStatus.RELEASED)) {
          throw new BadRequestException(`Invalid status transition from ${milestone.status} to ${MilestoneStatus.RELEASED}`);
        }
      }

      // Validate feedback and rating are provided
      if (!releaseMilestoneDto.feedback || !releaseMilestoneDto.feedback.trim()) {
        throw new BadRequestException('Feedback is required when releasing a milestone');
      }

      if (!releaseMilestoneDto.rating || releaseMilestoneDto.rating < 1 || releaseMilestoneDto.rating > 5) {
        throw new BadRequestException('Rating must be between 1 and 5');
      }

      // Update milestone with feedback, rating, and status
      milestone.feedback = releaseMilestoneDto.feedback;
      milestone.rating = releaseMilestoneDto.rating;
      milestone.status = MilestoneStatus.RELEASED;
    }
    
    const savedMilestone = await this.milestoneRepository.save(milestone);
    
    // Update transaction and provider balance only if this is a new release (not just adding feedback)
    if (!isAdminReleased) {
      await this.paymentService.releaseMilestoneTransaction(savedMilestone.id, savedMilestone.providerId);
    }
    
    // Find conversation ID from milestone
    const milestoneWithConversation = await this.milestoneRepository.findOne({
      where: { id: savedMilestone.id },
      relations: ['service'],
    });
    
    if (milestoneWithConversation) {
      // Find conversation by service, client, and provider
      const conv = await this.conversationRepository.findOne({
        where: {
          serviceId: milestoneWithConversation.serviceId,
          clientId: milestone.clientId,
          providerId: milestone.providerId,
          deletedAt: null,
        },
      });
      
      if (conv) {
        // Get user info for notifications
        const client = await this.userRepository.findOne({ where: { id: userId } });
        const clientName = client
          ? `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.userName || 'A client'
          : 'A client';

        if (isAdminReleased) {
          // Client is adding feedback to admin-released milestone
          await this.notificationService.createNotification(
            milestone.providerId,
            NotificationType.MILESTONE_UPDATED,
            'Feedback Added',
            `${clientName} provided feedback for milestone "${milestone.title}" with a ${releaseMilestoneDto.rating}-star rating`,
            { milestoneId: savedMilestone.id, conversationId: conv.id, status: MilestoneStatus.RELEASED },
          );

          await this.notificationService.createNotification(
            userId,
            NotificationType.MILESTONE_UPDATED,
            'Feedback Submitted',
            `You provided feedback for milestone "${milestone.title}". Thank you for your review!`,
            { milestoneId: savedMilestone.id, conversationId: conv.id, status: MilestoneStatus.RELEASED },
          );
          
          // Create a system message for feedback
          const statusChangeMessage = this.messageRepository.create({
            conversationId: conv.id,
            senderId: userId,
            message: `Feedback added for milestone "${milestone.title}" with a ${releaseMilestoneDto.rating}-star rating. Feedback: ${releaseMilestoneDto.feedback}`,
          });
          
          const savedMessage = await this.messageRepository.save(statusChangeMessage);
          
          // Update conversation's updatedAt
          await this.conversationRepository.update(conv.id, { updatedAt: new Date() });
          
          // Load message with sender info
          const messageWithSender = await this.messageRepository.findOne({
            where: { id: savedMessage.id },
            relations: ['sender'],
          });
          
          // Emit new message via WebSocket
          if (messageWithSender) {
            this.chatGateway.server.to(`conversation:${conv.id}`).emit('new_message', messageWithSender);
          }
        } else {
          // Normal milestone release
          await this.notificationService.createNotification(
            milestone.providerId,
            NotificationType.MILESTONE_UPDATED,
            'Milestone Released',
            `${clientName} released the milestone "${milestone.title}" with a ${releaseMilestoneDto.rating}-star rating`,
            { milestoneId: savedMilestone.id, conversationId: conv.id, status: MilestoneStatus.RELEASED },
          );

          await this.notificationService.createNotification(
            userId,
            NotificationType.MILESTONE_UPDATED,
            'Milestone Released',
            `You released the milestone "${milestone.title}". Provider can now accept the payment.`,
            { milestoneId: savedMilestone.id, conversationId: conv.id, status: MilestoneStatus.RELEASED },
          );
          
          // Create a system message for milestone release
          const statusChangeMessage = this.messageRepository.create({
            conversationId: conv.id,
            senderId: userId,
            message: `Milestone "${milestone.title}" has been released with a ${releaseMilestoneDto.rating}-star rating. Feedback: ${releaseMilestoneDto.feedback}`,
          });
          
          const savedMessage = await this.messageRepository.save(statusChangeMessage);
          
          // Update conversation's updatedAt
          await this.conversationRepository.update(conv.id, { updatedAt: new Date() });
          
          // Load message with sender info
          const messageWithSender = await this.messageRepository.findOne({
            where: { id: savedMessage.id },
            relations: ['sender'],
          });
          
          // Emit new message via WebSocket
          if (messageWithSender) {
            this.chatGateway.server.to(`conversation:${conv.id}`).emit('new_message', messageWithSender);
          }
        }
        
        // Also emit milestone update via WebSocket (for both cases)
        this.chatGateway.emitMilestoneUpdate(conv.id, savedMilestone).catch((error) => {
          console.error('Failed to emit milestone update:', error);
        });
      }
    }
    
    return savedMilestone;
  }

  private getValidStatusTransitions(
    currentStatus: MilestoneStatus,
    userId: string,
    clientId: string,
    providerId: string,
  ): MilestoneStatus[] {
    const isClient = userId === clientId;
    const isProvider = userId === providerId;

    switch (currentStatus) {
      case MilestoneStatus.DRAFT:
        if (isProvider) return [MilestoneStatus.PROCESSING];
        if (isClient) return [MilestoneStatus.CANCELED];
        return [];
      
      case MilestoneStatus.PROCESSING:
        if (isProvider) return [MilestoneStatus.COMPLETED, MilestoneStatus.WITHDRAW];
        // Client cannot cancel after provider has accepted (status is PROCESSING)
        if (isClient) return [];
        return [];
      
      case MilestoneStatus.COMPLETED:
        if (isClient) return [MilestoneStatus.RELEASED, MilestoneStatus.DISPUTE];
        if (isProvider) return [MilestoneStatus.DISPUTE];
        return [];
      
      case MilestoneStatus.RELEASED:
        // No transitions from released
        return [];
      
      case MilestoneStatus.CANCELED:
        // No transitions from canceled
        return [];
      
      case MilestoneStatus.WITHDRAW:
        // No transitions from withdraw
        return [];
      
      case MilestoneStatus.DISPUTE:
        // Only admin can resolve disputes
        return [];
      
      default:
        return [];
    }
  }
}

