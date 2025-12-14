import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Referral, ReferralStatus } from '../entities/referral.entity';
import { ReferralReward, RewardType, RewardStatus } from '../entities/referral-reward.entity';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { Balance } from '../entities/balance.entity';

@Injectable()
export class ReferralService {
  private readonly CODE_LENGTH = 10;
  private readonly SIGNUP_REWARD_AMOUNT = parseFloat(process.env.REFERRAL_SIGNUP_REWARD_AMOUNT || '0');
  private readonly PURCHASE_REWARD_PERCENTAGE = parseFloat(process.env.REFERRAL_PURCHASE_REWARD_PERCENTAGE || '5');
  private readonly PURCHASE_REWARD_FIXED = parseFloat(process.env.REFERRAL_PURCHASE_REWARD_FIXED || '0');
  private readonly SIGNUP_REWARD_ENABLED = process.env.REFERRAL_SIGNUP_REWARD_ENABLED === 'true';
  private readonly PURCHASE_REWARD_ENABLED = process.env.REFERRAL_PURCHASE_REWARD_ENABLED !== 'false';

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Referral)
    private referralRepository: Repository<Referral>,
    @InjectRepository(ReferralReward)
    private rewardRepository: Repository<ReferralReward>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
    private dataSource: DataSource,
  ) {}

  /**
   * Generate unique referral code for user
   */
  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If user already has a referral code, return it
    if (user.referralCode) {
      return user.referralCode;
    }

    let code: string;
    let exists = true;
    let attempts = 0;
    const maxAttempts = 100;

    // Generate unique code
    while (exists && attempts < maxAttempts) {
      if (user.userName) {
        // Use username + random suffix
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        code = (user.userName.substring(0, 6) + randomSuffix).toUpperCase().padEnd(this.CODE_LENGTH, '0').substring(0, this.CODE_LENGTH);
      } else {
        // Use userId hash + random
        const userIdHash = userId.substring(0, 6).replace(/-/g, '').toUpperCase();
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        code = (userIdHash + randomSuffix).substring(0, this.CODE_LENGTH);
      }

      const existing = await this.userRepository.findOne({ where: { referralCode: code } });
      exists = !!existing;
      attempts++;
    }

    if (exists) {
      // Fallback: fully random code
      code = Math.random().toString(36).substring(2, 2 + this.CODE_LENGTH).toUpperCase();
    }

    // Save code to user
    user.referralCode = code;
    user.referralCodeCreatedAt = new Date();
    await this.userRepository.save(user);

    return code;
  }

  /**
   * Validate referral code and get referrer info
   */
  async validateReferralCode(code: string): Promise<{ isValid: boolean; referrer?: any; message?: string }> {
    if (!code || code.length < 8 || code.length > 12) {
      return { isValid: false, message: 'Invalid referral code format' };
    }

    const normalizedCode = code.toUpperCase().trim();
    const referrer = await this.userRepository.findOne({
      where: { referralCode: normalizedCode },
      select: ['id', 'userName', 'firstName', 'lastName', 'avatar', 'status'],
    });

    if (!referrer) {
      return { isValid: false, message: 'Referral code not found' };
    }

    if (referrer.status !== 'active') {
      return { isValid: false, message: 'Referrer account is not active' };
    }

    return {
      isValid: true,
      referrer: {
        id: referrer.id,
        userName: referrer.userName,
        firstName: referrer.firstName,
        lastName: referrer.lastName,
        avatar: referrer.avatar,
      },
    };
  }

  /**
   * Check if user can use referral code (not self-referral, not already referred)
   */
  async checkReferralEligibility(userId: string, code: string): Promise<{ eligible: boolean; message?: string }> {
    const validation = await this.validateReferralCode(code);
    if (!validation.isValid) {
      return { eligible: false, message: validation.message };
    }

    // Check self-referral
    if (validation.referrer?.id === userId) {
      return { eligible: false, message: 'You cannot use your own referral code' };
    }

    // Check if user is already referred
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'referredBy'],
    });

    if (user?.referredBy) {
      return { eligible: false, message: 'You have already been referred' };
    }

    return { eligible: true };
  }

  /**
   * Create referral relationship
   */
  async createReferral(referrerId: string, referredUserId: string, code: string): Promise<Referral> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check eligibility
      const eligibility = await this.checkReferralEligibility(referredUserId, code);
      if (!eligibility.eligible) {
        throw new BadRequestException(eligibility.message);
      }

      // Check if referral already exists
      const existing = await this.referralRepository.findOne({
        where: { referredUserId },
      });

      if (existing) {
        throw new ConflictException('User has already been referred');
      }

      // Create referral
      const referral = this.referralRepository.create({
        referrerId,
        referredUserId,
        referralCodeUsed: code.toUpperCase(),
        status: ReferralStatus.PENDING,
        referredAt: new Date(),
      });

      const savedReferral = await queryRunner.manager.save(referral);

      // Update user's referred_by field
      await queryRunner.manager.update(User, referredUserId, {
        referredBy: referrerId,
      });

      await queryRunner.commitTransaction();
      return savedReferral;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Activate referral (when user verifies email)
   */
  async activateReferral(referredUserId: string): Promise<void> {
    const referral = await this.referralRepository.findOne({
      where: { referredUserId },
    });

    if (!referral) {
      return; // No referral, nothing to activate
    }

    if (referral.status === ReferralStatus.ACTIVE || referral.status === ReferralStatus.COMPLETED) {
      return; // Already activated or completed
    }

    referral.status = ReferralStatus.ACTIVE;
    referral.activatedAt = new Date();
    await this.referralRepository.save(referral);

    // Process signup reward if enabled
    if (this.SIGNUP_REWARD_ENABLED && this.SIGNUP_REWARD_AMOUNT > 0) {
      await this.processSignupReward(referral.id);
    }
  }

  /**
   * Process signup reward
   */
  async processSignupReward(referralId: string): Promise<ReferralReward> {
    const referral = await this.referralRepository.findOne({
      where: { id: referralId },
      relations: ['referrer', 'referredUser'],
    });

    if (!referral) {
      throw new NotFoundException('Referral not found');
    }

    // Check if reward already exists
    const existingReward = await this.rewardRepository.findOne({
      where: {
        referralId,
        rewardType: RewardType.SIGNUP_BONUS,
        status: RewardStatus.PROCESSED,
      },
    });

    if (existingReward) {
      return existingReward; // Already processed
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create reward record
      const reward = this.rewardRepository.create({
        referralId: referral.id,
        referrerId: referral.referrerId,
        referredUserId: referral.referredUserId,
        rewardType: RewardType.SIGNUP_BONUS,
        amount: this.SIGNUP_REWARD_AMOUNT,
        currency: 'USDT',
        status: RewardStatus.PENDING,
        description: `Signup bonus for referring ${referral.referredUser.userName || referral.referredUser.email}`,
      });

      const savedReward = await queryRunner.manager.save(reward);

      // Process the reward (add to balance)
      await this.distributeReward(savedReward.id);

      await queryRunner.commitTransaction();
      return savedReward;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Process purchase reward (when referred user makes first purchase)
   */
  async processPurchaseReward(referredUserId: string, purchaseAmount: number): Promise<ReferralReward | null> {
    if (!this.PURCHASE_REWARD_ENABLED) {
      return null;
    }

    const referral = await this.referralRepository.findOne({
      where: { referredUserId },
      relations: ['referrer', 'referredUser'],
    });

    if (!referral) {
      return null; // No referral, no reward
    }

    // Check if already completed (first purchase reward already given)
    if (referral.status === ReferralStatus.COMPLETED) {
      return null; // Already completed
    }

    // Check if reward already exists
    const existingReward = await this.rewardRepository.findOne({
      where: {
        referralId: referral.id,
        rewardType: RewardType.FIRST_PURCHASE,
        status: RewardStatus.PROCESSED,
      },
    });

    if (existingReward) {
      return existingReward; // Already processed
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Calculate reward amount
      let rewardAmount = 0;
      if (this.PURCHASE_REWARD_FIXED > 0) {
        rewardAmount = this.PURCHASE_REWARD_FIXED;
      } else if (this.PURCHASE_REWARD_PERCENTAGE > 0) {
        rewardAmount = (purchaseAmount * this.PURCHASE_REWARD_PERCENTAGE) / 100;
      }

      if (rewardAmount <= 0) {
        await queryRunner.rollbackTransaction();
        return null;
      }

      // Create reward record
      const reward = this.rewardRepository.create({
        referralId: referral.id,
        referrerId: referral.referrerId,
        referredUserId: referral.referredUserId,
        rewardType: RewardType.FIRST_PURCHASE,
        amount: rewardAmount,
        currency: 'USDT',
        status: RewardStatus.PENDING,
        description: `First purchase reward: ${purchaseAmount} USDT purchase by ${referral.referredUser.userName || referral.referredUser.email}`,
      });

      const savedReward = await queryRunner.manager.save(reward);

      // Update referral status to completed
      referral.status = ReferralStatus.COMPLETED;
      referral.completedAt = new Date();
      await queryRunner.manager.save(referral);

      // Update referrer's total referrals count
      await queryRunner.manager.increment(User, { id: referral.referrerId }, 'totalReferrals', 1);

      // Process the reward
      await this.distributeReward(savedReward.id);

      await queryRunner.commitTransaction();
      return savedReward;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Distribute reward to referrer's balance
   */
  async distributeReward(rewardId: string): Promise<void> {
    const reward = await this.rewardRepository.findOne({
      where: { id: rewardId },
      relations: ['referrer'],
    });

    if (!reward) {
      throw new NotFoundException('Reward not found');
    }

    if (reward.status === RewardStatus.PROCESSED) {
      return; // Already processed
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get or create balance
      let balance = await this.balanceRepository.findOne({
        where: { userId: reward.referrerId },
      });

      if (!balance) {
        balance = this.balanceRepository.create({
          userId: reward.referrerId,
          amount: 0,
        });
      }

      // Add reward to balance
      balance.amount = parseFloat(balance.amount.toString()) + reward.amount;
      await queryRunner.manager.save(balance);

      // Create transaction record
      const transaction = this.transactionRepository.create({
        clientId: reward.referrerId,
        type: TransactionType.CHARGE,
        status: TransactionStatus.SUCCESS,
        amount: reward.amount,
        description: reward.description || `Referral reward: ${reward.rewardType}`,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // Update reward
      reward.status = RewardStatus.PROCESSED;
      reward.processedAt = new Date();
      reward.transactionId = savedTransaction.id;
      await queryRunner.manager.save(reward);

      // Update user's total referral earnings
      await queryRunner.manager.increment(
        User,
        { id: reward.referrerId },
        'totalReferralEarnings',
        reward.amount,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      reward.status = RewardStatus.FAILED;
      await this.rewardRepository.save(reward);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get user's referral code
   */
  async getReferralCode(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'referralCode'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate if doesn't exist
    if (!user.referralCode) {
      return await this.generateReferralCode(userId);
    }

    return user.referralCode;
  }

  /**
   * Get referral statistics
   */
  async getReferralStats(userId: string) {
    const [totalReferrals, activeReferrals, completedReferrals, pendingReferrals] = await Promise.all([
      this.referralRepository.count({ where: { referrerId: userId } }),
      this.referralRepository.count({ where: { referrerId: userId, status: ReferralStatus.ACTIVE } }),
      this.referralRepository.count({ where: { referrerId: userId, status: ReferralStatus.COMPLETED } }),
      this.referralRepository.count({ where: { referrerId: userId, status: ReferralStatus.PENDING } }),
    ]);

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['totalReferralEarnings', 'referralCode'],
    });

    // Calculate pending earnings
    const pendingRewards = await this.rewardRepository
      .createQueryBuilder('reward')
      .select('SUM(reward.amount)', 'total')
      .where('reward.referrerId = :userId', { userId })
      .andWhere('reward.status = :status', { status: RewardStatus.PENDING })
      .getRawOne();

    const pendingEarnings = parseFloat(pendingRewards?.total || '0');

    return {
      totalReferrals,
      activeReferrals,
      completedReferrals,
      pendingReferrals,
      totalEarnings: parseFloat(user?.totalReferralEarnings?.toString() || '0'),
      pendingEarnings,
      referralCode: user?.referralCode || await this.getReferralCode(userId),
    };
  }

  /**
   * Get user's referrals list
   */
  async getUserReferrals(userId: string, status?: ReferralStatus, page: number = 1, limit: number = 10) {
    const query = this.referralRepository
      .createQueryBuilder('referral')
      .leftJoinAndSelect('referral.referredUser', 'referredUser')
      .where('referral.referrerId = :userId', { userId })
      .orderBy('referral.referredAt', 'DESC');

    if (status) {
      query.andWhere('referral.status = :status', { status });
    }

    const [referrals, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Calculate earnings per referral
    const referralsWithEarnings = await Promise.all(
      referrals.map(async (referral) => {
        const earnings = await this.rewardRepository
          .createQueryBuilder('reward')
          .select('SUM(reward.amount)', 'total')
          .where('reward.referralId = :referralId', { referralId: referral.id })
          .andWhere('reward.status = :status', { status: RewardStatus.PROCESSED })
          .getRawOne();

        return {
          id: referral.id,
          referredUser: {
            id: referral.referredUser.id,
            userName: referral.referredUser.userName,
            firstName: referral.referredUser.firstName,
            lastName: referral.referredUser.lastName,
            avatar: referral.referredUser.avatar,
            email: referral.referredUser.email,
          },
          status: referral.status,
          referredAt: referral.referredAt,
          activatedAt: referral.activatedAt,
          completedAt: referral.completedAt,
          earnings: parseFloat(earnings?.total || '0'),
        };
      }),
    );

    return {
      referrals: referralsWithEarnings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get reward history
   */
  async getRewardHistory(userId: string, status?: RewardStatus, page: number = 1, limit: number = 10) {
    const query = this.rewardRepository
      .createQueryBuilder('reward')
      .leftJoinAndSelect('reward.referredUser', 'referredUser')
      .where('reward.referrerId = :userId', { userId })
      .orderBy('reward.createdAt', 'DESC');

    if (status) {
      query.andWhere('reward.status = :status', { status });
    }

    const [rewards, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      rewards: rewards.map((reward) => ({
        id: reward.id,
        amount: reward.amount,
        currency: reward.currency,
        rewardType: reward.rewardType,
        status: reward.status,
        processedAt: reward.processedAt,
        description: reward.description,
        referredUser: {
          id: reward.referredUser.id,
          userName: reward.referredUser.userName,
          firstName: reward.referredUser.firstName,
          lastName: reward.referredUser.lastName,
        },
        createdAt: reward.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

