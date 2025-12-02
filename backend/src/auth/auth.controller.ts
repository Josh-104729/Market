import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
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
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async signIn(@Body() dto: SignInDto) {
    return this.authService.signIn(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }
}

