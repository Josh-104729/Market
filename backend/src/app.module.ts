import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { CategoryModule } from './category/category.module';
import { ServiceModule } from './service/service.module';
import { User } from './entities/user.entity';
import { Category } from './entities/category.entity';
import { Service } from './entities/service.entity';
import { Tag } from './entities/tag.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'Csh104729!',
      database: 'market',
      entities: [User, Category, Service, Tag],
      synchronize: true, // Set to false in production
      logging: true,
    }),
    AuthModule,
    AdminModule,
    CategoryModule,
    ServiceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

