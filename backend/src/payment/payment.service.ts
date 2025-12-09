import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Balance } from '../entities/balance.entity';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { User } from '../entities/user.entity';
import { ChargeDto } from './dto/charge.dto';
import { InitiateChargeDto } from './dto/initiate-charge.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { ChatGateway } from '../chat/chat.gateway';
import { Milestone } from '../entities/milestone.entity';
import { Conversation } from '../entities/conversation.entity';
import { WalletService } from '../wallet/wallet.service';
import { TempWallet } from '../entities/temp-wallet.entity';

@Injectable()
export class PaymentService {
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
    @InjectRepository(TempWallet)
    private tempWalletRepository: Repository<TempWallet>,
    private dataSource: DataSource,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
  ) {}

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

  async initiateCharge(userId: string, initiateChargeDto: InitiateChargeDto): Promise<{
    walletAddress: string;
    amount: number;
    platformFee: number;
    total: number;
    transactionId: string;
    expiresAt: Date;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create a new temp wallet for each charge
      const tempWallet = await this.walletService.createTempWallet(userId);

      // Calculate fees
      const platformFee = 3; // $3 USDT fixed
      const total = Number(initiateChargeDto.amount) + platformFee;

      // Set expiration (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Create pending transaction
      const transaction = queryRunner.manager.create(Transaction, {
        clientId: userId,
        type: TransactionType.CHARGE,
        status: TransactionStatus.PENDING,
        amount: initiateChargeDto.amount,
        expectedAmount: initiateChargeDto.amount,
        platformFee: platformFee,
        tempWalletId: tempWallet.id,
        expiresAt: expiresAt,
        description: `Charge ${initiateChargeDto.amount} USDT`,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        walletAddress: tempWallet.address,
        amount: initiateChargeDto.amount,
        platformFee: platformFee,
        total: total,
        transactionId: savedTransaction.id,
        expiresAt: expiresAt,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getChargeStatus(transactionId: string, userId: string): Promise<{
    status: string;
    transactionHash?: string;
    confirmedAt?: Date;
  }> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, clientId: userId, type: TransactionType.CHARGE },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return {
      status: transaction.status,
      transactionHash: transaction.transactionHash,
      confirmedAt: transaction.status === TransactionStatus.SUCCESS ? transaction.updatedAt : undefined,
    };
  }

  async getChargeByWalletAddress(walletAddress: string, userId: string): Promise<{
    walletAddress: string;
    amount: number;
    platformFee: number;
    total: number;
    transactionId: string;
    expiresAt: Date;
    status: string;
    transactionHash?: string;
  }> {
    // Find the temp wallet by address
    const tempWallet = await this.tempWalletRepository.findOne({
      where: { address: walletAddress },
    });
    
    if (!tempWallet) {
      throw new NotFoundException('Wallet address not found');
    }

    // Verify the wallet belongs to the user
    if (tempWallet.userId !== userId) {
      throw new NotFoundException('Wallet address not found');
    }

    // Find the most recent pending or successful charge transaction for this wallet
    const transaction = await this.transactionRepository.findOne({
      where: {
        clientId: userId,
        type: TransactionType.CHARGE,
        tempWalletId: tempWallet.id,
      },
      order: { createdAt: 'DESC' },
    });

    if (!transaction) {
      throw new NotFoundException('Charge transaction not found');
    }

    const platformFee = Number(transaction.platformFee || 0);
    const amount = Number(transaction.amount);
    const total = amount + platformFee;

    return {
      walletAddress: tempWallet.address,
      amount: amount,
      platformFee: platformFee,
      total: total,
      transactionId: transaction.id,
      expiresAt: transaction.expiresAt || new Date(),
      status: transaction.status,
      transactionHash: transaction.transactionHash || undefined,
    };
  }

  async charge(userId: string, chargeDto: ChargeDto): Promise<Transaction> {
    // Legacy method - kept for backward compatibility
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if transaction hash already exists
      const existingTransaction = await queryRunner.manager.findOne(Transaction, {
        where: { transactionHash: chargeDto.transactionHash },
      });

      if (existingTransaction) {
        throw new BadRequestException('Transaction hash already exists');
      }

      // Get or create balance
      let balance = await queryRunner.manager.findOne(Balance, {
        where: { userId },
      });

      if (!balance) {
        balance = queryRunner.manager.create(Balance, {
          userId,
          amount: 0,
        });
        balance = await queryRunner.manager.save(balance);
      }

      // Create transaction
      // For charge, the user is the client (charging their own account)
      const transaction = queryRunner.manager.create(Transaction, {
        clientId: userId,
        type: TransactionType.CHARGE,
        status: TransactionStatus.PENDING,
        amount: chargeDto.amount,
        transactionHash: chargeDto.transactionHash,
        description: `Charge ${chargeDto.amount} USDT`,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // Update balance
      balance.amount = Number(balance.amount) + Number(chargeDto.amount);
      await queryRunner.manager.save(balance);

      // Update transaction status to success
      savedTransaction.status = TransactionStatus.SUCCESS;
      await queryRunner.manager.save(savedTransaction);

      await queryRunner.commitTransaction();

      return savedTransaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async withdraw(userId: string, withdrawDto: WithdrawDto): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get balance
      const balance = await queryRunner.manager.findOne(Balance, {
        where: { userId },
      });

      // Validate amount doesn't exceed balance
      if (!balance || Number(balance.amount) < Number(withdrawDto.amount)) {
        throw new BadRequestException(`Insufficient balance. Available: ${Number(balance?.amount || 0).toFixed(2)} USDT`);
      }

      // Validate minimum amount
      if (Number(withdrawDto.amount) < 0.01) {
        throw new BadRequestException('Minimum withdrawal amount is 0.01 USDT');
      }

      // Validate wallet address format (TRC20 address)
      const trc20AddressRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
      if (!trc20AddressRegex.test(withdrawDto.walletAddress.trim())) {
        throw new BadRequestException('Invalid TRC20 wallet address');
      }

      // Create pending withdrawal transaction (don't deduct balance yet)
      // Balance will be deducted when admin accepts the withdrawal
      const transaction = queryRunner.manager.create(Transaction, {
        clientId: userId,
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.PENDING,
        amount: withdrawDto.amount,
        walletAddress: withdrawDto.walletAddress.trim(),
        description: `Withdraw ${withdrawDto.amount} USDT to ${withdrawDto.walletAddress.trim()}`,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return savedTransaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getWithdrawStatus(transactionId: string, userId: string): Promise<{
    status: string;
    transactionHash?: string;
    confirmedAt?: Date;
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
      confirmedAt: transaction.status === TransactionStatus.SUCCESS ? transaction.updatedAt : undefined,
    };
  }

  async getTransactions(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Transaction[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [transactions, total] = await this.transactionRepository.findAndCount({
      where: [
        { clientId: userId },
        { providerId: userId },
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

      // Update transaction status to SUCCESS
      transaction.status = TransactionStatus.SUCCESS;
      transaction.description = `Milestone payment received`;
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

      // Update provider balance
      providerBalance.amount = Number(providerBalance.amount) + Number(transaction.amount);
      await queryRunner.manager.save(providerBalance);

      await queryRunner.commitTransaction();

      // Load transaction with relations for WebSocket emission
      const transactionWithRelations = await this.transactionRepository.findOne({
        where: { id: transaction.id },
        relations: ['client', 'provider', 'milestone'],
      });

      // Get conversationId from milestone to emit WebSocket event
      if (transactionWithRelations?.milestone) {
        const conversation = await this.conversationRepository.findOne({
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
}

