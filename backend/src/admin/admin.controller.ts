import { Controller, Post, Body, Get, UseGuards, Request, Param, Query, Req } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AdminService } from './admin.service';
import { AdminSignInDto } from './dto/admin-signin.dto';
import { AdminGuard } from './guards/admin.guard';
import { CreateNotificationDto } from '../notification/dto/create-notification.dto';
import { PaymentNetwork, TransactionStatus, TransactionType } from '../entities/transaction.entity';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('signin')
  async signIn(@Body() dto: AdminSignInDto, @Req() req: ExpressRequest) {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                      (req.headers['x-real-ip'] as string) ||
                      req.socket?.remoteAddress ||
                      'unknown';
    const userAgent = req.headers['user-agent'];
    return this.adminService.signIn(dto, ipAddress, userAgent);
  }

  @UseGuards(AdminGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.adminService.getProfile(req.user.id);
  }

  @UseGuards(AdminGuard)
  @Get('users')
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getUsers(pageNum, limitNum, search);
  }

  @UseGuards(AdminGuard)
  @Get('withdraws')
  async getWithdraws(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getWithdraws(pageNum, limitNum);
  }

  @UseGuards(AdminGuard)
  @Get('master-wallet/transactions')
  async getMasterWalletTransactions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: TransactionType,
    @Query('status') status?: TransactionStatus,
    @Query('paymentNetwork') paymentNetwork?: PaymentNetwork,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getMasterWalletTransactions(pageNum, limitNum, type, status, paymentNetwork);
  }

  @UseGuards(AdminGuard)
  @Post('withdraws/:withdrawId/accept')
  async acceptWithdraw(@Param('withdrawId') withdrawId: string) {
    return this.adminService.acceptWithdraw(withdrawId);
  }

  @UseGuards(AdminGuard)
  @Post('notifications/broadcast')
  async broadcastNotification(@Body() dto: CreateNotificationDto) {
    return this.adminService.broadcastNotification(dto.title, dto.message, dto.metadata);
  }

  @UseGuards(AdminGuard)
  @Get('disputes')
  async getDisputes() {
    return this.adminService.getDisputes();
  }

  @UseGuards(AdminGuard)
  @Post('milestones/:id/release')
  async releaseMilestone(@Param('id') id: string, @Body() body: { amount: number }) {
    return this.adminService.releaseMilestone(id, body.amount);
  }

  @UseGuards(AdminGuard)
  @Get('temp-wallets')
  async getTempWallets() {
    return this.adminService.getTempWallets();
  }

  @UseGuards(AdminGuard)
  @Get('temp-wallets/:walletId/balances')
  async getTempWalletBalances(
    @Param('walletId') walletId: string,
    @Query('asset') asset?: 'token' | 'gas',
  ) {
    return this.adminService.getTempWalletBalances(walletId, asset);
  }

  @UseGuards(AdminGuard)
  @Post('temp-wallets/:walletId/transfer')
  async transferFromTempWallet(
    @Param('walletId') walletId: string,
    @Body() body: { amount?: number },
  ) {
    return this.adminService.transferFromTempWallet(walletId, body?.amount);
  }

  @UseGuards(AdminGuard)
  @Post('temp-wallets/:walletId/transfer-trx')
  async transferRemainingTRX(@Param('walletId') walletId: string) {
    return this.adminService.transferRemainingTRXFromTempWallet(walletId);
  }

  @UseGuards(AdminGuard)
  @Post('users/:userId/status')
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body() body: { status: 'active' | 'blocked' },
  ) {
    return this.adminService.updateUserStatus(userId, body.status);
  }

  @UseGuards(AdminGuard)
  @Get('chat-history')
  async getChatHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.adminService.getAllChatHistory(pageNum, limitNum, search);
  }

  @UseGuards(AdminGuard)
  @Get('chat-history/:conversationId/messages')
  async getConversationMessages(
    @Param('conversationId') conversationId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.adminService.getConversationMessages(conversationId, pageNum, limitNum);
  }

  @UseGuards(AdminGuard)
  @Get('login-history')
  async getLoginHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('success') success?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const successFilter = success === 'true' ? true : success === 'false' ? false : undefined;
    return this.adminService.getLoginHistory(pageNum, limitNum, userId, successFilter);
  }
}

