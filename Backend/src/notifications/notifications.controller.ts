import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

const STAFF_ROLES = [
  Role.CONTENT_MANAGER,
  Role.STAFF_SUPPORT,
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];

@ApiBearerAuth()
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Roles(...STAFF_ROLES)
  @Get()
  list(@Req() req: { user?: { id: string } }) {
    return this.notifications.list(req.user!.id);
  }

  @Roles(...STAFF_ROLES)
  @Patch('read-all')
  async readAll(@Req() req: { user?: { id: string } }) {
    return this.notifications.markAllRead(req.user!.id);
  }

  @Roles(...STAFF_ROLES)
  @Patch(':id/read')
  async read(@Param('id') id: string, @Req() req: { user?: { id: string } }) {
    return this.notifications.markRead(id, req.user!.id);
  }
}
