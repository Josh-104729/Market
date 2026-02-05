import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Service, ServiceStatus } from './entities/service.entity';
import { Milestone } from './entities/milestone.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Milestone)
    private milestoneRepository: Repository<Milestone>,
  ) {}

  getHello(): string {
    return 'OmniMart API is running!';
  }

  async getStatistics() {
    // Active users: users with status = 'active' (not deleted)
    const activeUsers = await this.userRepository.count({
      where: { status: 'active' },
    });

    // Listings: active services (not deleted)
    const listings = await this.serviceRepository.count({
      where: { status: ServiceStatus.ACTIVE },
    });

    // Verified sellers: users with emailVerified or phoneVerified = true and status = 'active'
    // Use query builder to avoid double-counting users with both verified
    const verifiedSellersResult = await this.userRepository
      .createQueryBuilder('user')
      .where('user.status = :status', { status: 'active' })
      .andWhere('(user.emailVerified = :true OR user.phoneVerified = :true)', { true: true })
      .getCount();
    
    const verifiedSellers = verifiedSellersResult;

    // Satisfaction: average rating from milestones (where rating is not null)
    const ratingResult = await this.milestoneRepository
      .createQueryBuilder('milestone')
      .select('AVG(milestone.rating)', 'average')
      .where('milestone.rating IS NOT NULL')
      .andWhere('milestone.deletedAt IS NULL')
      .getRawOne();

    const averageRating = ratingResult?.average 
      ? parseFloat(ratingResult.average) 
      : 0;
    
    // Convert to percentage (assuming 5-star rating system)
    const satisfaction = averageRating > 0 
      ? Math.round((averageRating / 5) * 100) 
      : 0;

    return {
      activeUsers,
      listings,
      verifiedSellers,
      satisfaction,
    };
  }
}

