import { Body, Controller, Get, HttpCode, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  LogoutDto,
  RefreshDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';

/** Any authenticated role may manage its OWN profile (customers included). */
const ANY_AUTHENTICATED_ROLE: Role[] = [
  Role.RETAIL_CUSTOMER,
  Role.WHOLESALE_CUSTOMER,
  Role.STAFF_SALES,
  Role.CONTENT_MANAGER,
  Role.STAFF_SUPPORT,
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];


@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ) {
    return this.auth.login(dto, req.headers['user-agent'], req.ip);
  }
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, req.headers['user-agent'], req.ip);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Roles(...ANY_AUTHENTICATED_ROLE)
  @Get('me')
  me(@CurrentUser() user?: { id: string }) {
    return this.auth.getProfile(user!.id);
  }

  @ApiBearerAuth()
  @Roles(...ANY_AUTHENTICATED_ROLE)
  @Patch('me')
  updateMe(
    @CurrentUser() user?: { id: string },
    @Body() dto?: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(user!.id, dto!);
  }

  @ApiBearerAuth()
  @Roles(...ANY_AUTHENTICATED_ROLE)
  @Post('change-password')
  @HttpCode(200)
  changePassword(
    @CurrentUser() user?: { id: string },
    @Body() dto?: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user!.id, dto!);
  }
}
