import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WholesaleService } from './wholesale.service';
import {
  BusinessActionDto,
  CreateInquiryDto,
  PrivateLabelLeadDto,
  RespondQuoteDto,
  ReviewInquiryDto,
  SampleKitDto,
} from './dto/wholesale.dto';

@ApiTags('wholesale')
@Controller('wholesale')
export class WholesaleController {
  constructor(private wholesale: WholesaleService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('inquiries')
  createInquiry(@Body() dto: CreateInquiryDto) {
    return this.wholesale.createInquiry(dto);
  }

  @Public()
  @Post('sample-kit')
  requestSampleKit(
    @Body() dto: SampleKitDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.wholesale.requestSampleKit(user?.id, dto);
  }

  @Public()
  @Post('private-label-leads')
  privateLabelLead(@Body() dto: PrivateLabelLeadDto) {
    return this.wholesale.createPrivateLabelLead(dto);
  }
}

// Staff-only visibility for inquiries & leads
@ApiBearerAuth()
@ApiTags('admin/wholesale')
@Controller('admin/wholesale')
export class AdminWholesaleController {
  constructor(private wholesale: WholesaleService, private prisma: PrismaService) {}

  @Roles(Role.STAFF_SUPPORT, Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Get('inquiries')
  listInquiries() {
    return this.prisma.wholesaleInquiry.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Roles(Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Patch('inquiries/:id')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewInquiryDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.wholesale.review(id, user!.id, dto);
  }

  @Roles(Role.STAFF_SUPPORT, Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Get('private-label-leads')
  listLeads() {
    return this.prisma.privateLabelLead.findMany({ orderBy: { createdAt: 'desc' } });
  }
}

/**
 * Admin Quotes — backed by WholesaleInquiry.
 * Maps the wholesale-inquiry record to the QuoteRequest shape the
 * dashboard consumes. Sales/Manager/Admin respond via PATCH /admin/quotes/:id.
 */
@ApiBearerAuth()
@ApiTags('admin/quotes')
@Controller('admin/quotes')
export class AdminQuotesController {
  constructor(private prisma: PrismaService) {}

  @Roles(Role.STAFF_SALES, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Get()
  async listQuotes() {
    const rows = await this.prisma.wholesaleInquiry.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toQuoteRequest);
  }

  @Roles(Role.STAFF_SALES, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Patch(':id')
  async respond(
    @Param('id') id: string,
    @Body() dto: RespondQuoteDto,
    @CurrentUser() user?: { id: string },
  ) {
    const inquiry = await this.prisma.wholesaleInquiry.findUnique({ where: { id } });
    if (!inquiry) throw new NotFoundException('Quote not found');
    const note =
      dto.totalEstimate != null && dto.totalEstimate !== undefined
        ? `${dto.responseNote ? dto.responseNote + '\n' : ''}Estimated total: NPR ${dto.totalEstimate}`
        : dto.responseNote;
    const updated = await this.prisma.wholesaleInquiry.update({
      where: { id },
      data: { reviewNote: note, reviewedById: user!.id },
    });
    return toQuoteRequest(updated);
  }
}

/**
 * Admin Business approve/reject — backed by WholesaleInquiry.
 * Maps the dashboard's BusinessActionRequest onto the inquiry review
 * flow so the Wholesale screen's Approve/Reject dialog works.
 */
@ApiBearerAuth()
@ApiTags('admin/businesses')
@Controller('admin/businesses')
export class AdminBusinessesController {
  constructor(private wholesale: WholesaleService, private prisma: PrismaService) {}

  @Roles(Role.STAFF_SALES, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Get()
  async list() {
    const rows = await this.prisma.wholesaleInquiry.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toBusiness);
  }

  @Roles(Role.STAFF_SALES, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Patch(':id')
  async action(
    @Param('id') id: string,
    @Body() dto: BusinessActionDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.wholesale.businessAction(id, user!.id, dto);
  }
}

function toQuoteRequest(i: {
  id: string;
  companyName: string;
  message: string | null;
  status: string;
  reviewNote: string | null;
  reviewedById: string | null;
  requestedUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: i.id,
    businessId: i.requestedUserId ?? '',
    businessName: i.companyName,
    items: [],
    notes: i.message ?? undefined,
    status:
      i.status === 'APPROVED'
        ? 'RESPONDED'
        : i.status === 'REJECTED'
        ? 'EXPIRED'
        : 'PENDING',
    respondedAt: i.reviewedById ? i.updatedAt.toISOString() : undefined,
    responseNote: i.reviewNote ?? undefined,
    totalEstimate: undefined,
    createdAt: i.createdAt.toISOString(),
  };
}

function toBusiness(i: {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  status: string;
  reviewNote: string | null;
  reviewedById: string | null;
  requestedUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: i.id,
    businessName: i.companyName,
    contactName: i.contactName,
    contactEmail: i.email,
    contactPhone: i.phone ?? '',
    address: { line1: '', line2: undefined, city: '', state: '', postalCode: '', country: 'Nepal' },
    status: i.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED',
    priceTier: undefined,
    creditLimit: undefined,
    paymentTerms: undefined,
    assignedSalesId: i.requestedUserId ?? undefined,
    assignedSalesName: undefined,
    orderCount: 0,
    totalSpend: 0,
    reviewNote: i.reviewNote ?? undefined,
    rejectionReason: i.status === 'REJECTED' ? i.reviewNote ?? undefined : undefined,
    approvedAt: i.status === 'APPROVED' ? i.updatedAt.toISOString() : undefined,
    rejectedAt: i.status === 'REJECTED' ? i.updatedAt.toISOString() : undefined,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}
