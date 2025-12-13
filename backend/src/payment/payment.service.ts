import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
import { Balance } from '../entities/balance.entity';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { User } from '../entities/user.entity';
import { ChatGateway } from '../chat/chat.gateway';
import { Milestone, MilestoneStatus } from '../entities/milestone.entity';
import { Conversation } from '../entities/conversation.entity';
import { WalletService } from '../wallet/wallet.service';
import { TempWallet } from '../entities/temp-wallet.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';

@Injectable()
export class PaymentService {
  private readonly PLATFORM_FEE = 5; // $5 USDT platform fee
  private readonly MIN_WITHDRAW_AMOUNT = 5; // Minimum 5 USDT for withdrawal

  constructor(
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Milestone)
    private milestoneRepository: Repository<Milestone>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    private dataSource: DataSource,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
  ) { }

  async getBalance(userId: string): Promise<Balance> {
    let balance = await this.balanceRepository.findOne({
      where: { userId },
    });

    if (!balance) {
      balance = this.balanceRepository.create({
        userId,
        amount: 0,
      });
      balance = await this.balanceRepository.save(balance);
    }

    return balance;
  }


  async getTransactions(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Transaction[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [transactions, total] = await this.transactionRepository.findAndCount({
      where: [
        { clientId: userId, type: Not(TransactionType.PLATFORM_FEE) },
        { providerId: userId, type: Not(TransactionType.PLATFORM_FEE) },
      ],
      relations: ['milestone', 'client', 'provider'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createMilestoneTransaction(
    userId: string,
    milestoneId: string,
    amount: number,
    clientId: string,
    providerId: string,
  ): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get balance
      const balance = await queryRunner.manager.findOne(Balance, {
        where: { userId },
      });

      if (!balance || Number(balance.amount) < Number(amount)) {
        throw new BadRequestException('Insufficient balance');
      }

      // Create transaction for milestone payment
      // Client pays, so clientId is set, providerId is set for reference
      const transaction = queryRunner.manager.create(Transaction, {
        clientId,
        providerId,
        milestoneId,
        type: TransactionType.MILESTONE_PAYMENT,
        status: TransactionStatus.DRAFT,
        amount,
        description: `Milestone payment`,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // Update balance
      balance.amount = Number(balance.amount) - Number(amount);
      await queryRunner.manager.save(balance);

      await queryRunner.commitTransaction();

      // Get milestone info for notification (after transaction commit)
      const milestone = await this.milestoneRepository.findOne({
        where: { id: milestoneId },
      });

      if (milestone) {
        // Send notification to provider about pending payment
        await this.notificationService.createNotification(
          providerId,
          NotificationType.MILESTONE_PAYMENT_PENDING,
          'Payment Pending',
          `A payment of ${Number(amount).toFixed(2)} USDT is pending for milestone "${milestone.title}". Release the milestone to accept payment.`,
          { transactionId: savedTransaction.id, milestoneId, amount },
        );

        // Send notification to client confirming payment creation
        await this.notificationService.createNotification(
          clientId,
          NotificationType.MILESTONE_PAYMENT_PENDING,
          'Payment Created',
          `You created a payment of ${Number(amount).toFixed(2)} USDT for milestone "${milestone.title}". Waiting for provider to release.`,
          { transactionId: savedTransaction.id, milestoneId, amount },
        );
      }

      return savedTransaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async releaseMilestoneTransaction(milestoneId: string, providerId: string): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find the transaction - check for DRAFT status first, but also allow SUCCESS in case it was already processed
      let transaction = await queryRunner.manager.findOne(Transaction, {
        where: { milestoneId, status: TransactionStatus.DRAFT },
      });

      // If not found with DRAFT status, try to find any transaction for this milestone
      if (!transaction) {
        transaction = await queryRunner.manager.findOne(Transaction, {
          where: { milestoneId },
        });
      }

      if (!transaction) {
        throw new NotFoundException('Transaction not found for this milestone');
      }

      // Only update if it's in DRAFT status
      if (transaction.status !== TransactionStatus.DRAFT) {
        throw new BadRequestException(`Transaction is already in ${transaction.status} status and cannot be released`);
      }

      // Update transaction status to PENDING (waiting for provider acceptance)
      // Don't create a new transaction record, just update the existing one
      transaction.status = TransactionStatus.PENDING;
      transaction.description = `Milestone payment - awaiting acceptance`;
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      // Get milestone info for notification
      const milestone = await this.milestoneRepository.findOne({
        where: { id: milestoneId },
      });

      if (milestone) {
        // Send notification to provider about payment awaiting acceptance
        await this.notificationService.createNotification(
          providerId,
          NotificationType.MILESTONE_PAYMENT_PENDING,
          'Payment Awaiting Acceptance',
          `A payment of ${Number(transaction.amount).toFixed(2)} USDT for milestone "${milestone.title}" is awaiting your acceptance.`,
          { transactionId: transaction.id, milestoneId, amount: transaction.amount },
        );

        // Send notification to client about payment release
        await this.notificationService.createNotification(
          milestone.clientId,
          NotificationType.MILESTONE_UPDATED,
          'Payment Released',
          `Payment of ${Number(transaction.amount).toFixed(2)} USDT for milestone "${milestone.title}" has been released and is awaiting provider acceptance.`,
          { transactionId: transaction.id, milestoneId, amount: transaction.amount },
        );
      }

      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Release milestone transaction with custom amount (admin only)
   */
  async releaseMilestoneTransactionWithAmount(
    milestoneId: string,
    providerId: string,
    amount: number,
  ): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get milestone
      const milestone = await this.milestoneRepository.findOne({
        where: { id: milestoneId },
      });

      if (!milestone) {
        throw new NotFoundException('Milestone not found');
      }

      // Find existing transaction
      let transaction = await queryRunner.manager.findOne(Transaction, {
        where: { milestoneId, type: TransactionType.MILESTONE_PAYMENT },
      });

      if (transaction) {
        // Update existing transaction with new amount
        const oldAmount = Number(transaction.amount);
        const amountDiff = amount - oldAmount;

        // If new amount is different, adjust client balance
        if (amountDiff !== 0 && transaction.clientId) {
          let clientBalance = await queryRunner.manager.findOne(Balance, {
            where: { userId: transaction.clientId },
          });

          if (!clientBalance) {
            clientBalance = queryRunner.manager.create(Balance, {
              userId: transaction.clientId,
              amount: 0,
            });
          }

          // If amount increased, deduct from client balance
          // If amount decreased, refund to client balance
          clientBalance.amount = Number(clientBalance.amount) - amountDiff;
          await queryRunner.manager.save(clientBalance);
        }

        transaction.amount = amount;
        transaction.status = TransactionStatus.PENDING;
        transaction.description = `Milestone payment - awaiting acceptance (admin resolved dispute)`;
        await queryRunner.manager.save(transaction);
      } else {
        // Create new transaction if none exists
        transaction = queryRunner.manager.create(Transaction, {
          clientId: milestone.clientId,
          providerId: milestone.providerId,
          milestoneId,
          type: TransactionType.MILESTONE_PAYMENT,
          status: TransactionStatus.PENDING,
          amount,
          description: `Milestone payment - awaiting acceptance (admin resolved dispute)`,
        });

        // Deduct from client balance
        if (milestone.clientId) {
          let clientBalance = await queryRunner.manager.findOne(Balance, {
            where: { userId: milestone.clientId },
          });

          if (!clientBalance) {
            clientBalance = queryRunner.manager.create(Balance, {
              userId: milestone.clientId,
              amount: 0,
            });
          }

          if (Number(clientBalance.amount) < amount) {
            throw new BadRequestException('Client has insufficient balance');
          }

          clientBalance.amount = Number(clientBalance.amount) - amount;
          await queryRunner.manager.save(clientBalance);
        }

        transaction = await queryRunner.manager.save(transaction);
      }

      // Update milestone status to RELEASED
      milestone.status = MilestoneStatus.RELEASED;
      await queryRunner.manager.save(milestone);

      await queryRunner.commitTransaction();

      // Send notifications
      await this.notificationService.createNotification(
        providerId,
        NotificationType.MILESTONE_PAYMENT_PENDING,
        'Payment Awaiting Acceptance',
        `A payment of ${Number(amount).toFixed(2)} USDT for milestone "${milestone.title}" is awaiting your acceptance (dispute resolved by admin).`,
        { transactionId: transaction.id, milestoneId, amount },
      );

      await this.notificationService.createNotification(
        milestone.clientId,
        NotificationType.MILESTONE_UPDATED,
        'Payment Released',
        `Payment of ${Number(amount).toFixed(2)} USDT for milestone "${milestone.title}" has been released by admin and is awaiting provider acceptance.`,
        { transactionId: transaction.id, milestoneId, amount },
      );

      // Emit balance update for client
      if (milestone.clientId) {
        const clientBalance = await this.balanceRepository.findOne({
          where: { userId: milestone.clientId },
        });
        if (clientBalance) {
          this.chatGateway.server.to(`user:${milestone.clientId}`).emit('balance_updated', {
            balance: {
              id: clientBalance.id,
              userId: clientBalance.userId,
              amount: Number(clientBalance.amount),
              createdAt: clientBalance.createdAt.toISOString(),
              updatedAt: clientBalance.updatedAt.toISOString(),
            },
          });
        }
      }

      // Get conversation to emit milestone and payment updates
      const conv = await this.conversationRepository.findOne({
        where: {
          serviceId: milestone.serviceId,
          clientId: milestone.clientId,
          providerId: milestone.providerId,
          deletedAt: null,
        },
      });

      if (conv) {
        // Load transaction with relations for WebSocket emission
        const transactionWithRelations = await this.transactionRepository.findOne({
          where: { id: transaction.id },
          relations: ['client', 'provider', 'milestone'],
        });

        // Load milestone with relations
        const milestoneWithRelations = await this.milestoneRepository.findOne({
          where: { id: milestone.id },
          relations: ['client', 'provider', 'service'],
        });

        // Emit milestone update to conversation room
        if (milestoneWithRelations) {
          this.chatGateway.emitMilestoneUpdate(conv.id, milestoneWithRelations).catch((error) => {
            console.error('Failed to emit milestone update:', error);
          });
        }

        // Emit payment pending event to conversation room
        if (transactionWithRelations) {
          this.chatGateway.server.to(`conversation:${conv.id}`).emit('payment_pending', {
            transaction: transactionWithRelations,
            milestoneId: milestone.id,
            conversationId: conv.id,
          });
        }
      }

      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async acceptPayment(transactionId: string, userId: string): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find the pending transaction
      const transaction = await queryRunner.manager.findOne(Transaction, {
        where: { id: transactionId, status: TransactionStatus.PENDING },
      });

      if (!transaction) {
        throw new NotFoundException('Pending payment not found');
      }

      // Verify user is the provider
      if (transaction.providerId !== userId) {
        throw new BadRequestException('Only the provider can accept this payment');
      }

      // Calculate 2% transaction fee
      const transactionAmount = Number(transaction.amount);
      const transactionFee = transactionAmount * 0.02; // 2% fee
      const providerAmount = transactionAmount - transactionFee; // 98% to provider

      // Update transaction status to SUCCESS
      transaction.status = TransactionStatus.SUCCESS;
      transaction.description = `Milestone payment received (2% fee: ${transactionFee.toFixed(2)} USDT)`;
      await queryRunner.manager.save(transaction);

      // Get or create provider balance
      let providerBalance = await queryRunner.manager.findOne(Balance, {
        where: { userId },
      });

      if (!providerBalance) {
        providerBalance = queryRunner.manager.create(Balance, {
          userId,
          amount: 0,
        });
        providerBalance = await queryRunner.manager.save(providerBalance);
      }

      // Update provider balance with 98% of transaction amount
      providerBalance.amount = Number(providerBalance.amount) + providerAmount;
      await queryRunner.manager.save(providerBalance);

      // Find admin user and add 2% fee to admin balance
      const adminUser = await queryRunner.manager.findOne(User, {
        where: { role: 'admin' },
      });

      if (adminUser) {
        let adminBalance = await queryRunner.manager.findOne(Balance, {
          where: { userId: adminUser.id },
        });

        if (!adminBalance) {
          adminBalance = queryRunner.manager.create(Balance, {
            userId: adminUser.id,
            amount: 0,
          });
        }

        // Add 2% transaction fee to admin balance
        adminBalance.amount = Number(adminBalance.amount) + transactionFee;
        await queryRunner.manager.save(adminBalance);

        // Create transaction record for the 2% platform fee
        const platformFeeTransaction = queryRunner.manager.create(Transaction, {
          clientId: transaction.clientId,
          providerId: transaction.providerId,
          milestoneId: transaction.milestoneId,
          type: TransactionType.PLATFORM_FEE,
          status: TransactionStatus.SUCCESS,
          amount: transactionFee,
          platformFee: transactionFee,
          description: `Platform fee (2%) from milestone payment of ${transactionAmount.toFixed(2)} USDT`,
        });
        await queryRunner.manager.save(platformFeeTransaction);
      }

      await queryRunner.commitTransaction();

      // Load transaction with relations for WebSocket emission and notifications
      const transactionWithRelations = await this.transactionRepository.findOne({
        where: { id: transaction.id },
        relations: ['client', 'provider', 'milestone'],
      });

      // Get conversationId from milestone to emit WebSocket event
      let conversation = null;
      if (transactionWithRelations?.milestone) {
        conversation = await this.conversationRepository.findOne({
          where: [
            { clientId: transactionWithRelations.milestone.clientId, providerId: transactionWithRelations.milestone.providerId },
          ],
        });

        if (conversation) {
          // Emit payment accepted event to all users in the conversation
          this.chatGateway.server.to(`conversation:${conversation.id}`).emit('payment_accepted', {
            transaction: transactionWithRelations,
            milestoneId: transactionWithRelations.milestone.id,
            conversationId: conversation.id,
          });
        }
      }

      // Get milestone info for better notification messages
      const milestone = transactionWithRelations?.milestone;
      const milestoneTitle = milestone?.title || 'milestone';

      // Create notifications for both client and provider
      await this.notificationService.createNotification(
        transaction.clientId!,
        NotificationType.MILESTONE_UPDATED,
        'Payment Accepted',
        `Your payment of ${Number(transaction.amount).toFixed(2)} USDT for milestone "${milestoneTitle}" has been accepted by the provider.`,
        { transactionId: transaction.id, milestoneId: transaction.milestoneId, amount: transaction.amount, conversationId: conversation?.id },
      );

      // Calculate amounts for notification (same calculation as above)
      const notificationTransactionAmount = Number(transaction.amount);
      const notificationFee = notificationTransactionAmount * 0.02;
      const notificationProviderAmount = notificationTransactionAmount - notificationFee;

      await this.notificationService.createNotification(
        transaction.providerId!,
        NotificationType.MILESTONE_UPDATED,
        'Payment Accepted',
        `You accepted and received ${notificationProviderAmount.toFixed(2)} USDT for milestone "${milestoneTitle}" (2% platform fee: ${notificationFee.toFixed(2)} USDT).`,
        { transactionId: transaction.id, milestoneId: transaction.milestoneId, amount: notificationProviderAmount, conversationId: conversation?.id },
      );

      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getPendingPaymentByMilestone(milestoneId: string, userId: string): Promise<Transaction | null> {
    // Find pending payment where user is either the client or the provider
    return this.transactionRepository.findOne({
      where: [
        {
          milestoneId,
          clientId: userId,
          status: TransactionStatus.PENDING,
          type: TransactionType.MILESTONE_PAYMENT,
        },
        {
          milestoneId,
          providerId: userId,
          status: TransactionStatus.PENDING,
          type: TransactionType.MILESTONE_PAYMENT,
        },
      ],
      relations: ['client', 'provider', 'milestone'],
    });
  }

  async getSuccessfulPaymentByMilestone(milestoneId: string, userId: string): Promise<Transaction | null> {
    // Find successful payment where user is either the client or the provider
    return this.transactionRepository.findOne({
      where: [
        {
          milestoneId,
          clientId: userId,
          status: TransactionStatus.SUCCESS,
          type: TransactionType.MILESTONE_PAYMENT,
        },
        {
          milestoneId,
          providerId: userId,
          status: TransactionStatus.SUCCESS,
          type: TransactionType.MILESTONE_PAYMENT,
        },
      ],
      relations: ['client', 'provider', 'milestone'],
    });
  }

  /**
   * Handle milestone withdrawal - update transaction status and refund client balance
   */
  async withdrawMilestoneTransaction(milestoneId: string, providerId: string): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find the transaction for this milestone
      const transaction = await queryRunner.manager.findOne(Transaction, {
        where: { milestoneId, type: TransactionType.MILESTONE_PAYMENT },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found for this milestone');
      }

      // Verify user is the provider
      if (transaction.providerId !== providerId) {
        throw new BadRequestException('Only the provider can withdraw this milestone');
      }

      // Check if transaction can be withdrawn (not already withdrawn, cancelled, or failed)
      if (transaction.status === TransactionStatus.WITHDRAW) {
        throw new BadRequestException('Transaction is already withdrawn');
      }

      if (transaction.status === TransactionStatus.CANCELLED || transaction.status === TransactionStatus.FAILED) {
        throw new BadRequestException(`Cannot withdraw transaction with status ${transaction.status}`);
      }

      // Store old status before updating
      const oldStatus = transaction.status;

      // Update transaction status to WITHDRAW
      transaction.status = TransactionStatus.WITHDRAW;
      transaction.description = `Milestone payment withdrawn`;
      await queryRunner.manager.save(transaction);

      // Refund client balance (amount was deducted when transaction was created)
      if (transaction.clientId) {
        let clientBalance = await queryRunner.manager.findOne(Balance, {
          where: { userId: transaction.clientId },
        });

        if (!clientBalance) {
          clientBalance = queryRunner.manager.create(Balance, {
            userId: transaction.clientId,
            amount: 0,
          });
        }

        clientBalance.amount = Number(clientBalance.amount) + Number(transaction.amount);
        await queryRunner.manager.save(clientBalance);
      }

      // If transaction was SUCCESS (provider had already accepted), deduct from provider balance
      if (oldStatus === TransactionStatus.SUCCESS && transaction.providerId) {
        let providerBalance = await queryRunner.manager.findOne(Balance, {
          where: { userId: transaction.providerId },
        });

        if (providerBalance) {
          providerBalance.amount = Number(providerBalance.amount) - Number(transaction.amount);
          await queryRunner.manager.save(providerBalance);
        }
      }

      await queryRunner.commitTransaction();

      // Emit balance update event for client
      if (transaction.clientId) {
        const clientBalance = await this.balanceRepository.findOne({
          where: { userId: transaction.clientId },
        });
        if (clientBalance) {
          this.chatGateway.server.to(`user:${transaction.clientId}`).emit('balance_updated', {
            balance: {
              id: clientBalance.id,
              userId: clientBalance.userId,
              amount: Number(clientBalance.amount),
              createdAt: clientBalance.createdAt.toISOString(),
              updatedAt: clientBalance.updatedAt.toISOString(),
            },
          });
        }
      }

      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handle milestone cancellation - update transaction status and refund client balance
   */
  async cancelMilestoneTransaction(milestoneId: string, clientId: string): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find the transaction for this milestone
      const transaction = await queryRunner.manager.findOne(Transaction, {
        where: { milestoneId, type: TransactionType.MILESTONE_PAYMENT },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found for this milestone');
      }

      // Verify user is the client
      if (transaction.clientId !== clientId) {
        throw new BadRequestException('Only the client can cancel this milestone');
      }

      // Check if transaction can be cancelled (not already cancelled, withdrawn, or failed)
      if (transaction.status === TransactionStatus.CANCELLED) {
        throw new BadRequestException('Transaction is already cancelled');
      }

      if (transaction.status === TransactionStatus.WITHDRAW || transaction.status === TransactionStatus.FAILED) {
        throw new BadRequestException(`Cannot cancel transaction with status ${transaction.status}`);
      }

      // Store old status before updating
      const oldStatus = transaction.status;

      // Update transaction status to CANCELLED
      transaction.status = TransactionStatus.CANCELLED;
      transaction.description = `Milestone payment cancelled`;
      await queryRunner.manager.save(transaction);

      // Refund client balance (amount was deducted when transaction was created)
      if (transaction.clientId) {
        let clientBalance = await queryRunner.manager.findOne(Balance, {
          where: { userId: transaction.clientId },
        });

        if (!clientBalance) {
          clientBalance = queryRunner.manager.create(Balance, {
            userId: transaction.clientId,
            amount: 0,
          });
        }

        clientBalance.amount = Number(clientBalance.amount) + Number(transaction.amount);
        await queryRunner.manager.save(clientBalance);
      }

      // If transaction was SUCCESS (provider had already accepted), deduct from provider balance
      if (oldStatus === TransactionStatus.SUCCESS && transaction.providerId) {
        let providerBalance = await queryRunner.manager.findOne(Balance, {
          where: { userId: transaction.providerId },
        });

        if (providerBalance) {
          providerBalance.amount = Number(providerBalance.amount) - Number(transaction.amount);
          await queryRunner.manager.save(providerBalance);
        }
      }

      await queryRunner.commitTransaction();

      // Emit balance update event for client
      if (transaction.clientId) {
        const clientBalance = await this.balanceRepository.findOne({
          where: { userId: transaction.clientId },
        });
        if (clientBalance) {
          this.chatGateway.server.to(`user:${transaction.clientId}`).emit('balance_updated', {
            balance: {
              id: clientBalance.id,
              userId: clientBalance.userId,
              amount: Number(clientBalance.amount),
              createdAt: clientBalance.createdAt.toISOString(),
              updatedAt: clientBalance.updatedAt.toISOString(),
            },
          });
        }
      }

      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Initiate a charge transaction - creates temp wallet and pending transaction
   */
  async initiateCharge(userId: string, amount: number): Promise<{
    walletAddress: string;
    amount: number;
    platformFee: number;
    total: number;
    transactionId: string;
    expiresAt: string;
  }> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get or create temp wallet
      const tempWallet = await this.walletService.getOrCreateTempWallet(userId);

      // Calculate platform fee and total
      const platformFee = this.PLATFORM_FEE;
      const total = amount + platformFee;

      // Set expiration to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Create pending transaction
      const transaction = queryRunner.manager.create(Transaction, {
        clientId: userId,
        type: TransactionType.CHARGE,
        status: TransactionStatus.PENDING,
        amount: amount, // Amount user will receive (excluding fees)
        expectedAmount: total, // Total amount user needs to send
        platformFee: platformFee,
        tempWalletId: tempWallet.id,
        walletAddress: tempWallet.address,
        description: `Charge balance: ${amount} USDT`,
        expiresAt: expiresAt,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        walletAddress: tempWallet.address,
        amount: amount,
        platformFee: platformFee,
        total: total,
        transactionId: savedTransaction.id,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get charge status by transaction ID
   */
  async getChargeStatus(transactionId: string, userId: string): Promise<{
    status: string;
    transactionHash?: string;
    confirmedAt?: string;
  }> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, clientId: userId, type: TransactionType.CHARGE },
      relations: ['tempWallet'],
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return {
      status: transaction.status,
      transactionHash: transaction.transactionHash,
      confirmedAt: transaction.status === TransactionStatus.SUCCESS ? transaction.updatedAt.toISOString() : undefined,
    };
  }

  /**
   * Get charge details by wallet address
   */
  async getChargeByWalletAddress(walletAddress: string, userId: string): Promise<{
    walletAddress: string;
    amount: number;
    platformFee: number;
    total: number;
    transactionId: string;
    expiresAt: string;
    status: string;
    transactionHash?: string;
  }> {
    const transaction = await this.transactionRepository.findOne({
      where: { walletAddress, clientId: userId, type: TransactionType.CHARGE },
      relations: ['tempWallet'],
      order: { createdAt: 'DESC' },
    });

    if (!transaction) {
      throw new NotFoundException('Charge transaction not found');
    }

    return {
      walletAddress: transaction.walletAddress!,
      amount: transaction.amount,
      platformFee: transaction.platformFee || 0,
      total: transaction.expectedAmount || transaction.amount,
      transactionId: transaction.id,
      expiresAt: transaction.expiresAt?.toISOString() || '',
      status: transaction.status,
      transactionHash: transaction.transactionHash,
    };
  }

  /**
   * Monitor temp wallet and process payment when detected
   * This should be called periodically (e.g., every 30 seconds) for pending charge transactions
   */
  async monitorTempWalletPayment(transactionId: string): Promise<{ success: boolean; message?: string }> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, type: TransactionType.CHARGE, status: TransactionStatus.PENDING },
      relations: ['tempWallet'],
    });

    if (!transaction || !transaction.tempWallet) {
      return { success: false, message: 'Transaction or temp wallet not found' };
    }

    // Check if already processed
    if (transaction.status !== TransactionStatus.PENDING) {
      return { success: false, message: 'Transaction already processed' };
    }

    // Check if expired
    if (transaction.expiresAt && new Date() > transaction.expiresAt) {
      transaction.status = TransactionStatus.CANCELLED;
      await this.transactionRepository.save(transaction);
      return { success: false, message: 'Transaction expired' };
    }

    const tempWallet = transaction.tempWallet;
    const expectedAmount = transaction.expectedAmount || transaction.amount + (transaction.platformFee || 0);

    // Check wallet balance
    const usdtBalance = await this.walletService.getUSDTBalance(tempWallet.address);
    const trxBalance = await this.walletService.getTRXBalance(tempWallet.address);

    // If amount is less than expected, notify user (but don't process)
    if (usdtBalance > 0 && usdtBalance < expectedAmount) {
      // Update last checked time
      await this.walletService.updateWalletLastChecked(tempWallet.id);
      return {
        success: false,
        message: `Insufficient amount. Received: ${usdtBalance.toFixed(2)} USDT, Expected: ${expectedAmount.toFixed(2)} USDT`,
      };
    }

    // If amount is sufficient, process the payment
    if (usdtBalance >= expectedAmount || trxBalance > 0.000001) {
      return await this.processChargePayment(transaction);
    }

    // No payment detected yet
    await this.walletService.updateWalletLastChecked(tempWallet.id);
    return { success: false, message: 'Payment not detected yet' };
  }

  /**
   * Process charge payment: transfer funds and update balance
   */
  private async processChargePayment(transaction: Transaction): Promise<{ success: boolean; message?: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Reload transaction to ensure we have latest state
      const currentTransaction = await queryRunner.manager.findOne(Transaction, {
        where: { id: transaction.id },
        relations: ['tempWallet'],
      });

      if (!currentTransaction || !currentTransaction.tempWallet) {
        throw new NotFoundException('Transaction or temp wallet not found');
      }

      // Double-check status
      if (currentTransaction.status !== TransactionStatus.PENDING) {
        return { success: false, message: 'Transaction already processed' };
      }

      const tempWallet = currentTransaction.tempWallet;
      const usdtBalance = await this.walletService.getUSDTBalance(tempWallet.address);
      const trxBalance = await this.walletService.getTRXBalance(tempWallet.address);

      // Send 20 TRX from master wallet
      if (trxBalance < 10) {
        // Send 20 TRX from master wallet to temp wallet for gas
        const trxResult = await this.walletService.sendTRXToTempWallet(tempWallet.address, 20);
        if (!trxResult.success) {
          throw new BadRequestException(`Failed to send TRX for gas: ${trxResult.error}`);
        }
        // Wait a bit for transaction to be confirmed
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      // Transfer all USDT from temp wallet to master wallet
      const transferResult = await this.walletService.transferFromTempWalletToMaster(tempWallet);
      if (!transferResult.success) {
        throw new BadRequestException(`Failed to transfer funds: ${transferResult.error}`);
      }

      // Update transaction status to SUCCESS
      currentTransaction.status = TransactionStatus.SUCCESS;
      currentTransaction.transactionHash = transferResult.usdtTxHash || transferResult.trxTxHash;
      currentTransaction.description = `Charge completed. USDT TX: ${transferResult.usdtTxHash || 'N/A'}`;
      await queryRunner.manager.save(currentTransaction);

      // Update user balance (amount excluding platform fee)
      let userBalance = await queryRunner.manager.findOne(Balance, {
        where: { userId: currentTransaction.clientId },
      });

      if (!userBalance) {
        userBalance = queryRunner.manager.create(Balance, {
          userId: currentTransaction.clientId!,
          amount: 0,
        });
      }

      // Add amount to balance (excluding platform fee)
      userBalance.amount = Number(userBalance.amount) + Number(currentTransaction.amount);
      await queryRunner.manager.save(userBalance);

      // Update temp wallet total received
      tempWallet.totalReceived = Number(tempWallet.totalReceived) + Number(currentTransaction.expectedAmount || currentTransaction.amount);
      await queryRunner.manager.save(tempWallet);

      await queryRunner.commitTransaction();

      // Get updated balance for WebSocket emission
      const updatedBalance = await this.balanceRepository.findOne({
        where: { userId: currentTransaction.clientId },
      });

      // Create notification for successful charge
      await this.notificationService.createNotification(
        currentTransaction.clientId!,
        NotificationType.PAYMENT_CHARGE,
        'Charge Completed',
        `Your balance has been charged with ${Number(currentTransaction.amount).toFixed(2)} USDT`,
        { transactionId: currentTransaction.id, amount: currentTransaction.amount },
      );

      // Emit balance update event via WebSocket
      if (currentTransaction.clientId && updatedBalance) {
        this.chatGateway.server.to(`user:${currentTransaction.clientId}`).emit('balance_updated', {
          balance: {
            id: updatedBalance.id,
            userId: updatedBalance.userId,
            amount: Number(updatedBalance.amount),
            createdAt: updatedBalance.createdAt.toISOString(),
            updatedAt: updatedBalance.updatedAt.toISOString(),
          },
        });
      }

      return { success: true, message: 'Charge processed successfully' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error processing charge payment:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create withdraw request
   */
  async withdraw(userId: string, amount: number, walletAddress: string): Promise<Transaction> {
    // Validate amount
    if (amount < this.MIN_WITHDRAW_AMOUNT) {
      throw new BadRequestException(`Minimum withdrawal amount is ${this.MIN_WITHDRAW_AMOUNT} USDT`);
    }

    // Validate wallet address format (basic TRON address validation)
    if (!walletAddress || !walletAddress.startsWith('T') || walletAddress.length !== 34) {
      throw new BadRequestException('Invalid TRON wallet address');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check user balance
      const balance = await queryRunner.manager.findOne(Balance, {
        where: { userId },
      });

      if (!balance || Number(balance.amount) < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      // Create pending withdraw transaction
      const transaction = queryRunner.manager.create(Transaction, {
        clientId: userId,
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.PENDING,
        amount: amount,
        walletAddress: walletAddress,
        description: `Withdraw ${amount} USDT to ${walletAddress}`,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // Lock balance (deduct immediately)
      balance.amount = Number(balance.amount) - Number(amount);
      await queryRunner.manager.save(balance);

      await queryRunner.commitTransaction();

      return savedTransaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get withdraw status
   */
  async getWithdrawStatus(transactionId: string, userId: string): Promise<{
    status: string;
    transactionHash?: string;
    confirmedAt?: string;
  }> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, clientId: userId, type: TransactionType.WITHDRAW },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return {
      status: transaction.status,
      transactionHash: transaction.transactionHash,
      confirmedAt: transaction.status === TransactionStatus.SUCCESS ? transaction.updatedAt.toISOString() : undefined,
    };
  }

  /**
   * Process withdraw (called by admin)
   */
  async processWithdraw(transactionId: string): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transaction = await queryRunner.manager.findOne(Transaction, {
        where: { id: transactionId, type: TransactionType.WITHDRAW, status: TransactionStatus.PENDING },
      });

      if (!transaction) {
        throw new NotFoundException('Pending withdraw transaction not found');
      }

      if (!transaction.walletAddress) {
        throw new BadRequestException('Wallet address not specified');
      }

      // Get master wallet
      const masterWallet = this.walletService.getMasterWallet();

      // Send USDT from master wallet to user's wallet
      const result = await this.walletService.sendUSDT(
        masterWallet.privateKey,
        transaction.walletAddress,
        transaction.amount,
      );

      if (!result.success) {
        // Refund balance on failure
        const balance = await queryRunner.manager.findOne(Balance, {
          where: { userId: transaction.clientId },
        });

        if (balance) {
          balance.amount = Number(balance.amount) + Number(transaction.amount);
          await queryRunner.manager.save(balance);
        }

        transaction.status = TransactionStatus.FAILED;
        transaction.description = `Withdraw failed: ${result.error}`;
        await queryRunner.manager.save(transaction);

        await queryRunner.commitTransaction();
        throw new BadRequestException(`Failed to process withdrawal: ${result.error}`);
      }

      // Update transaction to SUCCESS
      transaction.status = TransactionStatus.SUCCESS;
      transaction.transactionHash = result.transactionHash;
      transaction.description = `Withdraw completed. TX: ${result.transactionHash}`;
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      // Create notification for successful withdraw
      if (transaction.clientId) {
        await this.notificationService.createNotification(
          transaction.clientId,
          NotificationType.PAYMENT_WITHDRAW,
          'Withdrawal Completed',
          `Your withdrawal of ${Number(transaction.amount).toFixed(2)} USDT has been processed successfully`,
          { transactionId: transaction.id, amount: transaction.amount, transactionHash: result.transactionHash },
        );

        // Emit WebSocket notification to user if they're online
        this.chatGateway.server.to(`user:${transaction.clientId}`).emit('withdraw_completed', {
          transactionId: transaction.id,
          amount: transaction.amount,
          transactionHash: result.transactionHash,
          status: 'success',
        });
      }

      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

