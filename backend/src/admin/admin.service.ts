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
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { TempWallet, WalletNetwork } from '../entities/temp-wallet.entity';
import { AdminSignInDto } from './dto/admin-signin.dto';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';
import { ConversationService } from '../conversation/conversation.service';
import { MilestoneService } from '../milestone/milestone.service';
import { MilestoneStatus } from '../entities/milestone.entity';
import { WalletService } from '../wallet/wallet.service';
import { PolygonWalletService } from '../wallet/polygon-wallet.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(TempWallet)
    private tempWalletRepository: Repository<TempWallet>,
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
    @Inject(forwardRef(() => PolygonWalletService))
    private polygonWalletService: PolygonWalletService,
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

  async getWithdraws() {
    const withdraws = await this.transactionRepository.find({
      where: { type: TransactionType.WITHDRAW },
      relations: ['client'],
      order: { createdAt: 'DESC' },
    });

    return withdraws;
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

    // Get balances for each wallet
    const walletsWithBalances = await Promise.all(
      wallets.map(async (wallet) => {
        let usdtBalance = 0;
        let usdcBalance = 0;
        let maticBalance = 0;

        if (wallet.network === WalletNetwork.TRON) {
          usdtBalance = await this.walletService.getUSDTBalance(wallet.address);
        } else if (wallet.network === WalletNetwork.POLYGON) {
          usdcBalance = await this.polygonWalletService.getUSDCBalance(wallet.address);
          maticBalance = await this.polygonWalletService.getMATICBalance(wallet.address);
        }

        return {
          ...wallet,
          totalReceived: Number(wallet.totalReceived || 0),
          usdtBalance: wallet.network === WalletNetwork.TRON ? usdtBalance : 0,
          usdcBalance: wallet.network === WalletNetwork.POLYGON ? usdcBalance : 0,
          maticBalance: wallet.network === WalletNetwork.POLYGON ? maticBalance : 0,
        };
      })
    );

    return walletsWithBalances;
  }

  async transferFromTempWallet(walletId: string) {
    const tempWallet = await this.tempWalletRepository.findOne({
      where: { id: walletId },
    });

    if (!tempWallet) {
      throw new NotFoundException('Temp wallet not found');
    }

    // Get balance before transfer
    let amountTransferred = 0;
    if (tempWallet.network === WalletNetwork.TRON) {
      amountTransferred = await this.walletService.getUSDTBalance(tempWallet.address);
    } else if (tempWallet.network === WalletNetwork.POLYGON) {
      amountTransferred = await this.polygonWalletService.getUSDCBalance(tempWallet.address);
    } else {
      throw new BadRequestException('Unsupported wallet network');
    }

    if (amountTransferred <= 0) {
      throw new BadRequestException('No funds to transfer');
    }

    let transferResult: { success: boolean; usdtTxHash?: string; usdcTxHash?: string; maticTxHash?: string; error?: string };

    if (tempWallet.network === WalletNetwork.TRON) {
      // Transfer USDT from temp wallet to master wallet (GasFree)
      transferResult = await this.walletService.transferFromTempWalletToMaster(tempWallet);
    } else if (tempWallet.network === WalletNetwork.POLYGON) {
      // Transfer USDC from temp wallet to master wallet
      transferResult = await this.polygonWalletService.transferFromTempWalletToMaster(tempWallet);
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
      amountTransferred: amountTransferred,
    };
  }
}

