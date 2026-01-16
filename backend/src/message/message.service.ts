import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { Conversation } from '../entities/conversation.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import { FraudService } from '../fraud/fraud.service';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    private fraudService: FraudService,
  ) {}

  async create(conversationId: string, userId: string, createMessageDto: CreateMessageDto, isAdmin: boolean = false): Promise<Message> {
    // Verify conversation exists and user has access
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, deletedAt: null },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Admin can send messages to disputed conversations
    if (!isAdmin && conversation.clientId !== userId && conversation.providerId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    // Blocked conversation: client/provider cannot send messages
    if (!isAdmin && conversation.isBlocked) {
      throw new ForbiddenException('This conversation is blocked due to fraud detection. You can request reactivation.');
    }

    const message = this.messageRepository.create({
      conversationId,
      senderId: userId,
      message: createMessageDto.message,
      attachmentFiles: createMessageDto.attachmentFiles,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Update conversation's updatedAt
    await this.conversationRepository.update(conversationId, { updatedAt: new Date() });

    // Load message with sender info for WebSocket emission
    const messageWithSender = await this.findOne(savedMessage.id);

    // Deliver the message immediately to ALL participants (sender + receiver) before fraud check
    const participantIds = Array.from(
      new Set([conversation.clientId, conversation.providerId, userId].filter(Boolean)),
    ) as string[];
    for (const pid of participantIds) {
      this.chatGateway.server.to(`user:${pid}`).emit('new_message', messageWithSender);
    }

    // Evaluate fraud AFTER message has been delivered (post-send check requirement)
    const fraudResult = await this.fraudService.evaluateMessage(conversationId, savedMessage);

    const recipients = [conversation.clientId, conversation.providerId].filter((id) => id && id !== userId);
    const allParticipants = Array.from(new Set([conversation.clientId, conversation.providerId].filter(Boolean))) as string[];

    if (fraudResult.isFraud) {
      // Inform ALL participants that the message was flagged (receiver will hide content client-side)
      const fraudByMessageId = await this.fraudService.getFraudsByMessageIds([savedMessage.id]);
      const fd = fraudByMessageId.get(savedMessage.id);

      const fraudPayload = {
        conversationId,
        messageId: savedMessage.id,
        fraud: fd
          ? {
              category: fd.category || null,
              reason: fd.reason || null,
              confidence: fd.confidence || null,
            }
          : { category: null, reason: null, confidence: null },
      };

      for (const pid of participantIds) {
        this.chatGateway.server.to(`user:${pid}`).emit('message_fraud', fraudPayload);
      }
    }

    if (fraudResult.conversationBlocked) {
      // Both participants must know the conversation got blocked
      for (const pid of allParticipants) {
        this.chatGateway.server.to(`user:${pid}`).emit('conversation_blocked', {
          conversationId,
          reason: 'fraud_threshold_reached',
        });
      }
    }

    // Create notification for recipients (client and provider) only if they're not in the conversation room
    // Only send notifications for non-fraud messages (since receiver won't see fraud messages)
    if (fraudResult.isFraud) {
      return messageWithSender;
    }
    
    for (const recipientId of recipients) {
      // Check if recipient is in the conversation room (i.e., currently viewing the chat)
      let recipientIsInRoom = false;
      try {
        // Use fetchSockets to get all sockets in the room
        const socketsInRoom = await this.chatGateway.server.in(`conversation:${conversationId}`).fetchSockets();
        recipientIsInRoom = socketsInRoom.some((socket) => {
          return socket.data.userId === recipientId;
        });
      } catch (error) {
        // If we can't check, assume recipient is not in room (safer to send notification)
        console.error('Error checking if recipient is in room:', error);
        recipientIsInRoom = false;
      }

      // Only send notification if recipient is NOT in the conversation room
      if (!recipientIsInRoom) {
        const senderName = messageWithSender.sender
          ? `${messageWithSender.sender.firstName || ''} ${messageWithSender.sender.lastName || ''}`.trim() || messageWithSender.sender.userName || 'Someone'
          : 'Someone';
        
        const messagePreview = createMessageDto.message.length > 100 
          ? createMessageDto.message.substring(0, 100) + '...'
          : createMessageDto.message;

        await this.notificationService.createNotification(
          recipientId,
          NotificationType.MESSAGE,
          'New Message',
          `${senderName}: ${messagePreview}`,
          { conversationId, messageId: savedMessage.id },
        );
      }
    }

    return messageWithSender;
  }

  async findAll(
    conversationId: string,
    userId: string,
    isAdmin: boolean = false,
    limit: number = 50,
    before?: string,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    // Verify conversation exists and user has access
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, deletedAt: null },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!isAdmin && conversation.clientId !== userId && conversation.providerId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .andWhere('message.deletedAt IS NULL')
      .leftJoinAndSelect('message.sender', 'sender')
      .orderBy('message.createdAt', 'DESC')
      .take(limit + 1); // Fetch one extra to check if there are more

    // If before is provided, fetch messages before that message
    if (before) {
      const beforeMessage = await this.messageRepository.findOne({
        where: { id: before },
      });
      if (beforeMessage) {
        queryBuilder.andWhere('message.createdAt < :beforeDate', {
          beforeDate: beforeMessage.createdAt,
        });
      }
    }

    const messages = await queryBuilder.getMany();
    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    // Attach fraud info (if any) for UI rendering and hide content from receivers when flagged
    const fraudByMessageId = await this.fraudService.getFraudsByMessageIds(resultMessages.map((m) => m.id));
    const visibleMessages = resultMessages.map((m) => {
      const fd = fraudByMessageId.get(m.id);
      const isFraud = Boolean(fd);
      const shouldHideContent = !isAdmin && isFraud && m.senderId !== userId;

      const viewModel: any = {
        ...m,
        isFraud,
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
      }

      return viewModel;
    });

    // Reverse to get chronological order (oldest to newest)
    return {
      messages: visibleMessages.reverse(),
      hasMore,
    };
  }

  async findOne(id: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id, deletedAt: null },
      relations: ['sender', 'conversation'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const fraudByMessageId = await this.fraudService.getFraudsByMessageIds([message.id]);
    const fd = fraudByMessageId.get(message.id);
    if (fd) {
      (message as any).isFraud = true;
      (message as any).fraud = {
        category: fd.category || null,
        reason: fd.reason || null,
        confidence: fd.confidence || null,
      };
    } else {
      (message as any).isFraud = false;
    }

    return message;
  }

  async remove(id: string, userId: string, isAdmin: boolean = false): Promise<{ messageId: string; conversationId: string }> {
    const message = await this.messageRepository.findOne({
      where: { id, deletedAt: null },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (!isAdmin && message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.messageRepository.softDelete({ id });

    // Emit to conversation room so both sides update immediately
    this.chatGateway.server.to(`conversation:${message.conversationId}`).emit('message_deleted', {
      conversationId: message.conversationId,
      messageId: id,
    });

    // Also emit to both participants' user rooms (for clients not currently in the conversation room)
    try {
      const conversation = await this.conversationRepository.findOne({
        where: { id: message.conversationId, deletedAt: null },
      });
      if (conversation) {
        const participants = [conversation.clientId, conversation.providerId].filter(Boolean) as string[];
        participants.forEach((pid) => {
          this.chatGateway.server.to(`user:${pid}`).emit('message_deleted', {
            conversationId: message.conversationId,
            messageId: id,
          });
        });
      }
    } catch (err) {
      // Non-fatal
      console.warn('Failed to emit message_deleted to participants:', err);
    }

    return { messageId: id, conversationId: message.conversationId };
  }

  async removeBulk(
    messageIds: string[],
    userId: string,
    isAdmin: boolean = false,
  ): Promise<{ deletedIds: string[] }> {
    const uniqueIds = Array.from(new Set((messageIds || []).filter(Boolean)));
    if (uniqueIds.length === 0) {
      return { deletedIds: [] };
    }

    const messages = await this.messageRepository.find({
      where: uniqueIds.map((id) => ({ id, deletedAt: null })) as any,
    });

    // Ensure all requested ids exist
    const foundIds = new Set(messages.map((m) => m.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundException('One or more messages were not found');
    }

    if (!isAdmin) {
      const notOwned = messages.filter((m) => m.senderId !== userId);
      if (notOwned.length > 0) {
        throw new ForbiddenException('You can only delete your own messages');
      }
    }

    // Delete and emit
    await this.messageRepository.softDelete(uniqueIds);

    const byConversation = new Map<string, string[]>();
    messages.forEach((m) => {
      const list = byConversation.get(m.conversationId) || [];
      list.push(m.id);
      byConversation.set(m.conversationId, list);
    });

    byConversation.forEach((ids, conversationId) => {
      ids.forEach((mid) => {
        this.chatGateway.server.to(`conversation:${conversationId}`).emit('message_deleted', {
          conversationId,
          messageId: mid,
        });
      });
    });

    return { deletedIds: uniqueIds };
  }
}

