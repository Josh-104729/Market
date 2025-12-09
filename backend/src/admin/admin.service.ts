import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { TempWallet, TempWalletStatus } from '../entities/temp-wallet.entity';
import { Balance } from '../entities/balance.entity';
import { AdminSignInDto } from './dto/admin-signin.dto';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(TempWallet)
    private tempWalletRepository: Repository<TempWallet>,
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
    private jwtService: JwtService,
    private walletService: WalletService,
    private dataSource: DataSource,
  ) {}

  async signIn(dto: AdminSignInDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is an admin
    if (user.role !== 'admin') {
      throw new UnauthorizedException('Access denied. Admin privileges required.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

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

  async getTempWallets() {
    const wallets = await this.tempWalletRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    // Get real-time USDT and TRX balances from blockchain for each wallet
    const walletsWithBalance = await Promise.all(
      wallets.map(async (wallet) => {
        try {
          // Fetch real balances from blockchain
          const [usdtBalance, trxBalance] = await Promise.all([
            this.walletService.getUSDTBalance(wallet.address),
            this.walletService.getTRXBalance(wallet.address),
          ]);

          return {
            id: wallet.id,
            userId: wallet.userId,
            user: wallet.user ? {
              id: wallet.user.id,
              email: wallet.user.email,
              userName: wallet.user.userName,
              firstName: wallet.user.firstName,
              lastName: wallet.user.lastName,
            } : null,
            address: wallet.address,
            status: wallet.status,
            totalReceived: Number(wallet.totalReceived || 0),
            usdtBalance: Number(usdtBalance) || 0, // Real-time blockchain balance
            trxBalance: Number(trxBalance) || 0, // Real-time blockchain balance
            lastCheckedAt: wallet.lastCheckedAt,
            createdAt: wallet.createdAt,
            updatedAt: wallet.updatedAt,
          };
        } catch (error) {
          console.error(`Error getting real-time balance for wallet ${wallet.address}:`, error);
          // Return wallet with 0 balances if blockchain query fails
          return {
            id: wallet.id,
            userId: wallet.userId,
            user: wallet.user ? {
              id: wallet.user.id,
              email: wallet.user.email,
              userName: wallet.user.userName,
              firstName: wallet.user.firstName,
              lastName: wallet.user.lastName,
            } : null,
            address: wallet.address,
            status: wallet.status,
            totalReceived: Number(wallet.totalReceived || 0),
            usdtBalance: 0,
            trxBalance: 0,
            lastCheckedAt: wallet.lastCheckedAt,
            createdAt: wallet.createdAt,
            updatedAt: wallet.updatedAt,
          };
        }
      })
    );

    return walletsWithBalance;
  }

  async transferFromTempWallet(walletId: string): Promise<{
    amountTransferred: number;
    usdtTxHash: string;
    trxTxHash?: string;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get temp wallet
      const tempWallet = await queryRunner.manager.findOne(TempWallet, {
        where: { id: walletId },
        relations: ['user'],
      });

      if (!tempWallet) {
        throw new NotFoundException('Temp wallet not found');
      }

      // Transfer from temp wallet to master wallet
      // This will transfer USDT if available, or just TRX if no USDT
      const transferResult = await this.walletService.transferFromTempToMaster(walletId);

      // Only update user balance if USDT was transferred
      if (transferResult.usdtAmount > 0) {
        // Get or create user balance
        let userBalance = await queryRunner.manager.findOne(Balance, {
          where: { userId: tempWallet.userId },
        });

        if (!userBalance) {
          userBalance = queryRunner.manager.create(Balance, {
            userId: tempWallet.userId,
            amount: 0,
          });
          userBalance = await queryRunner.manager.save(userBalance);
        }

        // Add transferred amount to user's balance
        userBalance.amount = Number(userBalance.amount) + transferResult.usdtAmount;
        await queryRunner.manager.save(userBalance);
      }

      // Update temp wallet status to COMPLETED
      tempWallet.status = TempWalletStatus.COMPLETED;
      await queryRunner.manager.save(tempWallet);

      await queryRunner.commitTransaction();

      return {
        amountTransferred: transferResult.usdtAmount,
        usdtTxHash: transferResult.usdtTxHash,
        trxTxHash: transferResult.trxTxHash,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Error transferring from temp wallet:', error);
      throw new BadRequestException(
        `Failed to transfer from temp wallet: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      await queryRunner.release();
    }
  }

}

