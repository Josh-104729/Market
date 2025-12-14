import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import {
  SignUpStep1Dto,
  SignUpStep4Dto,
  SignUpStep5Dto,
  SignUpStep6Dto,
  SignUpStep7Dto,
} from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { TwoFactorService } from './two-factor.service';
import { ReferralService } from '../referral/referral.service';

@Injectable()
export class AuthService {
  // In-memory store for phone verification codes
  // In production, consider using Redis or similar
  private phoneVerificationCodes = new Map<string, { code: string; expires: Date }>();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private smsService: SmsService,
    private twoFactorService: TwoFactorService,
    private referralService: ReferralService,
  ) {}

  async signUpStep1(dto: SignUpStep1Dto) {
    if (dto.password !== dto.repassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      emailVerified: false,
      status: 'active',
    });

    await this.userRepository.save(user);

    // Handle referral code if provided
    if (dto.referralCode && dto.referralCode.trim()) {
      try {
        const validation = await this.referralService.validateReferralCode(dto.referralCode.trim());
        if (validation.isValid && validation.referrer) {
          // Check eligibility
          const eligibility = await this.referralService.checkReferralEligibility(
            user.id,
            dto.referralCode.trim(),
          );
          if (eligibility.eligible) {
            // Create referral relationship
            await this.referralService.createReferral(
              validation.referrer.id,
              user.id,
              dto.referralCode.trim().toUpperCase(),
            );
          }
        }
      } catch (error) {
        // Log error but don't fail signup if referral fails
        console.error('Referral code processing failed:', error.message);
      }
    }

    // Generate JWT token for email verification (expires in 24 hours)
    const verificationToken = this.jwtService.sign(
      { userId: user.id, email: user.email, type: 'email_verification' },
      { expiresIn: '24h' },
    );

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    await this.emailService.sendVerificationEmail(dto.email, verificationUrl);

    return {
      message: 'Verification email sent. Please check your email.',
      userId: user.id,
    };
  }

  async verifyEmail(token: string) {
    try {
      // Verify and decode JWT token
      const payload = this.jwtService.verify(token);
      
      if (payload.type !== 'email_verification') {
        throw new BadRequestException('Invalid token type');
      }

      const user = await this.userRepository.findOne({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.emailVerified) {
        throw new BadRequestException('Email already verified');
      }

      if (user.email !== payload.email) {
        throw new BadRequestException('Email mismatch');
      }

      user.emailVerified = true;
      await this.userRepository.save(user);

      // Activate referral if user was referred
      if (user.referredBy) {
        try {
          await this.referralService.activateReferral(user.id);
        } catch (error) {
          console.error('Referral activation failed:', error.message);
        }
      }

      return {
        message: 'Email verified successfully',
        userId: user.id,
      };
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new BadRequestException('Invalid or expired verification token');
      }
      throw error;
    }
  }

  async signUpStep4(userId: string, dto: SignUpStep4Dto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.emailVerified) {
      throw new BadRequestException('Email must be verified first');
    }

    const existingUserName = await this.userRepository.findOne({
      where: { userName: dto.userName },
    });

    if (existingUserName && existingUserName.id !== userId) {
      throw new ConflictException('Username already exists');
    }

    user.userName = dto.userName;
    user.firstName = dto.firstName;
    user.lastName = dto.lastName;
    user.middleName = dto.middleName;

    await this.userRepository.save(user);

    return {
      message: 'User information saved',
      userId: user.id,
    };
  }

  async signUpStep5(userId: string, dto: SignUpStep5Dto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const address = `${dto.country}`;
    user.address = address;

    await this.userRepository.save(user);

    return {
      message: 'Address saved',
      userId: user.id,
    };
  }

  async signUpStep6(userId: string, dto: SignUpStep6Dto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingPhone = await this.userRepository.findOne({
      where: { phoneNumber: dto.phoneNumber },
    });

    if (existingPhone && existingPhone.id !== userId) {
      throw new ConflictException('Phone number already exists');
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    user.phoneNumber = dto.phoneNumber;
    user.phoneVerified = false;

    await this.userRepository.save(user);

    // Store verification code in memory (key: userId)
    this.phoneVerificationCodes.set(userId, { code: verificationCode, expires: expiresAt });

    // Send SMS verification code
    await this.smsService.sendVerificationCode(dto.phoneNumber, verificationCode);

    return {
      message: 'Verification code sent to your phone',
      userId: user.id,
    };
  }

  async signUpStep7(userId: string, dto: SignUpStep7Dto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get verification code from memory
    const storedCode = this.phoneVerificationCodes.get(userId);

    if (!storedCode) {
      throw new BadRequestException('No verification code found. Please request a new one.');
    }

    if (new Date() > storedCode.expires) {
      this.phoneVerificationCodes.delete(userId);
      throw new BadRequestException('Verification code expired. Please request a new one.');
    }

    if (storedCode.code !== dto.verificationCode) {
      throw new BadRequestException('Invalid verification code');
    }

    // Code is valid, remove it from memory and verify phone
    this.phoneVerificationCodes.delete(userId);
    user.phoneVerified = true;

    await this.userRepository.save(user);

    // Generate JWT token
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Phone verified successfully. Registration complete!',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async signIn(dto: SignInDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // If 2FA is enabled, return a temporary token instead of access token
    if (user.twoFactorEnabled) {
      // Generate temporary token for 2FA verification (expires in 5 minutes)
      const tempToken = this.jwtService.sign(
        { 
          sub: user.id, 
          email: user.email,
          type: '2fa_verification',
          requires2FA: true 
        },
        { expiresIn: '5m' }
      );

      return {
        requires2FA: true,
        tempToken,
        method: user.twoFactorMethod,
        message: '2FA verification required',
      };
    }

    // Normal login flow
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async verifyTwoFactorLogin(tempToken: string, code: string) {
    try {
      // Verify temporary token
      const payload = this.jwtService.verify(tempToken);
      
      if (payload.type !== '2fa_verification' || !payload.requires2FA) {
        throw new BadRequestException('Invalid token');
      }

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.twoFactorEnabled) {
        throw new BadRequestException('2FA not enabled');
      }

      // Verify 2FA code using TwoFactorService
      const isValid = await this.twoFactorService.verifyTotpCode(user.id, code);

      if (!isValid) {
        throw new UnauthorizedException('Invalid 2FA code');
      }

      // Generate final access token
      const accessToken = this.jwtService.sign({
        sub: user.id,
        email: user.email,
      });

      return {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          userName: user.userName,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      };
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new BadRequestException('Invalid or expired token');
      }
      throw error;
    }
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      userName: user.userName,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      bio: user.bio,
      avatar: user.avatar,
      address: user.address,
      phoneNumber: user.phoneNumber,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorMethod: user.twoFactorMethod,
      status: user.status,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if userName is being updated and if it's already taken
    if (dto.userName && dto.userName !== user.userName) {
      const existingUserName = await this.userRepository.findOne({
        where: { userName: dto.userName },
      });

      if (existingUserName && existingUserName.id !== userId) {
        throw new ConflictException('Username already exists');
      }
    }

    // Check if phoneNumber is being updated and if it's already taken
    if (dto.phoneNumber && dto.phoneNumber !== user.phoneNumber) {
      const existingPhone = await this.userRepository.findOne({
        where: { phoneNumber: dto.phoneNumber },
      });

      if (existingPhone && existingPhone.id !== userId) {
        throw new ConflictException('Phone number already exists');
      }
      // Reset phone verification if phone number changes
      user.phoneVerified = false;
    }

    // Update fields
    if (dto.userName !== undefined) user.userName = dto.userName;
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.middleName !== undefined) user.middleName = dto.middleName;
    if (dto.bio !== undefined) user.bio = dto.bio;
    if (dto.address !== undefined) user.address = dto.address;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber;

    await this.userRepository.save(user);

    return this.getProfile(userId);
  }
}

