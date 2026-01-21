import { Injectable, ConflictException, ForbiddenException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { FraudDetection } from '../entities/fraud-detection.entity';
import { ConversationReactivationRequest, ReactivationRequestStatus } from '../entities/conversation-reactivation-request.entity';
import { Message } from '../entities/message.entity';
import { FraudDetectorService } from './fraud-detector.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';

@Injectable()
export class FraudService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(FraudDetection)
    private fraudRepository: Repository<FraudDetection>,
    @InjectRepository(ConversationReactivationRequest)
    private reactivationRepository: Repository<ConversationReactivationRequest>,
    private fraudDetector: FraudDetectorService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
  ) {}

  async evaluateMessage(conversationId: string, message: Message): Promise<{ isFraud: boolean; conversationBlocked: boolean }> {
    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId, deletedAt: null } });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const decision = await this.fraudDetector.decideText(message.message);
    if (!decision.fraud) {
      return { isFraud: false, conversationBlocked: Boolean(conversation.isBlocked) };
    }

    const fraud = this.fraudRepository.create({
      conversationId,
      messageId: message.id,
      senderId: message.senderId,
      messageText: message.message,
      category: decision.category || undefined,
      reason: decision.reason || undefined,
      confidence: (decision.confidence as any) || undefined,
      signals: decision.signals || [],
    });
    await this.fraudRepository.save(fraud);

    const fraudCount = await this.fraudRepository.count({ where: { conversationId } });
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

    return { isFraud: true, conversationBlocked };
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

  async listFraudConversations(filters?: { blocked?: 'blocked' | 'unblocked' | 'all'; hasPendingRequest?: boolean }) {
    const aggregates = await this.fraudRepository
      .createQueryBuilder('fd')
      .select('fd.conversationId', 'conversationId')
      .addSelect('COUNT(*)', 'fraudCount')
      .addSelect('MAX(fd.createdAt)', 'latestFraudAt')
      .groupBy('fd.conversationId')
      .orderBy('latestFraudAt', 'DESC')
      .getRawMany<{ conversationId: string; fraudCount: string; latestFraudAt: string }>();

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

        return {
          conversation: c,
          fraudCount: agg ? parseInt(agg.fraudCount, 10) : convFrauds.length,
          latestFraudAt: agg?.latestFraudAt || null,
          frauds: convFrauds,
          reactivationRequests: convReqs,
          pendingRequestCount: pendingRequests.length,
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


