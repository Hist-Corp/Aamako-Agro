import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Role } from '@prisma/client';
import { ReviewStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

const MODERATORS = [
  Role.CONTENT_MANAGER,
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];

class ReviewQueryDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED']) status?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) limit?: number;
}

class ModerateReviewDto {
  @IsIn(['APPROVED', 'REJECTED', 'FLAGGED']) status!: string;
  @IsOptional() @IsString() reason?: string;
}

/** Maps a Prisma Review row onto the dashboard Review shape. */
function mapReview(r: any) {
  return {
    id: r.id,
    productId: r.productId,
    productName: r.product?.name ?? 'Unknown product',
    customerId: r.userId ?? '',
    customerName: r.customerName,
    rating: r.rating,
    title: r.title,
    content: r.content,
    status: r.status,
    isVerifiedPurchase: r.isVerifiedPurchase,
    helpfulCount: r.helpfulCount,
    flagReason: r.flagReason,
    moderatedBy: r.moderatedById,
    moderatedByName: r.moderatedByName,
    moderatedAt: r.moderatedAt?.toISOString(),
    images: [],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

@ApiBearerAuth()
@ApiTags('admin/reviews')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private prisma: PrismaService) {}

  @Roles(...MODERATORS)
  @Get()
  async list(@Query() q: ReviewQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where: Record<string, unknown> = {};
    if (q.productId) where.productId = q.productId;
    if (q.status) where.status = q.status;
    if (q.rating) where.rating = q.rating;
    if (q.search) {
      where.OR = [
        { customerName: { contains: q.search, mode: 'insensitive' } },
        { content: { contains: q.search, mode: 'insensitive' } },
        { title: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map(mapReview),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Moderate (approve / reject / flag) a review. Restricted to moderators. */
  @Roles(...MODERATORS)
  @Patch(':id')
  async moderate(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() actor?: { id: string; name?: string; email: string },
  ) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');

    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        status: dto.status as ReviewStatus,
        flagReason: dto.reason ?? existing.flagReason,
        moderatedById: actor?.id,
        moderatedByName: actor?.name ?? actor?.email,
        moderatedAt: new Date(),
      },
      include: { product: { select: { name: true } } },
    });
    return mapReview(updated);
  }
}