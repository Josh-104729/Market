import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';

@Injectable()
export class AdminInitService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    await this.initializeAdmin();
  }

  private async initializeAdmin() {
    const adminEmail = 'admin@market.com';
    const adminPassword = '12345678';

    const existingAdmin = await this.userRepository.findOne({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      // Update password if admin exists
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
      }
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      existingAdmin.password = hashedPassword;
      await this.userRepository.save(existingAdmin);
      console.log('Admin user updated');
      return;
    }

    // Create new admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = this.userRepository.create({
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      emailVerified: true,
      phoneVerified: true,
      status: 'active',
      firstName: 'Admin',
      lastName: 'User',
    });

    await this.userRepository.save(admin);
    console.log('Admin user created with email: admin@market.com');
  }
}

