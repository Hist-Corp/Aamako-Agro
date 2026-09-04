import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { TicketPriority } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

const SUPPORT_ROLES = [Role.STAFF_SUPPORT, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN];

class CreateTicketDto {
  @IsString() @MinLength(2) subject!: string;
  @IsString() @MinLength(2) customerName!: string;
  @IsOptional() @IsString() customerEmail?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']) priority?: string;
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsString() assignedTo?: string;
}

class UpdateTicketDto {
  @IsOptional() @IsIn(['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED']) status?: string;
  @IsOptional() @IsString() assignedTo?: string;
  @IsOptional() @IsString() message?: string;
}

/** Maps a ticket row (with its messages) onto the support page shape. */
function mapTicket(t: any) {
  return {
    id: t.id,
    subject: t.subject,
    customerName: t.customerName,
    customerEmail: t.customerEmail,
    category: t.category,
    status: t.status,
    priority: t.priority,
    assignedTo: t.assignedToName ?? (t.assignedToId ? 'Unassigned' : 'Unassigned'),
    lastMessage: t.messages?.length ? t.messages[t.messages.length - 1].body : '',
    messageCount: t.messages?.length ?? 0,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    resolvedAt: t.resolvedAt?.toISOString(),
  };
}

@ApiBearerAuth()
@ApiTags('admin/support')
@Controller('admin/support/tickets')
export class AdminSupportController {
  constructor(private prisma: PrismaService) {}

  @Roles(...SUPPORT_ROLES)
  @Get()
  async list() {
    // Map assigned staff ids to display names.
    const tickets = await this.prisma.supportTicket.findMany({
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    const agentIds: string[] = [...new Set(tickets.map((t) => t.assignedToId).filter((x) => !!x))] as string[];
    const agents = await this.prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const agentMap = new Map(agents.map((a) => [a.id, [a.firstName, a.lastName].filter(Boolean).join(' ') || a.email]));

    return tickets.map((t) => {
      const mapped = mapTicket(t);
      mapped.assignedTo = t.assignedToId ? (agentMap.get(t.assignedToId) ?? 'Unassigned') : 'Unassigned';
      return mapped;
    });
  }

  @Roles(...SUPPORT_ROLES)
  @Post()
  async create(@Body() dto: CreateTicketDto) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        subject: dto.subject,
        customerName: dto.customerName,
        customerEmail: dto.customerEmail ?? '',
        category: dto.category ?? 'General Inquiry',
        priority: (dto.priority ?? 'MEDIUM') as TicketPriority,
        assignedToId: dto.assignedTo || null,
        messages:
          dto.message
            ? { create: { authorName: dto.customerName, body: dto.message } }
            : undefined,
      },
      include: { messages: true },
    });
    return mapTicket(ticket);
  }

  @Roles(...SUPPORT_ROLES)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    const existing = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ticket not found');

    const data: Record<string, unknown> = {};
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === 'RESOLVED') data.resolvedAt = new Date();
    }
    if (dto.assignedTo) data.assignedToId = dto.assignedTo;

    let ticket = await this.prisma.supportTicket.update({
      where: { id },
      data,
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (dto.message) {
      // Append a support reply as a message.
      const agent = await this.prisma.user.findUnique({
        where: { id: dto.assignedTo ?? existing.assignedToId ?? '' },
        select: { firstName: true, lastName: true, email: true },
      });
      await this.prisma.supportMessage.create({
        data: {
          ticketId: id,
          authorName: agent ? [agent.firstName, agent.lastName].filter(Boolean).join(' ') || agent.email : 'Support Agent',
          body: dto.message,
        },
      });
      const refreshed = await this.prisma.supportTicket.findUnique({
        where: { id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      if (!refreshed) throw new NotFoundException('Ticket not found');
      ticket = refreshed;
    }

    return mapTicket({ ...ticket, assignedToName: undefined });
  }
}