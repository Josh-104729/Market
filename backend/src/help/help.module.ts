import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { HelpRequest } from '../entities/help-request.entity';
import { HelpService } from './help.service';
import { HelpController } from './help.controller';
import { AdminHelpController } from './admin-help.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HelpRequest]), StorageModule],
  controllers: [HelpController, AdminHelpController],
  providers: [HelpService],
  exports: [HelpService],
})
export class HelpModule {}


