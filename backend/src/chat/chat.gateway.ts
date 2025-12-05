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
import { Injectable, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';

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

  constructor(
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      console.log('New connection attempt:', {
        auth: client.handshake.auth,
        query: client.handshake.query,
        headers: Object.keys(client.handshake.headers),
      });

      // Try multiple ways to get the token
      const token = 
        client.handshake.auth?.token || 
        client.handshake.query?.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        console.log('No token provided, disconnecting client');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await this.userRepository.findOne({ where: { id: payload.sub } });

      if (!user) {
        console.log('User not found, disconnecting client');
        client.disconnect();
        return;
      }

      // Store user info in socket
      client.data.userId = user.id;
      client.data.user = user;

      console.log(`✅ User ${user.id} (${user.email}) connected to chat`);
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`User ${client.data.userId} disconnected from chat`);
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    try {
      const userId = client.data.userId;
      if (!userId) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

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
      const userId = client.data.userId;
      if (!userId) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

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

      // Create message
      const message = this.messageRepository.create({
        conversationId: data.conversationId,
        senderId: userId,
        message: data.message,
        attachmentFiles: data.attachmentFiles,
      });

      const savedMessage = await this.messageRepository.save(message);

      // Update conversation's updatedAt
      await this.conversationRepository.update(data.conversationId, { updatedAt: new Date() });

      // Load message with sender info
      const messageWithSender = await this.messageRepository.findOne({
        where: { id: savedMessage.id },
        relations: ['sender'],
      });

      // Emit to all clients in the conversation room
      this.server.to(`conversation:${data.conversationId}`).emit('new_message', messageWithSender);
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
      const userId = client.data.userId;
      if (!userId) return;

      const user = client.data.user;
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
      const userId = client.data.userId;
      if (!userId) return;

      // Emit stop typing to all other users in the conversation
      client.to(`conversation:${data.conversationId}`).emit('user_stopped_typing', {
        userId,
      });
    } catch (error) {
      console.error('Error handling stop typing:', error);
    }
  }

  @SubscribeMessage('mark_messages_read')
  async handleMarkMessagesRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageIds?: string[] },
  ) {
    try {
      const userId = client.data.userId;
      if (!userId) return;

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

      // Emit read receipt to all users in the conversation with updated messages
      this.server.to(`conversation:${data.conversationId}`).emit('messages_read', {
        conversationId: data.conversationId,
        readBy: userId,
        messages: updatedMessages,
        messageIds: messageIdsToUpdate,
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  // Helper method to emit milestone updates
  async emitMilestoneUpdate(conversationId: string, milestone: any) {
    this.server.to(`conversation:${conversationId}`).emit('milestone_updated', milestone);
  }
}

