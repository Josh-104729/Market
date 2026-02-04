import { Controller, Get, UseGuards, Query, Post, Param, Body, Request } from '@nestjs/common';
import { AdminGuard } from '../admin/guards/admin.guard';
import { FraudService } from './fraud.service';

@Controller('admin/fraud')
@UseGuards(AdminGuard)
export class FraudAdminController {
  constructor(private readonly fraudService: FraudService) {}

  @Get()
  async list(
    @Query('blocked') blocked?: 'blocked' | 'unblocked' | 'all',
    @Query('pending') pending?: string,
  ) {
    const hasPendingRequest = pending === 'true' ? true : pending === 'false' ? false : undefined;
    return this.fraudService.listFraudConversations({
      blocked: blocked || 'all',
      hasPendingRequest,
    });
  }

  @Post('reactivation-requests/:id/approve')
  async approve(@Param('id') id: string, @Request() req, @Body() body: { note?: string }) {
    return this.fraudService.approveReactivationRequest(id, req.user.id, body?.note);
  }

  @Post('reactivation-requests/:id/reject')
  async reject(@Param('id') id: string, @Request() req, @Body() body: { note?: string }) {
    return this.fraudService.rejectReactivationRequest(id, req.user.id, body?.note);
  }

  @Post('conversations/:id/mark-reviewed')
  async markReviewed(@Param('id') conversationId: string, @Request() req) {
    await this.fraudService.markFraudAsReviewed(conversationId, req.user.id);
    return { success: true };
  }

  @Post('conversations/:id/block')
  async blockConversation(@Param('id') conversationId: string, @Request() req) {
    await this.fraudService.blockConversationAndMarkReviewed(conversationId, req.user.id);
    return { success: true };
  }
}


