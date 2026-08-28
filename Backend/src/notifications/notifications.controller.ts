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

/** Every role that can sign in to the Admin Dashboard â€” notifications are
 *  accessible to all of them. Each user only ever sees rows addressed to
 *  them individually, and fan-outs are targeted per role, so a user only
 *  receives notifications aligned with their role. */
const DASHBOARD_ROLES = [
  Role.SUPER_ADMIN,
  Role.STAFF_ADMIN,
  Role.STAFF_MANAGER,
  Role.STAFF_SALES,
  Role.CONTENT_MANAGER,
  Role.STAFF_SUPPORT,
];

@ApiBearerAuth()
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Roles(...DASHBOARD_ROLES)
  @Get()
  list(@Req() req: { user?: { id: string } }) {
    return this.notifications.list(req.user!.id);
  }

  @Roles(...DASHBOARD_ROLES)
  @Patch('read-all')
  async readAll(@Req() req: { user?: { id: string } }) {
    return this.notifications.markAllRead(req.user!.id);
  }

  @Roles(...DASHBOARD_ROLES)
  @Patch(':id/read')
  async read(@Param('id') id: string, @Req() req: { user?: { id: string } }) {
    return this.notifications.markRead(id, req.user!.id);
  }
}

