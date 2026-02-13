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
import { StorageService } from '../storage/storage.service';
import { FraudDetectorService } from '../fraud/fraud-detector.service';

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
    private storageService: StorageService,
    private fraudDetector: FraudDetectorService,
  ) {}


  private readonly publicUserFields = ['id', 'firstName', 'lastName', 'userName', 'avatar'];

  private publicUserSelect(alias: string): string[] {
    return this.publicUserFields.map((field) => `${alias}.${field}`);
  }

  /**
   * Check if a file URL is an image based on its extension
   */
  private isImageUrl(url: string): boolean {
    if (!url) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext));
  }

  /**
   * Check images for fraud and delete fraudulent ones
   * Returns filtered list of valid image URLs and fraud detection results
   */
  private async checkImagesForFraud(imageUrls: string[]): Promise<{
    validUrls: string[];
    fraudDetected: boolean;
    fraudResults: Array<{ url: string; decision: any }>;
  }> {
    const validUrls: string[] = [];
    const fraudResults: Array<{ url: string; decision: any }> = [];
    let fraudDetected = false;

    for (const url of imageUrls) {
      if (!this.isImageUrl(url)) {
        // Not an image, keep it
        validUrls.push(url);
        continue;
      }

      try {
        // Check image for fraud
        const decision = await this.fraudDetector.decideImage(url);
        fraudResults.push({ url, decision });

        if (decision.fraud) {
          fraudDetected = true;
          // Delete fraudulent image from cloud storage
          try {
            await this.storageService.deleteFile(url);
          } catch (deleteError) {
            // Log but don't fail - image might already be deleted or URL might be invalid
            console.error(`Failed to delete fraudulent image: ${url}`, deleteError);
          }
        } else {
          // Image is valid, keep it
          validUrls.push(url);
        }
      } catch (error) {
        // If fraud check fails, be conservative and keep the image
        // (or you could delete it - depends on your policy)
        console.error(`Failed to check image for fraud: ${url}`, error);
        validUrls.push(url);
      }
    }

    return { validUrls, fraudDetected, fraudResults };
  }

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

    // Check images for fraud before saving message
    // IMPORTANT: Admin messages completely bypass fraud detection - admins can send any content
    // Images are uploaded first, then checked here before message is saved (only for non-admin users)
    let finalAttachmentFiles = createMessageDto.attachmentFiles || [];
    let imageFraudDetected = false;
    let imageFraudResults: Array<{ url: string; decision: any }> = [];

    // Skip image fraud detection for admin messages
    if (!isAdmin && createMessageDto.attachmentFiles && createMessageDto.attachmentFiles.length > 0) {
      const imageCheckResult = await this.checkImagesForFraud(createMessageDto.attachmentFiles);
      finalAttachmentFiles = imageCheckResult.validUrls;
      imageFraudDetected = imageCheckResult.fraudDetected;
      imageFraudResults = imageCheckResult.fraudResults;

      // If all images were fraudulent and removed, and there's no text message, handle blocking
      if (imageFraudDetected && finalAttachmentFiles.length === 0 && (!createMessageDto.message || !createMessageDto.message.trim())) {
        // All attachments were fraudulent images and no text - block the message
        // Find the highest confidence fraud result
        const highestConfidenceFraud = imageFraudResults
          .filter(r => r.decision.fraud)
          .sort((a, b) => {
            const confOrder = { high: 3, medium: 2, low: 1 };
            return (confOrder[b.decision.confidence as keyof typeof confOrder] || 0) - 
                   (confOrder[a.decision.confidence as keyof typeof confOrder] || 0);
          })[0];

        if (highestConfidenceFraud) {
          // Create a temporary message to evaluate fraud (will be deleted if high confidence)
          const tempMessage = this.messageRepository.create({
            conversationId,
            senderId: userId,
            message: '[Image blocked - fraudulent content detected]',
            attachmentFiles: [],
          });
          const savedTempMessage = await this.messageRepository.save(tempMessage);

          // Create fraud record for the blocked image message
          await this.fraudService.createFraudRecord(
            conversationId,
            savedTempMessage.id,
            userId,
            '[Image blocked - fraudulent content detected]',
            highestConfidenceFraud.decision.category || 'fraudulent_image',
            highestConfidenceFraud.decision.reason || 'Fraudulent image detected and blocked',
            highestConfidenceFraud.decision.confidence || 'medium',
          );

          // If high confidence, delete the message and block conversation
          if (highestConfidenceFraud.decision.confidence === 'high') {
            await this.messageRepository.remove(savedTempMessage);
            // Reset fraud detection count to 0 when fraud is auto-detected (image fraud)
            // This ensures the sliding window starts fresh after automatic blocking
            // After reset, fraud detection count starts from 0 again
            this.fraudService.resetFraudDetectionCount(conversationId);
            // Block conversation if threshold reached
            const fraudCount = await this.fraudService.getFraudCount(conversationId);
            if (fraudCount >= 5 && !conversation.isBlocked) {
              await this.conversationRepository.update(conversationId, {
                isBlocked: true,
                blockedAt: new Date(),
                blockedReason: 'fraud_threshold_reached',
                updatedAt: new Date(),
              } as any);
            }
            throw new ForbiddenException('Message blocked: fraudulent image detected');
          }

          // For low/medium confidence, keep the message but mark for review
          // Load message with sender info for WebSocket emission
          const messageWithSender = await this.findOne(savedTempMessage.id);
          const participantIds = Array.from(
            new Set([conversation.clientId, conversation.providerId, userId].filter(Boolean)),
          ) as string[];
          
          for (const pid of participantIds) {
            this.chatGateway.server.to(`user:${pid}`).emit('new_message', messageWithSender);
          }
          this.chatGateway.server.to(`conversation:${conversationId}`).emit('new_message', messageWithSender);

          return savedTempMessage;
        }
      }
    }

    const message = this.messageRepository.create({
      conversationId,
      senderId: userId,
      message: createMessageDto.message,
      attachmentFiles: finalAttachmentFiles,
    });

    const savedMessage = await this.messageRepository.save(message);

    // If image fraud was detected (but message wasn't fully blocked), create fraud records
    if (!isAdmin && imageFraudDetected && imageFraudResults.length > 0) {
      for (const result of imageFraudResults) {
        if (result.decision.fraud) {
          await this.fraudService.createFraudRecord(
            conversationId,
            savedMessage.id,
            userId,
            `[Image blocked: ${result.url}]`,
            result.decision.category || 'fraudulent_image',
            result.decision.reason || 'Fraudulent image detected and blocked',
            result.decision.confidence || 'medium',
          );
        }
      }
    }

    // Update conversation's updatedAt
    await this.conversationRepository.update(conversationId, { updatedAt: new Date() });

    // Load message with sender info for WebSocket emission
    const messageWithSender = await this.findOne(savedMessage.id);

    // Deliver the message immediately to ALL participants (sender + receiver) before fraud check
    // Emit to BOTH user rooms (for notifications) AND conversation room (for active viewers)
    const participantIds = Array.from(
      new Set([conversation.clientId, conversation.providerId, userId].filter(Boolean)),
    ) as string[];
    
    // Emit to user rooms (for users not actively viewing the chat)
    for (const pid of participantIds) {
      this.chatGateway.server.to(`user:${pid}`).emit('new_message', messageWithSender);
    }
    
    // ALSO emit to conversation room (for users actively viewing the chat)
    // This ensures messages appear in real-time when both users are viewing the conversation
    this.chatGateway.server.to(`conversation:${conversationId}`).emit('new_message', messageWithSender);

    // Evaluate fraud AFTER message has been delivered (post-send check requirement)
    // IMPORTANT: Admin messages completely bypass fraud detection - admins can send any content
    // Skip fraud detection for admin messages (both text and image fraud checks are skipped)
    const fraudResult = isAdmin
      ? { isFraud: false, conversationBlocked: Boolean(conversation.isBlocked) }
      : await this.fraudService.evaluateMessage(conversationId, savedMessage);

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

      // Emit fraud flag to both user rooms and conversation room
      for (const pid of participantIds) {
        this.chatGateway.server.to(`user:${pid}`).emit('message_fraud', fraudPayload);
      }
      this.chatGateway.server.to(`conversation:${conversationId}`).emit('message_fraud', fraudPayload);
    }

    if (fraudResult.conversationBlocked) {
      // Both participants must know the conversation got blocked
      // Emit to both user rooms and conversation room
      for (const pid of allParticipants) {
        this.chatGateway.server.to(`user:${pid}`).emit('conversation_blocked', {
          conversationId,
          reason: 'fraud_threshold_reached',
        });
      }
      this.chatGateway.server.to(`conversation:${conversationId}`).emit('conversation_blocked', {
        conversationId,
        reason: 'fraud_threshold_reached',
      });
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
          'New message from ' + senderName,
          messagePreview,
          { conversationId, messageId: savedMessage.id },
        );

        // Check if user is online (has active socket connection)
        const isUserOnline = this.chatGateway.isUserOnline(recipientId);

        // Send push notification only if user is offline (site closed)
        // If user is online but not in room, browser notification will be handled by frontend
        if (!isUserOnline) {
          await this.notificationService.sendPushNotification(
            recipientId,
            senderName,
            messagePreview,
            {
              url: `/chat/${conversationId}`,
              conversationId,
              messageId: savedMessage.id,
            },
          );
        }
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
      .leftJoin('message.sender', 'sender')
      .addSelect(this.publicUserSelect('sender'))
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
              reviewedAt: isAdmin ? (fd.reviewedAt ? fd.reviewedAt.toISOString() : null) : undefined,
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
    const message = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.conversation', 'conversation')
      .leftJoin('message.sender', 'sender')
      .addSelect(this.publicUserSelect('sender'))
      .where('message.id = :id', { id })
      .andWhere('message.deletedAt IS NULL')
      .getOne();

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

