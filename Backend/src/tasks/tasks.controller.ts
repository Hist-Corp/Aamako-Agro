import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Role, TaskStatus } from '@prisma/client';
import { IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { outranks } from '../common/rbac';

export class CreateTaskDto {
  @ApiProperty() @IsString() @MinLength(3) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsUUID() assignedToId!: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() dueDate?: string;
}

/** Roles allowed to ASSIGN tasks. Target users must be strictly below the
 *  actor's rank (outranks). */
const TASK_ASSIGNER_ROLES = [
  Role.SUPER_ADMIN,
  Role.STAFF_ADMIN,
  Role.STAFF_MANAGER,
  Role.STAFF_SALES,
];

@ApiBearerAuth()
@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private readonly INCLUDE = {
    assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    assignedBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
  };

  /** Tasks assigned to me + tasks I assigned (rank visibility enforced at creation). */
  @Roles(...TASK_ASSIGNER_ROLES, Role.CONTENT_MANAGER, Role.STAFF_SUPPORT)
  @Get()
  async list(@CurrentUser() actor?: { id: string }) {
    const [mine, assignedByMe] = await Promise.all([
      this.prisma.task.findMany({
        where: { assignedToId: actor!.id },
        include: this.INCLUDE,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.task.findMany({
        where: { assignedById: actor!.id },
        include: this.INCLUDE,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);
    return { mine, assignedByMe };
  }

  @Roles(...TASK_ASSIGNER_ROLES)
  @Post()
  async create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    const assignee = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
    if (!assignee || !assignee.isActive) {
      throw new NotFoundException('Assignee user not found or inactive');
    }
    if (assignee.id === actor!.id) {
      throw new BadRequestException('You cannot assign a task to yourself');
    }
    if (!outranks(actor!.role, assignee.role)) {
      throw new ForbiddenException(
        `A ${actor!.role} cannot assign tasks to a user with the role ${assignee.role}`,
      );
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assignedToId: dto.assignedToId,
        assignedById: actor!.id,
      },
      include: {
        assignedTo: { select: { firstName: true, lastName: true, role: true } },
        assignedBy: { select: { firstName: true, lastName: true } },
      },
    });

    void this.notifications
      .notifyRole(assignee.role, {
        type: 'TASK',
        title: 'New task assigned to you',
        message: `${task.assignedBy.firstName} assigned you a task: "${task.title}"${dto.dueDate ? ` â€” due ${new Date(dto.dueDate).toLocaleDateString()}` : ''}. See Users â†’ Tasks.`,
        actionUrl: '/users',
      })
      .catch(() => undefined);

    return { success: true, id: task.id };
  }

  /** Mark a task completed â€” the assignee (or its creator) may do this. */
  @Roles(...TASK_ASSIGNER_ROLES, Role.CONTENT_MANAGER, Role.STAFF_SUPPORT)
  @Patch(':id/complete')
  async complete(@Param('id') id: string, @CurrentUser() actor?: { id: string; role: Role }) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status === TaskStatus.COMPLETED) {
      throw new BadRequestException('Task is already completed');
    }
    if (task.assignedToId !== actor!.id && task.assignedById !== actor!.id) {
      throw new ForbiddenException('Only the assignee or the task creator can complete this task');
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
      include: {
        assignedTo: { select: { firstName: true, lastName: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    // Notify the creator when the assignee completes it.
    if (actor!.id === task.assignedToId) {
      void this.notifications
        .notifyRole(updated.assignedBy.role, {
          type: 'TASK',
          title: 'Task completed',
          message: `${updated.assignedTo.firstName} completed the task "${task.title}".`,
          actionUrl: '/users',
        })
        .catch(() => undefined);
    }

    return { success: true, status: updated.status, completedAt: updated.completedAt };
  }

  /** Users the actor may assign tasks to (strictly below their own rank). */
  @Roles(...TASK_ASSIGNER_ROLES)
  @Get('assignable')
  assignable(@CurrentUser() actor?: { id: string; role: Role }) {
    const ASSIGNABLE_ROLES = [
      Role.SUPER_ADMIN,
      Role.STAFF_ADMIN,
      Role.STAFF_MANAGER,
      Role.STAFF_SALES,
      Role.CONTENT_MANAGER,
      Role.STAFF_SUPPORT,
    ];
    return this.prisma.user.findMany({
      where: {
        role: { in: ASSIGNABLE_ROLES.filter((r) => outranks(actor!.role, r)) },
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
