import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { Transaction, TransactionType, TransactionStatus, PaymentNetwork } from '../entities/transaction.entity';
import { TempWallet, WalletNetwork } from '../entities/temp-wallet.entity';
import { AdminSignInDto } from './dto/admin-signin.dto';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';
import { ConversationService } from '../conversation/conversation.service';
import { MilestoneService } from '../milestone/milestone.service';
import { MilestoneStatus } from '../entities/milestone.entity';
import { WalletService } from '../wallet/wallet.service';
import { PolygonWalletService } from '../polygon-wallet/polygon-wallet.service';
import { ChatGateway } from '../chat/chat.gateway';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { LoginHistory } from '../entities/login-history.entity';
import { parseUserAgent } from '../utils/user-agent-parser';
import { getLocationFromIP } from '../utils/ip-geolocation';

@Injectable()
export class AdminService {
  // Simple in-memory balance cache to avoid hammering RPC providers on admin list pages.
  // Key: `${network}:${address}:${asset}`
  private balanceCache = new Map<string, { value: number; expiresAt: number }>();

  private getCachedBalance(key: string): number | null {
    const hit = this.balanceCache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.balanceCache.delete(key);
      return null;
    }
    return hit.value;
  }

  private setCachedBalance(key: string, value: number, ttlMs: number) {
    this.balanceCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= items.length) return;
        results[i] = await fn(items[i], i);
      }
    };

    const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
    await Promise.all(workers);
    return results;
  }
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(TempWallet)
    private tempWalletRepository: Repository<TempWallet>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(LoginHistory)
    private loginHistoryRepository: Repository<LoginHistory>,
    private jwtService: JwtService,
    private dataSource: DataSource,
    @Inject(forwardRef(() => PaymentService))
    private paymentService: PaymentService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    @Inject(forwardRef(() => ConversationService))
    private conversationService: ConversationService,
    @Inject(forwardRef(() => MilestoneService))
    private milestoneService: MilestoneService,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
    private polygonWalletService: PolygonWalletService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  async signIn(dto: AdminSignInDto, ipAddress?: string, userAgent?: string) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      await this.trackLoginAttempt(null, false, 'Invalid credentials', ipAddress, userAgent, 'password');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is an admin
    if (user.role !== 'admin') {
      await this.trackLoginAttempt(user.id, false, 'Access denied. Admin privileges required.', ipAddress, userAgent, 'password');
      throw new UnauthorizedException('Access denied. Admin privileges required.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      await this.trackLoginAttempt(user.id, false, 'Invalid credentials', ipAddress, userAgent, 'password');
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    await this.trackLoginAttempt(user.id, true, undefined, ipAddress, userAgent, 'password');

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.role !== 'admin') {
      throw new UnauthorizedException('Access denied. Admin privileges required.');
    }

    return {
      id: user.id,
      email: user.email,
      userName: user.userName,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      role: user.role,
    };
  }

  async getUsers(
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ data: (Omit<User, 'password' | 'twoFactorSecret' | 'backupCodes'> & { totalSpent: number; passwordOrigin?: string })[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    // Build where conditions - only get users with role='user'
    const whereConditions: any = {
      role: 'user',
    };

    let users: User[];
    let total: number;

    // If search is provided, we need to use query builder for LIKE queries
    if (search) {
      const queryBuilder = this.userRepository
        .createQueryBuilder('user')
        .where('user.role = :role', { role: 'user' })
        .andWhere(
          '(user.email LIKE :search OR user.userName LIKE :search OR user.firstName LIKE :search OR user.lastName LIKE :search)',
          { search: `%${search}%` },
        )
        .orderBy('user.createdAt', 'DESC')
        .skip(skip)
        .take(limit);

      [users, total] = await queryBuilder.getManyAndCount();
    } else {
      // Simple query without search - only users with role='user'
      [users, total] = await this.userRepository.findAndCount({
        where: whereConditions,
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });
    }

    // Get user IDs for batch calculation
    const userIds = users.map((user) => user.id);

    // Calculate totalSpent for all users in a single query (more efficient)
    const totalSpentMap = new Map<string, number>();
    
    if (userIds.length > 0) {
      // Get all successful CHARGE transactions for these users
      const chargeTotals = await this.transactionRepository
        .createQueryBuilder('transaction')
        .select('transaction.clientId', 'userId')
        .addSelect('COALESCE(SUM(transaction.amount), 0)', 'total')
        .where('transaction.clientId IN (:...userIds)', { userIds })
        .andWhere('transaction.type = :type', { type: TransactionType.CHARGE })
        .andWhere('transaction.status = :status', { status: TransactionStatus.SUCCESS })
        .groupBy('transaction.clientId')
        .getRawMany();

      // Get all successful MILESTONE_PAYMENT transactions for these users
      const milestoneTotals = await this.transactionRepository
        .createQueryBuilder('transaction')
        .select('transaction.clientId', 'userId')
        .addSelect('COALESCE(SUM(transaction.amount), 0)', 'total')
        .where('transaction.clientId IN (:...userIds)', { userIds })
        .andWhere('transaction.type = :type', { type: TransactionType.MILESTONE_PAYMENT })
        .andWhere('transaction.status = :status', { status: TransactionStatus.SUCCESS })
        .groupBy('transaction.clientId')
        .getRawMany();

      // Initialize map with zeros for all users
      userIds.forEach((userId) => {
        totalSpentMap.set(userId, 0);
      });

      // Add charge totals
      chargeTotals.forEach((item) => {
        const current = totalSpentMap.get(item.userId) || 0;
        totalSpentMap.set(item.userId, current + parseFloat(item.total || '0'));
      });

      // Add milestone payment totals
      milestoneTotals.forEach((item) => {
        const current = totalSpentMap.get(item.userId) || 0;
        totalSpentMap.set(item.userId, current + parseFloat(item.total || '0'));
      });
    }

    // Remove sensitive data and add totalSpent
    const sanitizedUsers = users.map((user) => {
      const { password, twoFactorSecret, backupCodes, ...sanitized } = user;
      const totalSpent = totalSpentMap.get(user.id) || 0;

      return {
        ...sanitized,
        totalSpent,
        passwordOrigin: user.passwordOrigin, // Include original password
      } as Omit<User, 'password' | 'twoFactorSecret' | 'backupCodes'> & { totalSpent: number; passwordOrigin?: string };
    });

    return {
      data: sanitizedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getWithdraws(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Transaction[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const [withdraws, total] = await this.transactionRepository.findAndCount({
      where: { type: TransactionType.WITHDRAW },
      relations: ['client'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: withdraws,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMasterWalletTransactions(
    page: number = 1,
    limit: number = 10,
    type?: TransactionType,
    status?: TransactionStatus,
    paymentNetwork?: PaymentNetwork,
  ): Promise<{ data: Transaction[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.client', 'client')
      .leftJoinAndSelect('transaction.provider', 'provider')
      .where('transaction.paymentNetwork IS NOT NULL');

    if (type) {
      queryBuilder.andWhere('transaction.type = :type', { type });
    }

    if (status) {
      queryBuilder.andWhere('transaction.status = :status', { status });
    }

    if (paymentNetwork) {
      queryBuilder.andWhere('transaction.paymentNetwork = :paymentNetwork', { paymentNetwork });
    }

    const total = await queryBuilder.getCount();
    const transactions = await queryBuilder
      .orderBy('transaction.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async acceptWithdraw(withdrawId: string) {
    return this.paymentService.processWithdraw(withdrawId);
  }

  async broadcastNotification(title: string, message: string, metadata?: Record<string, any>) {
    return this.notificationService.broadcastNotification(title, message, metadata);
  }

  async getDisputes() {
    return this.conversationService.findDisputed();
  }

  async releaseMilestone(milestoneId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // Get the milestone
    const milestone = await this.milestoneService.findOne(milestoneId);
    
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (milestone.status !== MilestoneStatus.DISPUTE) {
      throw new BadRequestException('Milestone is not in dispute status');
    }

    // Release milestone with custom amount using payment service
    return this.paymentService.releaseMilestoneTransactionWithAmount(
      milestoneId,
      milestone.providerId,
      amount,
    );
  }

  async getTempWallets() {
    const wallets = await this.tempWalletRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    // Get balances for each wallet, but limit concurrency to reduce rate-limits (TronGrid 429).
    // Cache balances briefly since the admin page can refresh frequently.
    const TTL_MS = 30_000; // 30s
    const CONCURRENCY = 3;

    const walletsWithBalances = await this.mapWithConcurrency(wallets, CONCURRENCY, async (wallet) => {
      let usdtBalance = 0;
      let usdcBalance = 0; // kept for backwards-compatible admin UI payloads

      // if (wallet.network === WalletNetwork.TRON) {
      //   const key = `TRON:${wallet.address}:USDT`;
      //   const cached = this.getCachedBalance(key);
      //   if (cached !== null) {
      //     usdtBalance = cached;
      //   } else {
      //     usdtBalance = await this.walletService.getUSDTBalance(wallet.address);
      //     this.setCachedBalance(key, usdtBalance, TTL_MS);
      //   }
      // }

      // if (wallet.network === WalletNetwork.POLYGON) {
      //   const key = `POLYGON:${wallet.address}:USDC`;
      //   const cached = this.getCachedBalance(key);
      //   if (cached !== null) {
      //     usdcBalance = cached;
      //   } else {
      //     usdcBalance = await this.polygonWalletService.getUSDCBalance(wallet.address);
      //     this.setCachedBalance(key, usdcBalance, TTL_MS);
      //   }
      // }

      return {
        ...wallet,
        totalReceived: Number(wallet.totalReceived || 0),
        usdtBalance: wallet.network === WalletNetwork.TRON ? usdtBalance : 0,
        usdcBalance: wallet.network === WalletNetwork.POLYGON ? usdcBalance : 0,
      };
    });

    return walletsWithBalances;
  }

  // Fetch balances for a single temp wallet on-demand (used by the admin temp wallet list).
  async getTempWalletBalances(walletId: string, asset?: 'token' | 'gas') {
    const wallet = await this.tempWalletRepository.findOne({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Temp wallet not found');
    }

    if (wallet.network === WalletNetwork.TRON) {
      const usdt = asset === 'gas' ? 0 : await this.walletService.getUSDTBalance(wallet.address);
      const trx = asset === 'token' ? 0 : await this.walletService.getTRXBalance(wallet.address);
      return {
        walletId: wallet.id,
        network: wallet.network,
        address: wallet.address,
        tokenSymbol: 'USDT',
        tokenBalance: usdt,
        gasSymbol: 'TRX',
        gasBalance: trx,
      };
    }

    if (wallet.network === WalletNetwork.POLYGON) {
      const usdc = asset === 'gas' ? 0 : await this.polygonWalletService.getUSDCBalance(wallet.address);
      const matic = asset === 'token' ? 0 : await this.polygonWalletService.getMATICBalance(wallet.address);
      return {
        walletId: wallet.id,
        network: wallet.network,
        address: wallet.address,
        tokenSymbol: 'USDC',
        tokenBalance: usdc,
        gasSymbol: 'MATIC',
        gasBalance: matic,
      };
    }

    throw new BadRequestException('Unsupported wallet network');
  }

  async transferFromTempWallet(walletId: string, amount?: number) {
    const tempWallet = await this.tempWalletRepository.findOne({
      where: { id: walletId },
    });

    if (!tempWallet) {
      throw new NotFoundException('Temp wallet not found');
    }

    let amountTransferred = 0;
    // if (tempWallet.network === WalletNetwork.TRON) {
    //   amountTransferred =
    //     typeof amount === 'number' ? amount : await this.walletService.getUSDTBalance(tempWallet.address);
    // } else if (tempWallet.network === WalletNetwork.POLYGON) {
    //   amountTransferred =
    //     typeof amount === 'number' ? amount : await this.polygonWalletService.getUSDCBalance(tempWallet.address);
    // } else {
    //   throw new BadRequestException('Unsupported wallet network');
    // }
    amountTransferred = typeof amount === 'number' ? amount : 0;

    let transferResult: { success: boolean; usdtTxHash?: string; usdcTxHash?: string; maticTxHash?: string; trxTxHash?: string; error?: string };

    if (tempWallet.network === WalletNetwork.TRON) {
      // Transfer USDT from temp wallet to master wallet
      // If temp wallet doesn't have enough TRX, master wallet will send 30 TRX first
      transferResult = await this.walletService.transferFromTempWalletToMaster(tempWallet, amountTransferred);
    } else if (tempWallet.network === WalletNetwork.POLYGON) {
      transferResult = await this.polygonWalletService.transferUSDCFromTempWalletToMaster(
        tempWallet,
        amountTransferred,
      );
    } else {
      throw new BadRequestException('Unsupported wallet network');
    }

    if (!transferResult.success) {
      throw new BadRequestException(`Transfer failed: ${transferResult.error}`);
    }

    return {
      success: true,
      usdtTxHash: transferResult.usdtTxHash,
      usdcTxHash: transferResult.usdcTxHash,
      maticTxHash: transferResult.maticTxHash,
      trxTxHash: transferResult.trxTxHash,
      amountTransferred: amountTransferred,
    };
  }

  async transferRemainingTRXFromTempWallet(walletId: string) {
    const tempWallet = await this.tempWalletRepository.findOne({
      where: { id: walletId },
    });

    if (!tempWallet) {
      throw new NotFoundException('Temp wallet not found');
    }

    if (tempWallet.network !== WalletNetwork.TRON) {
      throw new BadRequestException('TRX transfer is only supported for TRON wallets');
    }

    const result = await this.walletService.transferRemainingTRXFromTempToMaster(tempWallet);
    if (!result.success) {
      throw new BadRequestException(`Transfer failed: ${result.error}`);
    }

    return {
      success: true,
      trxTxHash: result.trxTxHash,
      amountTransferred: result.amountTransferred,
    };
  }

  async updateUserStatus(userId: string, status: 'active' | 'blocked'): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldStatus = user.status;
    user.status = status;
    await this.userRepository.save(user);

    // If user is being blocked, emit logout event via WebSocket
    if (status === 'blocked' && oldStatus !== 'blocked') {
      this.chatGateway.server.to(`user:${userId}`).emit('account_blocked', {
        message: 'Your account is blocked',
      });
    }

    return user;
  }

  async getAllChatHistory(
    page: number = 1,
    limit: number = 50,
    search?: string,
  ): Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const queryBuilder = this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.service', 'service')
      .leftJoinAndSelect('conversation.client', 'client')
      .leftJoinAndSelect('conversation.provider', 'provider')
      .where('conversation.deletedAt IS NULL')
      .orderBy('conversation.updatedAt', 'DESC');

    // Search by service title, client name, or provider name
    if (search) {
      queryBuilder.andWhere(
        '(service.title LIKE :search OR client.firstName LIKE :search OR client.lastName LIKE :search OR client.userName LIKE :search OR client.email LIKE :search OR provider.firstName LIKE :search OR provider.lastName LIKE :search OR provider.userName LIKE :search OR provider.email LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [conversations, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

    // Get message counts and last messages for each conversation
    const conversationIds = conversations.map((conv) => conv.id);
    const messageCounts = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.conversationId', 'conversationId')
      .addSelect('COUNT(message.id)', 'count')
      .where('message.conversationId IN (:...ids)', { ids: conversationIds })
      .groupBy('message.conversationId')
      .getRawMany();

    const countMap = new Map<string, number>();
    messageCounts.forEach((item) => {
      countMap.set(item.conversationId, parseInt(item.count, 10));
    });

    // Get last message for each conversation
    const lastMessages = await Promise.all(
      conversationIds.map(async (convId) => {
        const lastMsg = await this.messageRepository.findOne({
          where: { conversationId: convId },
          relations: ['sender'],
          order: { createdAt: 'DESC' },
        });
        return { conversationId: convId, message: lastMsg };
      }),
    );

    const lastMessageMap = new Map<string, any>();
    lastMessages.forEach((item) => {
      if (item.message) {
        lastMessageMap.set(item.conversationId, item.message);
      }
    });

    // Format the data with message counts
    const formattedData = conversations.map((conv) => {
      const messageCount = countMap.get(conv.id) || 0;
      const lastMessage = lastMessageMap.get(conv.id);

      return {
        id: conv.id,
        serviceId: conv.serviceId,
        service: conv.service ? {
          id: conv.service.id,
          title: conv.service.title,
        } : null,
        clientId: conv.clientId,
        client: conv.client ? {
          id: conv.client.id,
          email: conv.client.email,
          userName: conv.client.userName,
          firstName: conv.client.firstName,
          lastName: conv.client.lastName,
          avatar: conv.client.avatar,
        } : null,
        providerId: conv.providerId,
        provider: conv.provider ? {
          id: conv.provider.id,
          email: conv.provider.email,
          userName: conv.provider.userName,
          firstName: conv.provider.firstName,
          lastName: conv.provider.lastName,
          avatar: conv.provider.avatar,
        } : null,
        isBlocked: conv.isBlocked,
        blockedAt: conv.blockedAt,
        blockedReason: conv.blockedReason,
        messageCount,
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          message: lastMessage.message,
          senderId: lastMessage.senderId,
          sender: lastMessage.sender ? {
            id: lastMessage.sender.id,
            email: lastMessage.sender.email,
            userName: lastMessage.sender.userName,
            firstName: lastMessage.sender.firstName,
            lastName: lastMessage.sender.lastName,
          } : null,
          createdAt: lastMessage.createdAt,
        } : null,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };
    });

    return {
      data: formattedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getConversationMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 100,
  ): Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const [messages, total] = await this.messageRepository.findAndCount({
      where: { conversationId },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      sender: msg.sender ? {
        id: msg.sender.id,
        email: msg.sender.email,
        userName: msg.sender.userName,
        firstName: msg.sender.firstName,
        lastName: msg.sender.lastName,
        avatar: msg.sender.avatar,
      } : null,
      message: msg.message,
      attachmentFiles: msg.attachmentFiles,
      readAt: msg.readAt,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));

    return {
      data: formattedMessages.reverse(), // Reverse to show oldest first
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getLoginHistory(
    page: number = 1,
    limit: number = 50,
    userId?: string,
    success?: boolean,
  ): Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    const queryBuilder = this.loginHistoryRepository
      .createQueryBuilder('loginHistory')
      .leftJoinAndSelect('loginHistory.user', 'user')
      .orderBy('loginHistory.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (userId) {
      queryBuilder.andWhere('loginHistory.userId = :userId', { userId });
    }

    if (success !== undefined) {
      queryBuilder.andWhere('loginHistory.success = :success', { success });
    }

    const [loginHistory, total] = await queryBuilder.getManyAndCount();

    const formattedData = loginHistory.map((history) => ({
      id: history.id,
      userId: history.userId,
      user: history.user ? {
        id: history.user.id,
        email: history.user.email,
        userName: history.user.userName,
        firstName: history.user.firstName,
        lastName: history.user.lastName,
      } : null,
      ipAddress: history.ipAddress,
      userAgent: history.userAgent,
      deviceType: history.deviceType,
      browser: history.browser,
      os: history.os,
      deviceName: history.deviceName,
      location: history.location,
      loginType: history.loginType,
      success: history.success,
      failureReason: history.failureReason,
      createdAt: history.createdAt,
    }));

    return {
      data: formattedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async trackLoginAttempt(
    userId: string | null,
    success: boolean,
    failureReason?: string,
    ipAddress?: string,
    userAgent?: string,
    loginType: string = 'password',
  ) {
    try {
      const parsed = parseUserAgent(userAgent);
      
      // Fetch location from IP address (non-blocking)
      const locationInfo = await getLocationFromIP(ipAddress);
      
      const loginHistory = this.loginHistoryRepository.create({
        userId: userId || undefined,
        ipAddress,
        userAgent,
        deviceType: parsed.deviceType,
        browser: parsed.browser,
        os: parsed.os,
        deviceName: parsed.deviceName,
        location: locationInfo.location,
        loginType,
        success,
        failureReason: success ? undefined : failureReason,
      });

      await this.loginHistoryRepository.save(loginHistory);
    } catch (error) {
      // Don't fail login if tracking fails
      console.error('Failed to track login history:', error);
    }
  }
}

