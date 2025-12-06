import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConnectWalletDto } from './dto/connect-wallet.dto';
import { UpdateTransactionHashDto } from './dto/update-transaction-hash.dto';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('connect')
  async connectWallet(@Request() req, @Body() connectWalletDto: ConnectWalletDto) {
    return this.walletService.connectWallet(req.user.id, connectWalletDto.walletAddress);
  }

  @Get('me')
  async getMyWallet(@Request() req) {
    const wallet = await this.walletService.getUserWallet(req.user.id);
    if (!wallet) {
      return null;
    }

    // Get balance - don't fail if balance fetch fails
    let balance: number | null = null;
    try {
      balance = await this.walletService.getWalletBalance(wallet.walletAddress);
    } catch (error) {
      // Log error but don't fail the request
      console.error('Failed to fetch wallet balance:', error);
    }

    return {
      ...wallet,
      balance: balance !== null ? balance : undefined,
    };
  }

  @Get('balance/:address')
  async getBalance(@Param('address') address: string, @Request() req) {
    // Optional: verify user has access to this address
    const balance = await this.walletService.getWalletBalance(address);
    return { address, balance };
  }

  @Get('transactions')
  async getMyTransactions(@Request() req) {
    return this.walletService.getUserTransactions(req.user.id);
  }

  @Get('transactions/milestone/:milestoneId')
  async getMilestoneTransactions(@Param('milestoneId') milestoneId: string) {
    return this.walletService.getMilestoneTransactions(milestoneId);
  }

  @Patch('transactions/:id/hash')
  async updateTransactionHash(
    @Param('id') id: string,
    @Body() updateHashDto: UpdateTransactionHashDto,
  ) {
    return this.walletService.updateTransactionWithHash(id, updateHashDto.txHash);
  }
}

