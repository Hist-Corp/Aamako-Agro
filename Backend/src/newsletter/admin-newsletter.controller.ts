import { Controller, Get, Patch, Param, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { NewsletterService } from './newsletter.service';

@ApiTags('admin/newsletter')
@ApiBearerAuth()
@Controller('admin/newsletter')
export class AdminNewsletterController {
  constructor(private newsletter: NewsletterService) {}

  @Roles(Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Get('list')
  @ApiOperation({ summary: 'List active newsletter subscribers' })
  @ApiOkResponse({ description: 'Paginated subscriber list' })
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.newsletter.list(page, limit);
  }
}
