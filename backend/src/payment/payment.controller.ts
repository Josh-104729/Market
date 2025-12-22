import { Controller, Get, Post, Patch, Body, UseGuards, Request, Query, Param, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InitiateChargeDto } from './dto/initiate-charge.dto';
import { WithdrawDto } from './dto/withdraw.dto';

@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('balance')
  async getBalance(@Request() req) {
    return this.paymentService.getBalance(req.user.id);
  }

  @Get('transactions')
  async getTransactions(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.paymentService.getTransactions(req.user.id, page, limit);
  }

  @Post('accept-payment/:transactionId')
  async acceptPayment(@Request() req, @Param('transactionId') transactionId: string) {
    return this.paymentService.acceptPayment(transactionId, req.user.id);
  }

  @Get('pending-payment/milestone/:milestoneId')
  async getPendingPayment(@Request() req, @Param('milestoneId') milestoneId: string) {
    return this.paymentService.getPendingPaymentByMilestone(milestoneId, req.user.id);
  }

  @Get('successful-payment/milestone/:milestoneId')
  async getSuccessfulPayment(@Request() req, @Param('milestoneId') milestoneId: string) {
    return this.paymentService.getSuccessfulPaymentByMilestone(milestoneId, req.user.id);
  }

  // Charge endpoints
  @Post('charge/initiate')
  async initiateCharge(@Request() req, @Body() dto: InitiateChargeDto) {
    return this.paymentService.initiateCharge(req.user.id, dto.amount, dto.paymentNetwork);
  }

  @Get('charge/status/:transactionId')
  async getChargeStatus(@Request() req, @Param('transactionId') transactionId: string) {
    return this.paymentService.getChargeStatus(transactionId, req.user.id);
  }

  @Get('charge/wallet/:walletAddress')
  async getChargeByWalletAddress(@Request() req, @Param('walletAddress') walletAddress: string) {
    return this.paymentService.getChargeByWalletAddress(walletAddress, req.user.id);
  }

  @Patch('charge/cancel/:transactionId')
  async cancelCharge(@Request() req, @Param('transactionId') transactionId: string) {
    return this.paymentService.cancelCharge(transactionId, req.user.id);
  }

  // Withdraw endpoints
  @Post('withdraw')
  async withdraw(@Request() req, @Body() dto: WithdrawDto) {
    return this.paymentService.withdraw(req.user.id, dto.amount, dto.walletAddress, dto.paymentNetwork);
  }

  @Get('withdraw/status/:transactionId')
  async getWithdrawStatus(@Request() req, @Param('transactionId') transactionId: string) {
    return this.paymentService.getWithdrawStatus(transactionId, req.user.id);
  }
}

