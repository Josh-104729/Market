import { Controller, Get, Post, Body, UseGuards, Request, Query, Param, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ChargeDto } from './dto/charge.dto';
import { InitiateChargeDto } from './dto/initiate-charge.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('balance')
  async getBalance(@Request() req) {
    return this.paymentService.getBalance(req.user.id);
  }

  @Post('charge/initiate')
  async initiateCharge(@Request() req, @Body() initiateChargeDto: InitiateChargeDto) {
    return this.paymentService.initiateCharge(req.user.id, initiateChargeDto);
  }

  @Get('charge/status/:transactionId')
  async getChargeStatus(@Request() req, @Param('transactionId') transactionId: string) {
    return this.paymentService.getChargeStatus(transactionId, req.user.id);
  }

  @Get('charge/wallet/:walletAddress')
  async getChargeByWalletAddress(@Request() req, @Param('walletAddress') walletAddress: string) {
    return this.paymentService.getChargeByWalletAddress(walletAddress, req.user.id);
  }

  @Post('charge')
  async charge(@Request() req, @Body() chargeDto: ChargeDto) {
    return this.paymentService.charge(req.user.id, chargeDto);
  }

  @Post('withdraw')
  async withdraw(@Request() req, @Body() withdrawDto: WithdrawDto) {
    return this.paymentService.withdraw(req.user.id, withdrawDto);
  }

  @Get('withdraw/status/:transactionId')
  async getWithdrawStatus(@Request() req, @Param('transactionId') transactionId: string) {
    return this.paymentService.getWithdrawStatus(transactionId, req.user.id);
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
}

