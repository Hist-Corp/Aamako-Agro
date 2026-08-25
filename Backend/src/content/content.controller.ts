import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, RevisionStatus } from '@prisma/client';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

class UpsertContentDto {
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiProperty() @IsString() body!: string;
}

class ReviewRevisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reviewNote?: string;
}

/** Who may propose/edit content. */
const CONTENT_EDITORS = [
  Role.CONTENT_MANAGER,
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];
/** Who may approve/reject (publish to live). */
const CONTENT_APPROVERS = [
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];

@ApiBearerAuth()
@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private prisma: PrismaService) {}

  /** PUBLIC: live website content only — pending revisions are never exposed. */
  @Public()
  @Get()
  live() {
    return this.prisma.contentItem.findMany({
      where: { isPublished: true },
      select: { key: true, title: true, body: true, updatedAt: true },
      orderBy: { key: 'asc' },
    });
  }

  /** Moderation queue — pending revisions awaiting a Manager's decision. */
  @Roles(...CONTENT_APPROVERS, Role.CONTENT_MANAGER)
  @Get('revisions')
  queue() {
    return this.prisma.contentRevision.findMany({
      where: { status: RevisionStatus.PENDING },
      include: { contentItem: { select: { key: true, title: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Full history of revisions for one content item. */
  @Roles(...CONTENT_APPROVERS, Role.CONTENT_MANAGER)
  @Get(':key/revisions')
  history(@Param('key') key: string) {
    return this.prisma.contentRevision.findMany({
      where: { contentItem: { key } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Create or propose an edit to a content item.
   * - CONTENT_MANAGER: saved as a PENDING revision — NOT live until approved.
   * - STAFF_MANAGER and above: applied to the live item immediately.
   */
  @Roles(...CONTENT_EDITORS)
  @Put(':key')
  async upsert(
    @Param('key') key: string,
    @Body() dto: UpsertContentDto,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    const canPublishDirectly = actor!.role !== Role.CONTENT_MANAGER;

    const item = await this.prisma.contentItem.upsert({
      where: { key },
      create: {
        key,
        // A content manager's brand-new page also waits for approval:
        title: canPublishDirectly ? dto.title : `${key} (pending approval)`,
        body: canPublishDirectly ? dto.body : '',
        updatedById: actor!.id,
      },
      update: canPublishDirectly
        ? { title: dto.title, body: dto.body, updatedById: actor!.id }
        : {}, // live content untouched
    });

    const revision = await this.prisma.contentRevision.create({
      data: {
        contentItemId: item.id,
        proposedTitle: dto.title,
        proposedBody: dto.body,
        submittedById: actor!.id,
        status: canPublishDirectly ? RevisionStatus.APPROVED : RevisionStatus.PENDING,
        reviewedById: canPublishDirectly ? actor!.id : null,
        reviewedAt: canPublishDirectly ? new Date() : null,
      },
    });

    return {
      revisionId: revision.id,
      status: revision.status,
      live: canPublishDirectly,
      message: canPublishDirectly
        ? 'Content updated and published.'
        : 'Change saved as PENDING — it will appear on the website after a Manager approves it.',
    };
  }

  /** Approve a pending revision — publishes it to the live site. */
  @Roles(...CONTENT_APPROVERS)
  @Post('revisions/:id/approve')
  async approve(
    @Param('id') id: string,
    @Body() dto: ReviewRevisionDto,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    const revision = await this.prisma.contentRevision.findUnique({ where: { id } });
    if (!revision) throw new NotFoundException('Revision not found');
    if (revision.status !== RevisionStatus.PENDING) {
      throw new BadRequestException(`Revision already ${revision.status.toLowerCase()}`);
    }

    const [applied] = await this.prisma.$transaction([
      this.prisma.contentItem.update({
        where: { id: revision.contentItemId },
        data: {
          title: revision.proposedTitle,
          body: revision.proposedBody,
          isPublished: true,
          updatedById: revision.submittedById,
        },
      }),
      this.prisma.contentRevision.update({
        where: { id },
        data: {
          status: RevisionStatus.APPROVED,
          reviewedById: actor!.id,
          reviewedAt: new Date(),
          reviewNote: dto.reviewNote,
        },
      }),
    ]);
    return { success: true, key: applied.key };
  }

  /** Reject a pending revision — live site stays unchanged. */
  @Roles(...CONTENT_APPROVERS)
  @Post('revisions/:id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: ReviewRevisionDto,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    const revision = await this.prisma.contentRevision.findUnique({ where: { id } });
    if (!revision) throw new NotFoundException('Revision not found');
    if (revision.status !== RevisionStatus.PENDING) {
      throw new BadRequestException(`Revision already ${revision.status.toLowerCase()}`);
    }
    await this.prisma.contentRevision.update({
      where: { id },
      data: {
        status: RevisionStatus.REJECTED,
        reviewedById: actor!.id,
        reviewedAt: new Date(),
        reviewNote: dto.reviewNote,
      },
    });
    return { success: true };
  }

  /** Unpublish (hide) a live content item — Manager+. */
  @Roles(...CONTENT_APPROVERS)
  @Post(':key/unpublish')
  async unpublish(@Param('key') key: string) {
    const item = await this.prisma.contentItem.findUnique({ where: { key } });
    if (!item) throw new NotFoundException('Content item not found');
    await this.prisma.contentItem.update({ where: { key }, data: { isPublished: false } });
    return { success: true };
  }
}

