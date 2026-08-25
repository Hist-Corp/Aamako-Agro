import {
  Body,
  Controller,
  Get,
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
  CreateInquiryDto,
  PrivateLabelLeadDto,
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
