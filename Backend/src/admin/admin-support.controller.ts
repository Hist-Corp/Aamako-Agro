import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, Role, TicketPriority, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';

const STAFF_SUPPORT_ROLES: Role[] = [Role.STAFF_SUPPORT, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN];

@ApiBearerAuth()
@ApiTags('admin/support')
@Controller('admin/support')
export class AdminSupportController {
  constructor(private prisma: PrismaService) {}

  /** Ticket list. Filters: ?status=&priority=&category=&search=&page=&limit= */
  @Roles(...STAFF_SUPPORT_ROLES)
  @Get('tickets')
  async list(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '100',
  ) {
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 100));
    const cur = Math.max(1, parseInt(page, 10) || 1);

    const where: Prisma.SupportTicketWhereInput = {};
    if (status) where.status = status as TicketStatus;
    if (priority) where.priority = priority as TicketPriority;
    if (category) where.category = category;
    if (search) {
      const q = search.trim();
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total, staff] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (cur - 1) * take,
        take,
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 }, assignedTo: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.supportTicket.count({ where }),
      this.prisma.user.findMany({ where: { role: { in: [Role.STAFF_SUPPORT, Role.STAFF_MANAGER] } }, select: { id: true, firstName: true, lastName: true } }),
    ]);

    const nameOf = (u: { firstName: string; lastName: string | null } | null) =>
      u ? [u.firstName, u.lastName].filter(Boolean).join(' ') : 'Unassigned';

    return {
      data: rows.map((t) => ({
        id: t.id,
        subject: t.subject,
        customerName: t.customerName,
        customerEmail: t.customerEmail,
        category: t.category,
        status: t.status,
        priority: t.priority,
        assignedTo: nameOf(t.assignedTo),
        lastMessage: t.messages[0]?.body ?? 'Ticket created',
        messageCount: 1,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        resolvedAt: t.resolvedAt?.toISOString(),
      })),
      total,
      page: cur,
      limit: take,
      totalPages: Math.max(1, Math.ceil(total / take)),
      agents: staff.map(nameOf),
    };
  }

  @Roles(...STAFF_SUPPORT_ROLES)
  @Get('tickets/:id')
  async detail(@Param('id') id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } }, assignedTo: { select: { firstName: true, lastName: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return {
      ...ticket,
      assignedTo: ticket.assignedTo ? [ticket.assignedTo.firstName, ticket.assignedTo.lastName].filter(Boolean).join(' ') : 'Unassigned',
      lastMessage: ticket.messages[ticket.messages.length - 1]?.body ?? 'Ticket created',
      messageCount: ticket.messages.length,
    };
  }

  @Roles(...STAFF_SUPPORT_ROLES)
  @Post('tickets')
  async create(@Body() body: { subject?: string; customerName?: string; customerEmail?: string; category?: string; priority?: string; message?: string }) {
    if (!body.subject?.trim()) throw new BadRequestException('subject is required');
    if (!body.customerName?.trim()) throw new BadRequestException('customerName is required');
    const priority = (body.priority ?? 'MEDIUM') as TicketPriority;
    if (!['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) throw new BadRequestException('invalid priority');
    return this.prisma.supportTicket.create({
      data: {
        subject: body.subject.trim(),
        customerName: body.customerName.trim(),
        customerEmail: body.customerEmail?.trim() || 'unknown@aamako.agro',
        category: body.category?.trim() || 'General Inquiry',
        priority,
        messages: { create: { authorName: body.customerName.trim(), body: body.message?.trim() || 'Ticket created' } },
      },
    });
  }

  /** Update status / priority / assignee / append a note (as a message). */
  @Roles(...STAFF_SUPPORT_ROLES)
  @Patch('tickets/:id')
  async update(@Param('id') id: string, @Body() body: { status?: string; priority?: string; assignedTo?: string; message?: string }) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const data: Prisma.SupportTicketUpdateInput = {};
    if (body.status) {
      if (!['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'].includes(body.status)) {
        throw new BadRequestException('invalid status');
      }
      data.status = body.status as TicketStatus;
      if (body.status === 'RESOLVED' || body.status === 'CLOSED') data.resolvedAt = new Date();
    }
    if (body.priority) {
      if (!['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(body.priority)) throw new BadRequestException('invalid priority');
      data.priority = body.priority as TicketPriority;
    }
    if (body.assignedTo && body.assignedTo !== 'Unassigned') {
      // Resolve the display name back to a staff account (first + last name).
      const parts = body.assignedTo.trim().split(/\s+/);
      const match = await this.prisma.user.findFirst({
        where: {
          role: { in: [Role.STAFF_SUPPORT, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN] },
          OR: [
            { firstName: body.assignedTo.trim() },
            { AND: [{ firstName: parts[0] }, ...(parts[1] ? [{ lastName: parts.slice(1).join(' ') }] : [])] },
          ],
        },
      });
      if (match) data.assignedTo = { connect: { id: match.id } };
    }
    if (body.message?.trim()) {
      data.messages = { create: { authorName: 'Support', body: body.message.trim() } };
    }

    return this.prisma.supportTicket.update({ where: { id }, data });
  }
}
