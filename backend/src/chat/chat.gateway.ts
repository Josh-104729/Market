import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { MessageService } from '../message/message.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    methods: ['GET', 'POST'],
  },
  namespace: '/chat',
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track online users: userId -> Set of socket IDs
  private onlineUsers = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @Inject(forwardRef(() => MessageService))
    private messageService: MessageService,
  ) { }

  async handleConnection(client: Socket) {
    try {
      // console.log('New connection attempt:', {
      //   auth: client.handshake.auth,
      //   query: client.handshake.query,
      //   headers: Object.keys(client.handshake.headers),
      // });

      // Try multiple ways to get the token
      const token =
        client.handshake.auth?.token ||
        client.handshake.query?.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        // No auth token: treat as unauthenticated and disconnect quietly.
        client.emit('auth_error', { reason: 'missing_token' });
        client.disconnect();
        return;
      }

      let payload: any;
      try {
        payload = this.jwtService.verify(token);
      } catch (err: any) {
        const name = err?.name;
        if (name === 'TokenExpiredError') {
          client.emit('auth_error', { reason: 'jwt_expired' });
        } else if (name === 'JsonWebTokenError' || name === 'NotBeforeError') {
          client.emit('auth_error', { reason: 'invalid_token' });
        } else {
          client.emit('auth_error', { reason: 'auth_failed' });
        }
        // Avoid noisy stack traces for normal auth failures.
        console.warn('WebSocket authentication failed:', name || err?.message || err);
        client.disconnect();
        return;
      }
      const user = await this.userRepository.findOne({ where: { id: payload.sub } });

      if (!user) {
        client.emit('auth_error', { reason: 'user_not_found' });
        client.disconnect();
        return;
      }

      // Store user info in socket
      client.data.userId = user.id;
      client.data.user = user;

      // Join user's personal room for notifications
      client.join(`user:${user.id}`);

      // Track online status
      if (!this.onlineUsers.has(user.id)) {
        this.onlineUsers.set(user.id, new Set());
      }
      this.onlineUsers.get(user.id)!.add(client.id);

      // If this is the first connection for this user, notify their conversation partners
      if (this.onlineUsers.get(user.id)!.size === 1) {
        await this.notifyUserOnlineStatus(user.id, true);
      }

      console.log(`✅ User ${user.id} (${user.email}) connected to chat`);
    } catch (error) {
      // Unexpected errors only.
      console.error('WebSocket connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    console.log(`User ${userId} disconnected from chat`);

    if (userId) {
      // Remove this socket from online users
      const userSockets = this.onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);
        
        // If no more sockets for this user, they're offline
        if (userSockets.size === 0) {
          this.onlineUsers.delete(userId);
          await this.notifyUserOnlineStatus(userId, false);
        }
      }
    }
  }

  // Helper method to notify conversation partners about online status
  private async notifyUserOnlineStatus(userId: string, isOnline: boolean) {
    try {
      // Find all conversations where this user is a participant
      const conversations = await this.conversationRepository.find({
        where: [
          { clientId: userId },
          { providerId: userId },
        ],
      });

      // Notify all conversation partners
      for (const conversation of conversations) {
        const partnerId = conversation.clientId === userId 
          ? conversation.providerId 
          : conversation.clientId;

        if (partnerId) {
          // Emit to partner's personal room
          this.server.to(`user:${partnerId}`).emit('user_status_change', {
            userId,
            isOnline,
            conversationId: conversation.id,
          });
        }
      }
    } catch (error) {
      console.error('Error notifying user online status:', error);
    }
  }

  // Method to check if a user is online
  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId) && this.onlineUsers.get(userId)!.size > 0;
  }

  // Helper method to verify authentication for socket operations
  private async verifyAuthentication(client: Socket): Promise<{ userId: string; user: User } | null> {
    // First check if we already have userId stored (from initial connection)
    if (client.data.userId && client.data.user) {
      return { userId: client.data.userId, user: client.data.user };
    }

    // If not, try to re-authenticate using the token from handshake
    const token =
      client.handshake.auth?.token ||
      client.handshake.query?.token ||
      client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return null;
    }

    try {
      const payload = this.jwtService.verify(token);
      const user = await this.userRepository.findOne({ where: { id: payload.sub } });

      if (!user) {
        return null;
      }

      // Store user info in socket for future use
      client.data.userId = user.id;
      client.data.user = user;

      return { userId: user.id, user };
    } catch (err: any) {
      // Token expired or invalid
      const name = err?.name;
      if (name === 'TokenExpiredError') {
        client.emit('auth_error', { reason: 'jwt_expired' });
      } else if (name === 'JsonWebTokenError' || name === 'NotBeforeError') {
        client.emit('auth_error', { reason: 'invalid_token' });
      }
      return null;
    }
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    try {
      const auth = await this.verifyAuthentication(client);
      if (!auth) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }
      const { userId } = auth;

      // Verify user has access to this conversation
      const conversation = await this.conversationRepository.findOne({
        where: { id: data.conversationId, deletedAt: null },
      });

      if (!conversation) {
        client.emit('error', { message: 'Conversation not found' });
        return;
      }

      if (conversation.clientId !== userId && conversation.providerId !== userId) {
        // Check if user is admin
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user?.role !== 'admin') {
          client.emit('error', { message: 'Access denied' });
          return;
        }
      }

      // Join the conversation room
      client.join(`conversation:${data.conversationId}`);
      client.emit('joined_conversation', { conversationId: data.conversationId });
    } catch (error) {
      console.error('Error joining conversation:', error);
      client.emit('error', { message: 'Failed to join conversation' });
    }
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    client.leave(`conversation:${data.conversationId}`);
    client.emit('left_conversation', { conversationId: data.conversationId });
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; message: string; attachmentFiles?: string[] },
  ) {
    try {
      const auth = await this.verifyAuthentication(client);
      if (!auth) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }
      const { userId } = auth;

      // Verify user has access to this conversation
      const conversation = await this.conversationRepository.findOne({
        where: { id: data.conversationId, deletedAt: null },
      });

      if (!conversation) {
        client.emit('error', { message: 'Conversation not found' });
        return;
      }

      if (conversation.clientId !== userId && conversation.providerId !== userId) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user?.role !== 'admin') {
          client.emit('error', { message: 'Access denied' });
          return;
        }
      }
      const userRecord =
        conversation.clientId !== userId && conversation.providerId !== userId
          ? await this.userRepository.findOne({ where: { id: userId } })
          : null;
      const isAdmin = userRecord?.role === 'admin';

      // Delegate to MessageService so HTTP + WS paths behave the same (persistence + sender + notifications).
      await this.messageService.create(
        data.conversationId,
        userId,
        { message: data.message, attachmentFiles: data.attachmentFiles },
        isAdmin,
      );
    } catch (error) {
      console.error('Error sending message:', error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const auth = await this.verifyAuthentication(client);
      if (!auth) return;
      const { userId, user } = auth;
      const userName = user?.firstName || user?.userName || 'Someone';

      // Emit typing indicator to all other users in the conversation
      client.to(`conversation:${data.conversationId}`).emit('user_typing', {
        userId,
        userName,
      });
    } catch (error) {
      console.error('Error handling typing:', error);
    }
  }

  @SubscribeMessage('stop_typing')
  async handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const auth = await this.verifyAuthentication(client);
      if (!auth) return;
      const { userId } = auth;

      // Emit stop typing to all other users in the conversation
      client.to(`conversation:${data.conversationId}`).emit('user_stopped_typing', {
        userId,
      });
    } catch (error) {
      console.error('Error handling stop typing:', error);
    }
  }

  @SubscribeMessage('get_online_status')
  async handleGetOnlineStatus(@ConnectedSocket() client: Socket, @MessageBody() data: { userIds: string[] }) {
    try {
      const auth = await this.verifyAuthentication(client);
      if (!auth) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      const statusMap: Record<string, boolean> = {};
      for (const userId of data.userIds) {
        statusMap[userId] = this.isUserOnline(userId);
      }

      client.emit('online_status_response', statusMap);
    } catch (error) {
      console.error('Error getting online status:', error);
      client.emit('error', { message: 'Failed to get online status' });
    }
  }

  @SubscribeMessage('mark_messages_read')
  async handleMarkMessagesRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageIds?: string[] },
  ) {
    try {
      const auth = await this.verifyAuthentication(client);
      if (!auth) return;
      const { userId } = auth;

      // Verify user has access to this conversation
      const conversation = await this.conversationRepository.findOne({
        where: { id: data.conversationId, deletedAt: null },
      });

      if (!conversation) return;

      if (conversation.clientId !== userId && conversation.providerId !== userId) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user?.role !== 'admin') return;
      }

      // Build query to find unread messages from other users
      const findQuery = this.messageRepository
        .createQueryBuilder('message')
        .where('message.conversation_id = :conversationId', { conversationId: data.conversationId })
        .andWhere('message.sender_id != :userId', { userId })
        .andWhere('message.read_at IS NULL')
        .andWhere('message.deleted_at IS NULL');

      if (data.messageIds && data.messageIds.length > 0) {
        findQuery.andWhere('message.id IN (:...messageIds)', { messageIds: data.messageIds });
      }

      // Find messages to update
      const messagesToUpdate = await findQuery.getMany();

      if (messagesToUpdate.length === 0) {
        return; // No messages to update
      }

      const messageIdsToUpdate = messagesToUpdate.map((msg) => msg.id);
      const readAt = new Date();

      // Update messages
      await this.messageRepository.update(
        { id: In(messageIdsToUpdate) },
        { readAt },
      );

      // Fetch updated messages with relations
      const updatedMessages = await this.messageRepository.find({
        where: { id: In(messageIdsToUpdate) },
        relations: ['sender'],
      });

      // Emit read receipt to conversation room (for active viewers)
      this.server.to(`conversation:${data.conversationId}`).emit('messages_read', {
        conversationId: data.conversationId,
        readBy: userId,
        messages: updatedMessages,
        messageIds: messageIdsToUpdate,
      });

      // Also emit to user rooms (for users not actively viewing the chat)
      // This ensures read receipts are received even when not in the conversation room
      // Reuse the conversation variable that was already fetched above
      if (conversation) {
        const participants = [conversation.clientId, conversation.providerId].filter(Boolean) as string[];
        for (const pid of participants) {
          this.server.to(`user:${pid}`).emit('messages_read', {
            conversationId: data.conversationId,
            readBy: userId,
            messages: updatedMessages,
            messageIds: messageIdsToUpdate,
          });
        }
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  // Helper method to emit milestone updates
  async emitMilestoneUpdate(conversationId: string, milestone: any) {
    this.server.to(`conversation:${conversationId}`).emit('milestone_updated', milestone);
  }
}

