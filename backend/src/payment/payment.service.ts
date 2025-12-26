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
import { TempWallet, TempWalletStatus, WalletNetwork } from '../entities/temp-wallet.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../entities/notification.entity';
import { ReferralService } from '../referral/referral.service';
import { PaymentNetwork } from '../entities/transaction.entity';
import { PolygonWalletService } from '../polygon-wallet/polygon-wallet.service';

@Injectable()
export class PaymentService {
  private readonly PLATFORM_FEE_USDT_TRC20 = 1; // $1 USD platform fee
  private readonly PLATFORM_FEE_USDC_POLYGON = 2; // $2 USD platform fee (USDC Polygon)
  private readonly MIN_WITHDRAW_AMOUNT = 5; // Must be > 5 (validated in code)

  private getPlatformFee(paymentNetwork: PaymentNetwork): number {
    return paymentNetwork === PaymentNetwork.USDC_POLYGON ? this.PLATFORM_FEE_USDC_POLYGON : this.PLATFORM_FEE_USDT_TRC20;
  }

  private getCurrency(paymentNetwork: PaymentNetwork): 'USDT' | 'USDC' {
    return paymentNetwork === PaymentNetwork.USDC_POLYGON ? 'USDC' : 'USDT';
  }

  private getWalletNetwork(paymentNetwork: PaymentNetwork): WalletNetwork {
    return paymentNetwork === PaymentNetwork.USDC_POLYGON ? WalletNetwork.POLYGON : WalletNetwork.TRON;
  }

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
    private polygonWalletService: PolygonWalletService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    @Inject(forwardRef(() => ReferralService))
    private referralService: ReferralService,
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
          `A payment of ${Number(amount).toFixed(2)} USD is pending for milestone "${milestone.title}". Release the milestone to accept payment.`,
          { transactionId: savedTransaction.id, milestoneId, amount },
        );

        // Send notification to client confirming payment creation
        await this.notificationService.createNotification(
          clientId,
          NotificationType.MILESTONE_PAYMENT_PENDING,
          'Payment Created',
          `You created a payment of ${Number(amount).toFixed(2)} USD for milestone "${milestone.title}". Waiting for provider to release.`,
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
          `A payment of ${Number(transaction.amount).toFixed(2)} USD for milestone "${milestone.title}" is awaiting your acceptance.`,
          { transactionId: transaction.id, milestoneId, amount: transaction.amount },
        );

        // Send notification to client about payment release
        await this.notificationService.createNotification(
          milestone.clientId,
          NotificationType.MILESTONE_UPDATED,
          'Payment Released',
          `Payment of ${Number(transaction.amount).toFixed(2)} USD for milestone "${milestone.title}" has been released and is awaiting provider acceptance.`,
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
        `A payment of ${Number(amount).toFixed(2)} USD for milestone "${milestone.title}" is awaiting your acceptance (dispute resolved by admin).`,
        { transactionId: transaction.id, milestoneId, amount },
      );

      await this.notificationService.createNotification(
        milestone.clientId,
        NotificationType.MILESTONE_UPDATED,
        'Payment Released',
        `Payment of ${Number(amount).toFixed(2)} USD for milestone "${milestone.title}" has been released by admin and is awaiting provider acceptance.`,
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
      transaction.description = `Milestone payment received (2% fee: ${transactionFee.toFixed(2)} USD)`;
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
          description: `Platform fee (2%) from milestone payment of ${transactionAmount.toFixed(2)} USD`,
        });
        await queryRunner.manager.save(platformFeeTransaction);
      }

      await queryRunner.commitTransaction();

      // Process referral reward if this is client's first purchase
      if (transaction.clientId) {
        try {
          // Check if this is the first completed milestone payment for the client
          // Since we just committed, this transaction is now SUCCESS
          const completedTransactions = await this.transactionRepository.count({
            where: {
              clientId: transaction.clientId,
              status: TransactionStatus.SUCCESS,
              type: TransactionType.MILESTONE_PAYMENT, // Only count milestone payments as purchases
            },
          });

          // If this is the first completed milestone payment, process referral reward
          if (completedTransactions === 1) {
            await this.referralService.processPurchaseReward(
              transaction.clientId,
              transactionAmount,
            );
          }
        } catch (error) {
          // Log error but don't fail payment acceptance
          console.error('Referral reward processing failed:', error.message);
        }
      }

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
        `Your payment of ${Number(transaction.amount).toFixed(2)} USD for milestone "${milestoneTitle}" has been accepted by the provider.`,
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
        `You accepted and received ${notificationProviderAmount.toFixed(2)} USD for milestone "${milestoneTitle}" (2% platform fee: ${notificationFee.toFixed(2)} USD).`,
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
  async initiateCharge(userId: string, amount: number, paymentNetwork: PaymentNetwork = PaymentNetwork.USDT_TRC20): Promise<{
    walletAddress: string;
    amount: number;
    platformFee: number;
    total: number;
    transactionId: string;
    expiresAt: string;
    paymentNetwork: PaymentNetwork;
  }> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create a fresh temp wallet per charge (per requirements)
      const tempWallet: TempWallet =
        paymentNetwork === PaymentNetwork.USDC_POLYGON
          ? await this.polygonWalletService.createTempWallet(userId)
          : await this.walletService.createTempWallet(userId, WalletNetwork.TRON);

      // Calculate platform fee and total
      const platformFee = this.getPlatformFee(paymentNetwork);
      const total = amount + platformFee;

      // Set expiration to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const currency = this.getCurrency(paymentNetwork);

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
        paymentNetwork: paymentNetwork,
        description: `Charge balance: ${amount} ${currency}`,
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
        paymentNetwork: paymentNetwork,
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
    description?: string;
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
      description: transaction.description,
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
    paymentNetwork?: PaymentNetwork;
  }> {
    const transaction = await this.transactionRepository.findOne({
      where: { walletAddress, clientId: userId, type: TransactionType.CHARGE },
      relations: ['tempWallet'],
      order: { createdAt: 'DESC' },
    });

    if (!transaction) {
      throw new NotFoundException('Charge transaction not found');
    }

    // Determine paymentNetwork: use transaction's paymentNetwork, or infer from tempWallet's network, or default to USDT_TRC20
    let paymentNetwork = transaction.paymentNetwork;
    if (!paymentNetwork && transaction.tempWallet) {
      // Fallback: infer from tempWallet's network
      paymentNetwork = transaction.tempWallet.network === WalletNetwork.POLYGON 
        ? PaymentNetwork.USDC_POLYGON 
        : PaymentNetwork.USDT_TRC20;
    }
    if (!paymentNetwork) {
      paymentNetwork = PaymentNetwork.USDT_TRC20;
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
      paymentNetwork: paymentNetwork,
    };
  }

  /**
   * Cancel a pending charge transaction (user-initiated)
   */
  async cancelCharge(transactionId: string, userId: string): Promise<{ status: string }> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, clientId: userId, type: TransactionType.CHARGE },
    });

    if (!transaction) {
      throw new NotFoundException('Charge transaction not found');
    }

    if (transaction.status === TransactionStatus.SUCCESS) {
      throw new BadRequestException('Cannot cancel a successful charge');
    }

    if (transaction.status === TransactionStatus.CANCELLED) {
      throw new BadRequestException('Charge is already cancelled');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException(`Cannot cancel charge with status ${transaction.status}`);
    }

    transaction.status = TransactionStatus.CANCELLED;
    transaction.expiresAt = new Date();
    transaction.description = `Charge cancelled by user`;
    await this.transactionRepository.save(transaction);

    return { status: transaction.status };
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
    const expectedAmount = Number(
      transaction.expectedAmount ?? (Number(transaction.amount) + Number(transaction.platformFee || 0)),
    );
    const paymentNetwork = transaction.paymentNetwork || PaymentNetwork.USDT_TRC20;

    // Check wallet balance based on network (only check token balance, not native balance)
    let tokenBalance = 0;
    const currency = this.getCurrency(paymentNetwork);
    tokenBalance =
      paymentNetwork === PaymentNetwork.USDC_POLYGON
        ? await this.polygonWalletService.getUSDCBalance(tempWallet.address)
        : await this.walletService.getUSDTBalance(tempWallet.address);

    // If any payment is detected but is insufficient, fail once (per requirement: don't keep detecting forever)
    if (tokenBalance > 0 && tokenBalance < expectedAmount * 0.99) { // Allow 1% tolerance
      transaction.status = TransactionStatus.FAILED;
      transaction.description = `Insufficient amount. Received: ${tokenBalance.toFixed(2)} ${currency}, Expected: ${expectedAmount.toFixed(2)} ${currency}`;
      await this.transactionRepository.save(transaction);
      // Update last checked time
      await this.walletService.updateWalletLastChecked(tempWallet.id);
      return {
        success: false,
        message: transaction.description,
      };
    }

    // If amount is sufficient, process the payment (credit user balance, no automatic transfer)
    if (tokenBalance >= expectedAmount * 0.99) {
      return await this.processChargePayment(transaction);
    }

    // No payment detected yet
    await this.walletService.updateWalletLastChecked(tempWallet.id);
    return { success: false, message: 'Payment not detected yet' };
  }

  /**
   * Process charge payment: credit user balance when payment detected (no automatic transfer)
   * Admin must manually transfer funds from temp wallet to master wallet
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
      const paymentNetwork = currentTransaction.paymentNetwork || PaymentNetwork.USDT_TRC20;
      const currency = this.getCurrency(paymentNetwork);

      // Get actual balance received (for USDT TRC20, we only check USDT balance)
      let tokenBalance = 0;
      tokenBalance =
        paymentNetwork === PaymentNetwork.USDC_POLYGON
          ? await this.polygonWalletService.getUSDCBalance(tempWallet.address)
          : await this.walletService.getUSDTBalance(tempWallet.address);

      // Verify payment was received
      const expectedAmount = Number(
        currentTransaction.expectedAmount ?? (Number(currentTransaction.amount) + Number(currentTransaction.platformFee || 0)),
      );
      if (tokenBalance < expectedAmount * 0.99) { // Allow 1% tolerance
        return { success: false, message: `Insufficient payment received. Expected: ${expectedAmount.toFixed(2)} ${currency}, Received: ${tokenBalance.toFixed(2)} ${currency}` };
      }

      // Calculate amount added to balance: transferred amount - platform fee
      const amountAdded = tokenBalance - Number(currentTransaction.platformFee || 0);

      // Update transaction status to SUCCESS (no automatic transfer)
      currentTransaction.status = TransactionStatus.SUCCESS;
      currentTransaction.description = `Charge completed. Payment received: ${tokenBalance.toFixed(2)} ${currency}. Amount added to balance: ${amountAdded.toFixed(2)} ${currency} (after ${Number(currentTransaction.platformFee || 0).toFixed(2)} ${currency} platform fee). Admin transfer pending.`;
      await queryRunner.manager.save(currentTransaction);

      // Update user balance (amount = transferred from user - platform fee)
      let userBalance = await queryRunner.manager.findOne(Balance, {
        where: { userId: currentTransaction.clientId },
      });

      if (!userBalance) {
        userBalance = queryRunner.manager.create(Balance, {
          userId: currentTransaction.clientId!,
          amount: 0,
        });
      }

      // Add amount to balance: transferred amount - platform fee
      userBalance.amount = Number(userBalance.amount) + amountAdded;
      await queryRunner.manager.save(userBalance);

      // Update temp wallet total received
      tempWallet.totalReceived = Number(tempWallet.totalReceived) + Number(tokenBalance);
      tempWallet.status = TempWalletStatus.COMPLETED;
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
        `Your balance has been charged with ${amountAdded.toFixed(2)} ${currency}`,
        { transactionId: currentTransaction.id, amount: amountAdded, paymentNetwork },
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
  async withdraw(userId: string, amount: number, walletAddress: string, paymentNetwork: PaymentNetwork = PaymentNetwork.USDT_TRC20): Promise<Transaction> {
    // Validate amount
    if (amount <= this.MIN_WITHDRAW_AMOUNT) {
      const currency = this.getCurrency(paymentNetwork);
      throw new BadRequestException(`Minimum withdrawal amount is greater than ${this.MIN_WITHDRAW_AMOUNT} ${currency}`);
    }

    // Validate wallet address format based on network
    if (paymentNetwork === PaymentNetwork.USDC_POLYGON) {
      if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
        throw new BadRequestException('Invalid Polygon wallet address');
      }
    } else {
      // TRON address validation (starts with T and is 34 characters)
      if (!walletAddress || !walletAddress.startsWith('T') || walletAddress.length !== 34) {
        throw new BadRequestException('Invalid TRON wallet address');
      }
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

      const currency = this.getCurrency(paymentNetwork);

      // Create pending withdraw transaction
      const transaction = queryRunner.manager.create(Transaction, {
        clientId: userId,
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.PENDING,
        amount: amount,
        walletAddress: walletAddress,
        paymentNetwork: paymentNetwork,
        description: `Withdraw ${amount} ${currency} to ${walletAddress}`,
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

      const paymentNetwork = transaction.paymentNetwork || PaymentNetwork.USDT_TRC20;
      const currency = this.getCurrency(paymentNetwork);

      // Get master wallet and send tokens based on network
      let result: { success: boolean; transactionHash?: string; error?: string };

      if (paymentNetwork === PaymentNetwork.USDC_POLYGON) {
        const masterWallet = this.polygonWalletService.getPolygonMasterWallet();
        result = await this.polygonWalletService.sendUSDC(masterWallet.privateKey, transaction.walletAddress, transaction.amount);
      } else {
        const masterWallet = this.walletService.getMasterWallet();
        result = await this.walletService.sendUSDT(masterWallet.privateKey, transaction.walletAddress, transaction.amount);
      }

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
          `Your withdrawal of ${Number(transaction.amount).toFixed(2)} ${currency} has been processed successfully`,
          { transactionId: transaction.id, amount: transaction.amount, transactionHash: result.transactionHash, paymentNetwork },
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

