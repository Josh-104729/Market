import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  UseGuards,
  Request,
  Req,
  Param,
  Query,
  ParseUUIDPipe,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthService } from './auth.service';
import {
  SignUpStep1Dto,
  SignUpStep4Dto,
  SignUpStep5Dto,
  SignUpStep6Dto,
  SignUpStep7Dto,
} from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TwoFactorService } from './two-factor.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import {
  EnableTwoFactorDto,
  VerifyTwoFactorSetupDto,
  DisableTwoFactorDto,
  RegenerateBackupCodesDto,
} from './dto/two-factor.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Post('signup/step1')
  async signUpStep1(@Body() dto: SignUpStep1Dto) {
    return this.authService.signUpStep1(dto);
  }

  @Post('verify-email')
  async verifyEmailPost(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Get('verify-email')
  async verifyEmailGet(@Query('token') token: string) {
    // Handle token from query params
    return this.authService.verifyEmail(token);
  }

  @Post('signup/step4/:userId')
  async signUpStep4(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SignUpStep4Dto,
  ) {
    return this.authService.signUpStep4(userId, dto);
  }

  @Post('signup/step5/:userId')
  async signUpStep5(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SignUpStep5Dto,
  ) {
    return this.authService.signUpStep5(userId, dto);
  }

  @Post('signup/step6/:userId')
  async signUpStep6(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SignUpStep6Dto,
  ) {
    return this.authService.signUpStep6(userId, dto);
  }

  @Post('signup/step7/:userId')
  async signUpStep7(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SignUpStep7Dto,
  ) {
    return this.authService.signUpStep7(userId, dto);
  }

  @Post('signin')
  async signIn(@Body() dto: SignInDto, @Req() req: ExpressRequest) {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                      (req.headers['x-real-ip'] as string) || 
                      req.socket?.remoteAddress || 
                      'unknown';
    const userAgent = req.headers['user-agent'] || undefined;
    return this.authService.signIn(dto, ipAddress, userAgent);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('verify-2fa')
  async verifyTwoFactorLogin(@Body() dto: { tempToken: string; code: string }, @Req() req: ExpressRequest) {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                      (req.headers['x-real-ip'] as string) || 
                      req.socket?.remoteAddress || 
                      'unknown';
    const userAgent = req.headers['user-agent'] || undefined;
    return this.authService.verifyTwoFactorLogin(dto.tempToken, dto.code, ipAddress, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @Get('profile/:userId')
  async getUserProfile(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.authService.getUserProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  async enableTwoFactor(@Request() req, @Body() dto: EnableTwoFactorDto) {
    if (dto.method === 'totp') {
      const result = await this.twoFactorService.generateTotpSecret(
        req.user.id,
        req.user.email,
      );
      return result;
    }
    throw new BadRequestException('Invalid 2FA method');
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/verify-setup')
  async verifyTwoFactorSetup(
    @Request() req,
    @Body() dto: VerifyTwoFactorSetupDto,
  ) {
    const result = await this.twoFactorService.verifyTotpSetup(
      req.user.id,
      dto.code,
    );
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  async disableTwoFactor(@Request() req, @Body() dto: DisableTwoFactorDto) {
    await this.twoFactorService.disableTwoFactor(req.user.id, dto.password);
    return { message: '2FA disabled successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/regenerate-backup-codes')
  async regenerateBackupCodes(
    @Request() req,
    @Body() dto: RegenerateBackupCodesDto,
  ) {
    const codes = await this.twoFactorService.regenerateBackupCodes(
      req.user.id,
      dto.password,
    );
    return { backupCodes: codes };
  }

  @UseGuards(JwtAuthGuard)
  @Get('2fa/status')
  async getTwoFactorStatus(@Request() req) {
    const user = await this.authService.getProfile(req.user.id);
    return {
      enabled: user.twoFactorEnabled || false,
      method: user.twoFactorMethod || null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(new Error('Only image files (JPG, PNG, GIF, WEBP) are allowed!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async updateAvatar(
    @Request() req,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.authService.updateAvatar(req.user.id, file);
  }

  @Post('unblock-request')
  async sendUnblockRequest(@Body() dto: { email: string; title: string; message: string }) {
    return this.authService.sendUnblockRequestEmail(dto.email, dto.title, dto.message);
  }

  @UseGuards(JwtAuthGuard)
  @Get('login-history')
  async getLoginHistory(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.authService.getLoginHistory(req.user.id, pageNum, limitNum);
  }

  @UseGuards(JwtAuthGuard)
  @Post('accept-terms')
  async acceptTerms(@Request() req) {
    return this.authService.acceptTerms(req.user.id);
  }
}

