import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetReferralsQueryDto } from './dto/referral-list.dto';
import { GetRewardsQueryDto } from './dto/referral-reward.dto';

@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('validate')
  async validateCode(@Query('code') code: string) {
    if (!code) {
      return { isValid: false, message: 'Referral code is required' };
    }
    const result = await this.referralService.validateReferralCode(code);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-code')
  async getMyCode(@Request() req) {
    const code = await this.referralService.getReferralCode(req.user.userId);
    return { referralCode: code };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-stats')
  async getMyStats(@Request() req) {
    return await this.referralService.getReferralStats(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-referrals')
  async getMyReferrals(@Request() req, @Query() query: GetReferralsQueryDto) {
    return await this.referralService.getUserReferrals(
      req.user.userId,
      query.status,
      query.page,
      query.limit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('rewards')
  async getRewards(@Request() req, @Query() query: GetRewardsQueryDto) {
    return await this.referralService.getRewardHistory(
      req.user.userId,
      query.status,
      query.page,
      query.limit,
    );
  }
}

