import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LiveEventsService } from '../common/live-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportTicketDto } from './dto/support.dto';

interface OptionalCustomer {
  id: string;
  email: string;
  role: string;
}

/**
 * Customer-facing support tickets.
 *
 * The storefront support widget posts here; tickets land in the same
 * support_tickets table the staff dashboard's Customer Support screen
 * (/support) reads, and STAFF_SUPPORT / STAFF_MANAGER are notified in-app.
 */
@Injectable()
export class SupportService {
  private logger = new Logger('SupportService');

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private events: LiveEventsService,
  ) {}

  /** Create a ticket from the storefront widget (public endpoint). */
  async createTicket(dto: CreateSupportTicketDto, user?: OptionalCustomer) {
    const customerName = dto.name.trim();
    const customerEmail = (user?.email || dto.email).trim().toLowerCase();
    const firstMessage = dto.message?.trim() || 'Ticket created';

    const ticket = await this.prisma.supportTicket.create({
      data: {
        subject: dto.subject.trim(),
        customerName,
        customerEmail,
        category: dto.category?.trim() || 'General Inquiry',
        priority: dto.priority ?? 'MEDIUM',
        // If the visitor is a signed-in customer, keep their account id on the
        // message so support can trace it back to the user account.
        messages: {
          create: { authorName: customerName, body: firstMessage },
        },
      },
    });

    // Fire-and-forget: never fail the request because a notification hiccuped.
    this.notifyStaff(ticket.id).catch((err) =>
      this.logger.warn(`Staff notification failed for ${ticket.id}: ${err.message}`),
    );

    return {
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      customerName: ticket.customerName,
      customerEmail: ticket.customerEmail,
      createdAt: ticket.createdAt.toISOString(),
      message:
        'Ticket received. Our customer support team has been notified — keep the ticket reference to track progress.',
    };
  }

  /** Customer-side ticket tracking by reference id (public endpoint). */
  async ticketStatus(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found — check the reference');

    return {
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      priority: ticket.priority,
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      messages: ticket.messages.map((m) => ({
        authorName: m.authorName,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  /** Notify support staff (dashboard bell) and push onto the live feed. */
  private async notifyStaff(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return;

    await this.notifications.notifyRoles(['STAFF_SUPPORT', 'STAFF_MANAGER'], {
      type: 'SUPPORT',
      title: 'New support ticket',
      message: `${ticket.customerName}: ${ticket.subject}`,
      actionUrl: '/support',
    });

    this.events.emit('support:ticket', {
      id: ticket.id,
      subject: ticket.subject,
      customerName: ticket.customerName,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
    });
  }
}
