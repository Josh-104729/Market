import { Controller, Post, Body, Get, UseGuards, Request, Param } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminSignInDto } from './dto/admin-signin.dto';
import { AdminGuard } from './guards/admin.guard';
import { CreateNotificationDto } from '../notification/dto/create-notification.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('signin')
  async signIn(@Body() dto: AdminSignInDto) {
    return this.adminService.signIn(dto);
  }

  @UseGuards(AdminGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.adminService.getProfile(req.user.id);
  }

  @UseGuards(AdminGuard)
  @Get('withdraws')
  async getWithdraws() {
    return this.adminService.getWithdraws();
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
  @Post('temp-wallets/:walletId/transfer')
  async transferFromTempWallet(@Param('walletId') walletId: string) {
    return this.adminService.transferFromTempWallet(walletId);
  }
}

