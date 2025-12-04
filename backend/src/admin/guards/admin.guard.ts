import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Injectable()
export class AdminGuard extends JwtAuthGuard {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }

    if (user.role !== 'admin') {
      throw new UnauthorizedException('Access denied. Admin privileges required.');
    }

    return user;
  }
}

