import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, ReviewStatus, Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

const STAFF_READ: Role[] = [
  Role.STAFF_SUPPORT,
  Role.CONTENT_MANAGER,
  Role.STAFF_MANAGER,
  Role.STAFF_SALES,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];
const STAFF_MODERATE: Role[] = [Role.STAFF_SUPPORT, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN];

@ApiBearerAuth()
@ApiTags('admin/reviews')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private prisma: PrismaService) {}

  /** Paginated review list. Filters: ?productId=&status=&rating=&search=&page=&limit= */
  @Roles(...STAFF_READ)
  @Get()
  async list(
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('rating') rating?: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const cur = Math.max(1, parseInt(page, 10) || 1);

    const where: Prisma.ReviewWhereInput = {};
    if (productId) where.productId = productId;
    if (status) where.status = status as ReviewStatus;
    if (rating) {
      const r = parseInt(rating, 10);
      if (!Number.isNaN(r)) where.rating = r;
    }
    if (search) {
      const q = search.trim();
      where.OR = [
        { customerName: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (cur - 1) * take,
        take,
        include: { product: { select: { name: true } } },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({ ...r, productName: r.product.name, product: undefined })),
      total,
      page: cur,
      limit: take,
      totalPages: Math.max(1, Math.ceil(total / take)),
    };
  }

  /** Moderate a review: APPROVED | REJECTED | FLAGGED (records moderator + timestamp). */
  @Roles(...STAFF_MODERATE)
  @Patch(':id')
  async moderate(
    @Param('id') id: string,
    @Body() body: { status?: string; reason?: string },
    @CurrentUser() user: { id: string; firstName?: string; lastName?: string },
  ) {
    const status = body.status as ReviewStatus;
    if (!['APPROVED', 'REJECTED', 'FLAGGED'].includes(status)) {
      throw new BadRequestException('status must be APPROVED, REJECTED or FLAGGED');
    }
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    const moderatorName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Staff';
    return this.prisma.review.update({
      where: { id },
      data: {
        status,
        flagReason: status === 'FLAGGED' ? (body.reason ?? 'Flagged by moderator') : review.flagReason,
        moderatedById: user?.id ?? null,
        moderatedByName: moderatorName,
        moderatedAt: new Date(),
      },
    });
  }
}