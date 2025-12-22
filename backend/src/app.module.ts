import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { CategoryModule } from './category/category.module';
import { ServiceModule } from './service/service.module';
import { ConversationModule } from './conversation/conversation.module';
import { MessageModule } from './message/message.module';
import { MilestoneModule } from './milestone/milestone.module';
import { ChatModule } from './chat/chat.module';
import { BlogModule } from './blog/blog.module';
import { User } from './entities/user.entity';
import { Category } from './entities/category.entity';
import { Service } from './entities/service.entity';
import { Tag } from './entities/tag.entity';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { Milestone } from './entities/milestone.entity';
import { Post } from './entities/post.entity';
import { PostLike } from './entities/post-like.entity';
import { PostComment } from './entities/post-comment.entity';
import { PostCommentLike } from './entities/post-comment-like.entity';
import { Balance } from './entities/balance.entity';
import { Transaction } from './entities/transaction.entity';
import { TempWallet } from './entities/temp-wallet.entity';
import { Notification } from './entities/notification.entity';
import { PaymentModule } from './payment/payment.module';
import { WalletModule } from './wallet/wallet.module';
import { NotificationModule } from './notification/notification.module';
import { ReferralModule } from './referral/referral.module';
import { Referral } from './entities/referral.entity';
import { ReferralReward } from './entities/referral-reward.entity';
import { HelpModule } from './help/help.module';
import { HelpRequest } from './entities/help-request.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', '127.0.0.1'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', 'Csh104729!'),
        database: configService.get<string>('DB_DATABASE', 'market'),
        entities: [User, Category, Service, Tag, Conversation, Message, Milestone, Post, PostLike, PostComment, PostCommentLike, Balance, Transaction, TempWallet, Notification, Referral, ReferralReward, HelpRequest],
        synchronize: configService.get<boolean>('DB_SYNCHRONIZE', true), // Set to false in production
        logging: configService.get<boolean>('DB_LOGGING', false),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    AdminModule,
    CategoryModule,
    ServiceModule,
    ConversationModule,
    MessageModule,
    MilestoneModule,
    ChatModule,
    BlogModule,
    PaymentModule,
    WalletModule,
    NotificationModule,
    ReferralModule,
    HelpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

