import { Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/guards/admin.guard';
import { HelpService } from './help.service';

@Controller('admin/help')
@UseGuards(AdminGuard)
export class AdminHelpController {
  constructor(private readonly helpService: HelpService) {}

  @Get()
  async list() {
    return this.helpService.adminFindAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.helpService.adminFindOne(id);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Request() req) {
    return this.helpService.approve(id, req.user.id);
  }
}


