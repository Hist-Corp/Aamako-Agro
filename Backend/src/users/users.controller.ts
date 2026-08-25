import { Controller, Get, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiBearerAuth()
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  me(@CurrentUser() user?: { id: string }) {
    return this.prisma.user.findUnique({
      where: { id: user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
  }

  @Roles(Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Get('wholesale-accounts')
  wholesaleAccounts() {
    return this.prisma.wholesaleAccount.findMany({
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        tier: true,
      },
    });
  }
}
