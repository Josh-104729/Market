import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'Csh104729!',
      database: 'market',
      entities: [User, Category, Service, Tag, Conversation, Message, Milestone, Post, PostLike, PostComment, PostCommentLike],
      synchronize: true, // Set to false in production
      logging: true,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

