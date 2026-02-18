import { Injectable, ConflictException, ForbiddenException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, IsNull } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { FraudDetection } from '../entities/fraud-detection.entity';
import { ConversationReactivationRequest, ReactivationRequestStatus } from '../entities/conversation-reactivation-request.entity';
import { Message } from '../entities/message.entity';
import { FraudDetectorService } from './fraud-detector.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import { ChatGateway } from '../chat/chat.gateway';
import { MessageService } from '../message/message.service';

@Injectable()
export class FraudService {
  // Track count (0-10) per conversation for fraud detection window
  private conversationCounts = new Map<string, number>();

  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(FraudDetection)
    private fraudRepository: Repository<FraudDetection>,
    @InjectRepository(ConversationReactivationRequest)
    private reactivationRepository: Repository<ConversationReactivationRequest>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    private fraudDetector: FraudDetectorService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
    @Inject(forwardRef(() => MessageService))
    private messageService: MessageService,
  ) {}

  async evaluateMessage(conversationId: string, message: Message): Promise<{ isFraud: boolean; conversationBlocked: boolean; affectedMessageIds?: string[] }> {
    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId, deletedAt: null } });
    if (!conversation) throw new NotFoundException('Conversation not found');

    // Get current count for this conversation (default to 0)
    let count = this.conversationCounts.get(conversationId) || 0;
    
    // Increment count when new message is sent (max 10)
    count = Math.min(count + 1, 10);
    this.conversationCounts.set(conversationId, count);

    // Fetch the last 'count' messages (checking content with messages from 0 to count)
    // This creates a sliding window that grows from 1 to 10 messages
    const recentMessages = await this.messageRepository.find({
      where: { conversationId, deletedAt: null },
      order: { createdAt: 'DESC' },
      take: count,
    });

    // Reverse to get chronological order (oldest to newest)
    const messagesToCheck = recentMessages.reverse();

    // Combine messages content for fraud detection
    const combinedContent = messagesToCheck.map((m) => m.message).join('\n');

    // Run fraud detection on the combined content (always run on new message)
    const decision = await this.fraudDetector.decideText(combinedContent);
    console.log('Fraud detection result:', { fraud: decision.fraud, confidence: decision.confidence, count });
    
    // Get all affected message IDs (all messages in the sliding window)
    const affectedMessageIds = messagesToCheck.map((m) => m.id);

    // If no fraud detected, return early
    if (!decision.fraud) {
      // Reset count if it reaches 10 without fraud
      if (count >= 10) {
        this.resetFraudDetectionCount(conversationId);
      }
      return { isFraud: false, conversationBlocked: Boolean(conversation.isBlocked), affectedMessageIds: [] };
    }

    // Fraud detected - save fraud records for ALL messages in the count window
    // NOTE: We check for existing frauds regardless of review status - reviewed messages
    // are still part of the fraud detection window and count logic
    // First, check which messages already have fraud records to avoid duplicates
    const messageIds = messagesToCheck.map((m) => m.id);
    const existingFrauds = await this.fraudRepository.find({
      where: { messageId: In(messageIds) } as any,
      // Note: We don't filter by reviewedAt - all fraud records count, reviewed or not
    });
    const existingFraudMessageIds = new Set(existingFrauds.map((f) => f.messageId));

    // Create fraud records for all messages in the count window that don't already have fraud records
    const fraudsToCreate = messagesToCheck
      .filter((m) => !existingFraudMessageIds.has(m.id))
      .map((m) =>
        this.fraudRepository.create({
          conversationId,
          messageId: m.id,
          senderId: m.senderId,
          messageText: m.message,
          category: decision.category || undefined,
          reason: decision.reason || undefined,
          confidence: (decision.confidence as any) || undefined,
          signals: decision.signals || [],
        }),
      );

    if (fraudsToCreate.length > 0) {
      await this.fraudRepository.save(fraudsToCreate);
    }

    // Classify fraud confidence
    const isHighConfidenceFraud = decision.confidence === 'high';
    const isMediumConfidenceFraud = decision.confidence === 'medium';
    const isLowConfidenceFraud = decision.confidence === 'low';
    const isLowOrMediumConfidenceFraud = isLowConfidenceFraud || isMediumConfidenceFraud;

    // IMPORTANT: Reset count to 0 if fraud is detected with medium or high confidence
    // This ensures the sliding window starts fresh after fraud detection
    if (isMediumConfidenceFraud || isHighConfidenceFraud) {
      this.resetFraudDetectionCount(conversationId);
      console.log(`Count reset to 0 after fraud detection (confidence: ${decision.confidence})`);
    }

    // Block when:
    // 1. Confidence is high (regardless of count), OR
    // 2. Count reaches 10 (even if confidence is not high yet)
    const shouldBlock = isHighConfidenceFraud || count >= 10;

    // If low/medium confidence fraud, don't block - just mark for review
    if (isLowOrMediumConfidenceFraud) {
      // Reset count if it reaches 10 (even for low confidence)
      if (count >= 10) {
        this.resetFraudDetectionCount(conversationId);
        console.log('Count reset to 0 (reached 10 with low confidence)');
      }
      return { isFraud: false, conversationBlocked: Boolean(conversation.isBlocked), affectedMessageIds };
    }

    if (!shouldBlock) {
      // This should not happen since we filtered out low/medium confidence above
      // But keep as safety check - don't block, just mark for review
      return { isFraud: false, conversationBlocked: Boolean(conversation.isBlocked), affectedMessageIds };
    }

    // Block the messages (high confidence OR count reached 10)
    // Note: Count is already reset above if shouldBlock is true

    const fraudCount = await this.getFraudCount(conversationId);
    let conversationBlocked = Boolean(conversation.isBlocked);

    if (fraudCount >= 5 && !conversation.isBlocked) {
      conversationBlocked = true;
      await this.conversationRepository.update(conversationId, {
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: 'fraud_threshold_reached',
        updatedAt: new Date(),
      });
    }

    return { isFraud: true, conversationBlocked, affectedMessageIds };
  }

  /**
   * Get fraud count for a conversation
   */
  async getFraudCount(conversationId: string): Promise<number> {
    return this.fraudRepository.count({ where: { conversationId } } as any);
  }

  /**
   * Reset the fraud detection count (sliding window) to 0 for a conversation.
   * This is called when:
   * - Fraud is auto-detected (high confidence fraud - text or image)
   * - Admin reviews fraud content
   * - Admin blocks fraud content
   * 
   * After reset, the fraud detection count starts fresh from 0, allowing new messages
   * to be evaluated in a new sliding window.
   */
  resetFraudDetectionCount(conversationId: string): void {
    this.conversationCounts.set(conversationId, 0);
  }

  /**
   * Create a fraud record for a message
   */
  async createFraudRecord(
    conversationId: string,
    messageId: string,
    senderId: string,
    messageText: string,
    category?: string,
    reason?: string,
    confidence?: 'low' | 'medium' | 'high',
  ): Promise<FraudDetection> {
    const fraud = this.fraudRepository.create({
      conversationId,
      messageId,
      senderId,
      messageText,
      category: category || undefined,
      reason: reason || undefined,
      confidence: confidence || undefined,
      signals: [],
    });
    return this.fraudRepository.save(fraud);
  }

  async getFraudsByMessageIds(messageIds: string[]): Promise<Map<string, FraudDetection>> {
    const ids = (messageIds || []).filter(Boolean);
    if (ids.length === 0) return new Map();

    const frauds = await this.fraudRepository.find({
      where: { messageId: In(ids) } as any,
      order: { createdAt: 'DESC' },
    });

    // Keep the latest fraud record per message id
    const map = new Map<string, FraudDetection>();
    for (const f of frauds) {
      if (!map.has(f.messageId)) {
        map.set(f.messageId, f);
      }
    }
    return map;
  }

  async requestReactivation(conversationId: string, requesterId: string): Promise<ConversationReactivationRequest> {
    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId, deletedAt: null } });
    if (!conversation) throw new NotFoundException('Conversation not found');

    if (!conversation.isBlocked) {
      throw new ForbiddenException('Conversation is not blocked');
    }

    if (conversation.clientId !== requesterId && conversation.providerId !== requesterId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    // Only ONE pending request per conversation (either side can request, but not both)
    const existingPending = await this.reactivationRepository.findOne({
      where: { conversationId, status: ReactivationRequestStatus.PENDING },
      relations: ['requester'],
    });
    if (existingPending) {
      throw new ConflictException(
        `A reactivation request is already pending for this conversation${existingPending.requesterId ? ` (requested by ${existingPending.requesterId})` : ''}`,
      );
    }

    const req = this.reactivationRepository.create({
      conversationId,
      requesterId,
      status: ReactivationRequestStatus.PENDING,
    });
    return this.reactivationRepository.save(req);
  }

  /**
   * Mark fraud detections as reviewed.
   * This updates the review status for admin tracking purposes.
   * Also resets the fraud detection count to 0 for this conversation,
   * so the sliding window starts fresh after admin review.
   * After reset, fraud detection count starts from 0 again.
   */
  async markFraudAsReviewed(conversationId: string, adminId: string): Promise<void> {
    await this.fraudRepository.update(
      {
        conversationId,
        reviewedAt: IsNull(),
        confidence: In(['low', 'medium']), // Only low/medium confidence fraud needs review
      } as any,
      {
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
    );

    // Reset the fraud detection count to 0 when admin reviews messages
    // This ensures the sliding window starts fresh after review
    this.resetFraudDetectionCount(conversationId);
  }

  /**
   * Block messages (not conversation) and mark fraud detections as reviewed.
   * This marks all unreviewed fraud messages as reviewed and blocks the specific messages.
   * The conversation itself is NOT blocked - users can still chat.
   * Also resets the fraud detection count to 0 for this conversation.
   * After reset, fraud detection count starts from 0 again.
   */
  async blockConversationAndMarkReviewed(conversationId: string, adminId: string): Promise<void> {
    // First, mark fraud as reviewed
    await this.markFraudAsReviewed(conversationId, adminId);

    // Get all unreviewed fraud messages that need to be blocked
    const frauds = await this.fraudRepository.find({
      where: {
        conversationId,
        reviewedAt: IsNull(),
        confidence: In(['low', 'medium']), // Only block low/medium confidence messages that were reviewed
      } as any,
    });

    // Block the messages (not the conversation)
    if (frauds.length > 0) {
      const messageIds = frauds.map((f) => f.messageId);
      
      // Get messages before blocking to emit WebSocket events
      const messages = await this.messageRepository.find({
        where: { id: In(messageIds) } as any,
      });

      await this.messageRepository.update(
        { id: In(messageIds) } as any,
        {
          adminBlockedAt: new Date(),
          adminBlockedById: adminId,
        },
      );

      // Get conversation for participant IDs
      const conversation = await this.conversationRepository.findOne({
        where: { id: conversationId },
      });

      if (conversation) {
        // Get participant IDs (client and provider)
        const participantIds = Array.from(
          new Set([conversation.clientId, conversation.providerId].filter(Boolean)),
        ) as string[];

        // Emit message_updated events to receivers (not senders) to show blocked indicator
        for (const msg of messages) {
          // Load message with sender info and format it like in message service
          const messageWithSender = await this.messageService.findOne(msg.id);
          
          // Format message for receivers (hide content, show blocked indicator)
          const updatedMessage: any = {
            ...messageWithSender,
            isAdminBlocked: true,
            adminBlockedAt: new Date().toISOString(),
            adminBlockReason: 'This message is blocked by admin',
          };

          // Emit to conversation room (all participants will receive, but frontend will handle display)
          this.chatGateway.server.to(`conversation:${conversationId}`).emit('message_updated', updatedMessage);

          // Emit to user rooms (for users not actively viewing the chat)
          for (const pid of participantIds) {
            // Format differently for receivers vs senders
            const messageForUser = pid === msg.senderId 
              ? updatedMessage // Sender sees their own message normally
              : {
                  ...updatedMessage,
                  contentHiddenForViewer: true,
                  message: '',
                  attachmentFiles: [],
                };
            this.chatGateway.server.to(`user:${pid}`).emit('message_updated', messageForUser);
          }
        }
      }
    }

    // Reset the fraud detection count to 0 when admin blocks from review
    // This ensures the sliding window starts fresh after blocking
    this.resetFraudDetectionCount(conversationId);
  }

  /**
   * Block specific messages by their IDs
   */
  async blockMessages(messageIds: string[], adminId: string): Promise<void> {
    if (messageIds.length === 0) return;

    // Get messages with conversation info before blocking
    const messages = await this.messageRepository.find({
      where: { id: In(messageIds) } as any,
      relations: ['conversation'],
    });

    if (messages.length === 0) return;

    // Block the messages
    await this.messageRepository.update(
      { id: In(messageIds) } as any,
      {
        adminBlockedAt: new Date(),
        adminBlockedById: adminId,
      },
    );

    // Emit WebSocket events to notify receivers that messages are blocked
    // Group messages by conversation
    const messagesByConversation = new Map<string, Message[]>();
    for (const msg of messages) {
      const convId = msg.conversationId;
      if (!messagesByConversation.has(convId)) {
        messagesByConversation.set(convId, []);
      }
      messagesByConversation.get(convId)!.push(msg);
    }

    // Emit message_deleted events for each conversation
    for (const [conversationId, msgs] of messagesByConversation.entries()) {
      const conversation = await this.conversationRepository.findOne({
        where: { id: conversationId },
      });

      if (!conversation) continue;

      // Get participant IDs (client and provider)
      const participantIds = Array.from(
        new Set([conversation.clientId, conversation.providerId].filter(Boolean)),
      ) as string[];

      // Emit message_updated events to receivers (not senders) to show blocked indicator
      for (const msg of msgs) {
        // Load message with sender info and format it like in message service
        const messageWithSender = await this.messageService.findOne(msg.id);
        
        // Format message for receivers (hide content, show blocked indicator)
        const updatedMessage: any = {
          ...messageWithSender,
          isAdminBlocked: true,
          adminBlockedAt: new Date().toISOString(),
          adminBlockReason: 'This message is blocked by admin',
        };

        // Emit to conversation room (all participants will receive, but frontend will handle display)
        this.chatGateway.server.to(`conversation:${conversationId}`).emit('message_updated', updatedMessage);

        // Emit to user rooms (for users not actively viewing the chat)
        for (const pid of participantIds) {
          // Format differently for receivers vs senders
          const messageForUser = pid === msg.senderId 
            ? updatedMessage // Sender sees their own message normally
            : {
                ...updatedMessage,
                contentHiddenForViewer: true,
                message: '',
                attachmentFiles: [],
              };
          this.chatGateway.server.to(`user:${pid}`).emit('message_updated', messageForUser);
        }
      }
    }
  }

  /**
   * Unblock specific messages by their IDs
   */
  async unblockMessages(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    // Get messages with conversation info before unblocking
    const messages = await this.messageRepository.find({
      where: { id: In(messageIds) } as any,
      relations: ['conversation'],
    });

    if (messages.length === 0) return;

    // Unblock the messages
    await this.messageRepository.update(
      { id: In(messageIds) } as any,
      {
        adminBlockedAt: null,
        adminBlockedById: null,
      },
    );

    // Emit WebSocket events to notify receivers that messages are now visible
    // Group messages by conversation
    const messagesByConversation = new Map<string, Message[]>();
    for (const msg of messages) {
      const convId = msg.conversationId;
      if (!messagesByConversation.has(convId)) {
        messagesByConversation.set(convId, []);
      }
      messagesByConversation.get(convId)!.push(msg);
    }

    // Emit new_message events for each conversation
    for (const [conversationId, msgs] of messagesByConversation.entries()) {
      const conversation = await this.conversationRepository.findOne({
        where: { id: conversationId },
      });

      if (!conversation) continue;

      // Get participant IDs (client and provider)
      const participantIds = Array.from(
        new Set([conversation.clientId, conversation.providerId].filter(Boolean)),
      ) as string[];

      // Emit message_updated event to receivers to show unblocked message
      for (const msg of msgs) {
        // Load message with sender info for WebSocket emission
        const messageWithSender = await this.messageService.findOne(msg.id);
        
        // Format message (remove blocked indicator)
        const updatedMessage: any = {
          ...messageWithSender,
          isAdminBlocked: false,
          adminBlockedAt: null,
          adminBlockReason: undefined,
        };

        // Emit to conversation room (all participants will receive)
        this.chatGateway.server.to(`conversation:${conversationId}`).emit('message_updated', updatedMessage);

        // Emit to user rooms (for users not actively viewing the chat)
        for (const pid of participantIds) {
          this.chatGateway.server.to(`user:${pid}`).emit('message_updated', updatedMessage);
        }
      }
    }
  }

  async listFraudConversations(filters?: { blocked?: 'blocked' | 'unblocked' | 'all'; hasPendingRequest?: boolean }) {
    const aggregates = await this.fraudRepository
      .createQueryBuilder('fd')
      .select('fd.conversationId', 'conversationId')
      .addSelect('COUNT(*)', 'fraudCount')
      .addSelect('MAX(fd.createdAt)', 'latestFraudAt')
      .addSelect(
        'SUM(CASE WHEN fd.reviewedAt IS NULL AND fd.confidence IN (\'low\', \'medium\') THEN 1 ELSE 0 END)',
        'unreviewedCount',
      )
      .groupBy('fd.conversationId')
      .orderBy('latestFraudAt', 'DESC')
      .getRawMany<{ conversationId: string; fraudCount: string; latestFraudAt: string; unreviewedCount: string }>();

    const conversationIds = aggregates.map((a) => a.conversationId);
    if (conversationIds.length === 0) return [];

    const conversations = await this.conversationRepository.find({
      where: { id: In(conversationIds), deletedAt: null } as any,
      relations: ['service', 'client', 'provider', 'service.category'],
    });

    const frauds = await this.fraudRepository.find({
      where: { conversationId: In(conversationIds) } as any,
      relations: ['sender', 'message'],
      order: { createdAt: 'DESC' },
    });

    const requests = await this.reactivationRepository.find({
      where: { conversationId: In(conversationIds) } as any,
      relations: ['requester', 'decidedBy'],
      order: { createdAt: 'DESC' },
    });

    const aggByConversation = new Map(aggregates.map((a) => [a.conversationId, a]));
    const fraudsByConversation = new Map<string, FraudDetection[]>();
    for (const f of frauds) {
      const arr = fraudsByConversation.get(f.conversationId) || [];
      arr.push(f);
      fraudsByConversation.set(f.conversationId, arr);
    }

    const reqByConversation = new Map<string, ConversationReactivationRequest[]>();
    for (const r of requests) {
      const arr = reqByConversation.get(r.conversationId) || [];
      arr.push(r);
      reqByConversation.set(r.conversationId, arr);
    }

    const results = conversations
      .map((c) => {
        const agg = aggByConversation.get(c.id);
        const convFrauds = fraudsByConversation.get(c.id) || [];
        const convReqs = reqByConversation.get(c.id) || [];
        const pendingRequests = convReqs.filter((r) => r.status === ReactivationRequestStatus.PENDING);
        const unreviewedCount = agg ? parseInt(agg.unreviewedCount || '0', 10) : 0;

        return {
          conversation: c,
          fraudCount: agg ? parseInt(agg.fraudCount, 10) : convFrauds.length,
          latestFraudAt: agg?.latestFraudAt || null,
          frauds: convFrauds,
          reactivationRequests: convReqs,
          pendingRequestCount: pendingRequests.length,
          unreviewedCount,
        };
      })
      .filter((row) => {
        const blockedFilter = filters?.blocked || 'all';
        if (blockedFilter === 'blocked' && !row.conversation.isBlocked) return false;
        if (blockedFilter === 'unblocked' && row.conversation.isBlocked) return false;
        if (filters?.hasPendingRequest === true && row.pendingRequestCount === 0) return false;
        return true;
      })
      .sort((a, b) => {
        const ad = a.latestFraudAt ? new Date(a.latestFraudAt as any).getTime() : 0;
        const bd = b.latestFraudAt ? new Date(b.latestFraudAt as any).getTime() : 0;
        return bd - ad;
      });

    return results;
  }

  async approveReactivationRequest(requestId: string, adminId: string, note?: string) {
    const req = await this.reactivationRepository.findOne({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Reactivation request not found');

    if (req.status !== ReactivationRequestStatus.PENDING) {
      throw new ConflictException('Reactivation request has already been decided');
    }

    await this.reactivationRepository.update(requestId, {
      status: ReactivationRequestStatus.APPROVED,
      decidedAt: new Date(),
      decidedById: adminId,
      note,
      updatedAt: new Date(),
    });

    await this.conversationRepository.update(req.conversationId, {
      isBlocked: false,
      blockedAt: null,
      blockedReason: null,
      updatedAt: new Date(),
    } as any);

    const updated = await this.reactivationRepository.findOne({
      where: { id: requestId },
      relations: ['requester', 'decidedBy', 'conversation'],
    });

    // Notify BOTH client and provider that chat was reactivated
    const conversation = await this.conversationRepository.findOne({
      where: { id: req.conversationId, deletedAt: null },
    });
    if (conversation) {
      const recipients = Array.from(new Set([conversation.clientId, conversation.providerId].filter(Boolean))) as string[];
      await Promise.all(
        recipients.map((userId) =>
          this.notificationService.createNotification(
            userId,
            NotificationType.MESSAGE,
            'Conversation Reactivated',
            'Admin approved the reactivation request. You can continue chatting.',
            { conversationId: conversation.id, requestId, kind: 'conversation_reactivation_approved' },
          ),
        ),
      );
    }

    return updated;
  }

  async rejectReactivationRequest(requestId: string, adminId: string, note?: string) {
    const req = await this.reactivationRepository.findOne({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Reactivation request not found');

    if (req.status !== ReactivationRequestStatus.PENDING) {
      throw new ConflictException('Reactivation request has already been decided');
    }

    await this.reactivationRepository.update(requestId, {
      status: ReactivationRequestStatus.REJECTED,
      decidedAt: new Date(),
      decidedById: adminId,
      note,
      updatedAt: new Date(),
    });

    return this.reactivationRepository.findOne({
      where: { id: requestId },
      relations: ['requester', 'decidedBy', 'conversation'],
    });
  }
}


