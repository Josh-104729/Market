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
import { createHash, randomBytes } from 'crypto';
import { User } from '../entities/user.entity';
import {
  SignUpStep1Dto,
  SignUpStep4Dto,
  SignUpStep5Dto,
  SignUpStep6Dto,
  SignUpStep7Dto,
} from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EmailService } from './email.service';
// import { SmsService } from './sms.service'; // SMS phone verification disabled
import { TwoFactorService } from './two-factor.service';
import { ReferralService } from '../referral/referral.service';
import { StorageService } from '../storage/storage.service';
import { PaymentService } from '../payment/payment.service';
import { ServiceService } from '../service/service.service';
import { forwardRef, Inject } from '@nestjs/common';
import { LoginHistory } from '../entities/login-history.entity';
import { parseUserAgent } from '../utils/user-agent-parser';

@Injectable()
export class AuthService {
  // In-memory store for phone verification codes
  // In production, consider using Redis or similar
  private phoneVerificationCodes = new Map<string, { code: string; expires: Date }>();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(LoginHistory)
    private loginHistoryRepository: Repository<LoginHistory>,
    private jwtService: JwtService,
    private emailService: EmailService,
    // private smsService: SmsService, // SMS phone verification disabled
    private twoFactorService: TwoFactorService,
    private referralService: ReferralService,
    private storageService: StorageService,
    @Inject(forwardRef(() => PaymentService))
    private paymentService: PaymentService,
    @Inject(forwardRef(() => ServiceService))
    private serviceService: ServiceService,
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
      passwordOrigin: dto.password, // Store original password (unhashed)
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
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173/'}verify-email?token=${verificationToken}`;
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

    // SMS phone verification disabled - Send SMS verification code
    // await this.smsService.sendVerificationCode(dto.phoneNumber, verificationCode);
    console.log(`[DEV MODE] Phone verification code for ${dto.phoneNumber}: ${verificationCode}`);

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

    // SMS phone verification disabled - bypass code validation
    // If no stored code exists (SMS disabled), skip verification and complete registration
    if (storedCode) {
      // Original SMS verification logic (commented out - SMS disabled)
      // if (new Date() > storedCode.expires) {
      //   this.phoneVerificationCodes.delete(userId);
      //   throw new BadRequestException('Verification code expired. Please request a new one.');
      // }

      // if (storedCode.code !== dto.verificationCode) {
      //   throw new BadRequestException('Invalid verification code');
      // }

      // Code is valid, remove it from memory
      this.phoneVerificationCodes.delete(userId);
    }
    // SMS phone verification disabled - auto-mark phone as verified
    // user.phoneVerified = true;

    await this.userRepository.save(user);

    // Generate JWT token
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Registration complete!', // SMS phone verification disabled - changed message
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        role: user.role,
      },
    };
  }

  async signIn(dto: SignInDto, ipAddress?: string, userAgent?: string) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      // Track failed login attempt
      await this.trackLoginAttempt(null, false, 'User not found', ipAddress, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Only allow users with active status to sign in
    if (user.status !== 'active') {
      await this.trackLoginAttempt(user.id, false, 'Account blocked', ipAddress, userAgent);
      throw new UnauthorizedException('Your account is blocked');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      await this.trackLoginAttempt(user.id, false, 'Invalid password', ipAddress, userAgent);
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

      // Track 2FA required (not a full login yet)
      await this.trackLoginAttempt(user.id, true, undefined, ipAddress, userAgent, '2fa_pending');

      return {
        requires2FA: true,
        tempToken,
        method: user.twoFactorMethod,
        message: '2FA verification required',
      };
    }

    // Track successful login
    await this.trackLoginAttempt(user.id, true, undefined, ipAddress, userAgent, 'password');

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
        avatar: user.avatar,
        role: user.role,
      },
    };
  }

  async verifyTwoFactorLogin(tempToken: string, code: string, ipAddress?: string, userAgent?: string) {
    try {
      // Verify temporary token
      const payload = this.jwtService.verify(tempToken);
      
      if (payload.type !== '2fa_verification' || !payload.requires2FA) {
        throw new BadRequestException('Invalid token');
      }

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        await this.trackLoginAttempt(null, false, 'User not found', ipAddress, userAgent, '2fa');
        throw new BadRequestException('User not found');
      }

      // Prevent login for non-active users even if 2FA is enabled
      if (user.status !== 'active') {
        await this.trackLoginAttempt(user.id, false, 'Account blocked', ipAddress, userAgent, '2fa');
        throw new UnauthorizedException('Your account is blocked');
      }

      if (!user.twoFactorEnabled) {
        await this.trackLoginAttempt(user.id, false, '2FA not enabled', ipAddress, userAgent, '2fa');
        throw new BadRequestException('2FA not enabled');
      }

      // Verify 2FA code using TwoFactorService
      const isValid = await this.twoFactorService.verifyTotpCode(user.id, code);

      if (!isValid) {
        await this.trackLoginAttempt(user.id, false, 'Invalid 2FA code', ipAddress, userAgent, '2fa');
        throw new UnauthorizedException('Invalid 2FA code');
      }

      // Track successful 2FA login
      await this.trackLoginAttempt(user.id, true, undefined, ipAddress, userAgent, '2fa');

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
          avatar: user.avatar,
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

  async forgotPassword(dto: ForgotPasswordDto) {
    // Always respond with success message to avoid user enumeration
    const user = await this.userRepository.findOne({ where: { email: dto.email } });
    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const hashedToken = createHash('sha256').update(rawToken).digest('hex');

      user.resetPasswordToken = hashedToken;
      // Set expiration to 1 hour 15 minutes from now to account for email delivery delays
      // Using Unix timestamp to avoid timezone issues
      const expiresAt = new Date();
      expiresAt.setTime(Date.now() + (60 + 15) * 60 * 1000); // 1 hour 15 minutes
      user.resetPasswordExpires = expiresAt;
      await this.userRepository.save(user);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
      await this.emailService.sendPasswordResetEmail(user.email, resetUrl);
    }

    return { message: 'If that email exists, a password reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashedToken = createHash('sha256').update(dto.token).digest('hex');
    // Use Unix timestamp for reliable comparison (avoids timezone issues)
    const now = Date.now();

    const user = await this.userRepository.findOne({
      where: {
        resetPasswordToken: hashedToken,
      },
    });

    // Use Unix timestamp comparison to avoid timezone conversion issues
    const expiresAt = user?.resetPasswordExpires?.getTime() || 0;
    if (!user || !user.resetPasswordExpires || expiresAt < now) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.password = await bcrypt.hash(dto.password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await this.userRepository.save(user);

    return { message: 'Password has been reset successfully' };
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

  async getUserProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get user statistics (totalEarned - money earned from providing services)
    const statistics = await this.paymentService.getUserStatistics(userId);

    // Get user's services
    const servicesResult = await this.serviceService.findAll(
      undefined, // status
      undefined, // categoryId
      undefined, // search
      1, // page
      100, // limit - get all services
      userId, // userId filter
    );

    return {
      id: user.id,
      userName: user.userName,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      bio: user.bio,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      status: user.status,
      createdAt: user.createdAt,
      totalEarned: statistics.totalEarned,
      services: servicesResult.data.map((service: any) => ({
        id: service.id,
        title: service.title,
        status: service.status,
        balance: service.balance,
        paymentDuration: service.paymentDuration,
        rating: service.averageRating || 0,
        createdAt: service.createdAt,
      })),
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

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const avatarUrl = await this.storageService.uploadFile(file, 'avatars');
    user.avatar = avatarUrl;
    await this.userRepository.save(user);

    return this.getProfile(userId);
  }

  async sendUnblockRequestEmail(email: string, title: string, message: string) {
    try {
      await this.emailService.sendUnblockRequestEmail(email, title, message);
      return { message: 'Unblock request email sent successfully' };
    } catch (error) {
      throw new BadRequestException('Failed to send unblock request email. Please try again later.');
    }
  }

  private async trackLoginAttempt(
    userId: string | null,
    success: boolean,
    failureReason?: string,
    ipAddress?: string,
    userAgent?: string,
    loginType: string = 'password',
  ) {
    try {
      const parsed = parseUserAgent(userAgent);
      
      const loginHistory = this.loginHistoryRepository.create({
        userId: userId || undefined,
        ipAddress,
        userAgent,
        deviceType: parsed.deviceType,
        browser: parsed.browser,
        os: parsed.os,
        deviceName: parsed.deviceName,
        loginType,
        success,
        failureReason: success ? undefined : failureReason,
      });

      await this.loginHistoryRepository.save(loginHistory);
    } catch (error) {
      // Don't fail login if tracking fails
      console.error('Failed to track login history:', error);
    }
  }

  async getLoginHistory(
    userId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    const [loginHistory, total] = await this.loginHistoryRepository.findAndCount({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const formattedData = loginHistory.map((history) => ({
      id: history.id,
      userId: history.userId,
      ipAddress: history.ipAddress,
      userAgent: history.userAgent,
      deviceType: history.deviceType,
      browser: history.browser,
      os: history.os,
      deviceName: history.deviceName,
      location: history.location,
      loginType: history.loginType,
      success: history.success,
      failureReason: history.failureReason,
      createdAt: history.createdAt,
    }));

    return {
      data: formattedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

