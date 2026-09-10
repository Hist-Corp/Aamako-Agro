import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreateSupportTicketDto } from './dto/support.dto';
import { SupportService } from './support.service';

/**
 * Public customer-support endpoints used by the storefront support widget:
 *   POST /api/support/tickets      — raise a ticket (lands in the dashboard queue)
 *   GET  /api/support/tickets/:id  — track a ticket by its reference id
 */
@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private support: SupportService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('tickets')
  create(
    @Body() dto: CreateSupportTicketDto,
    // Optional auth: signed-in customers keep their verified email on the ticket.
    @CurrentUser() user?: { id: string; email: string; role: never },
  ) {
    return this.support.createTicket(dto, user);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('tickets/:id')
  status(@Param('id') id: string) {
    return this.support.ticketStatus(id);
  }
}
