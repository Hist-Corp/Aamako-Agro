import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, RevisionStatus } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

class UpsertContentDto {
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  shortDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()
  longDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
  category?: string;
  @ApiProperty() @IsString() body!: string;
}

class CreateContentDto extends UpsertContentDto {
  /** URL slug — kebab-case segments separated by dots, e.g. "about.story",
   *  "journal.farming.harvest-stories". Hyphens allowed inside segments. */
  @ApiProperty() @IsString() @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/, {
    message: 'key must be kebab-case segments separated by dots, e.g. "about.story"',
  })
  key!: string;
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
/** Who may approve/reject (publish to live).
 *  The Content Manager has FULL content-management rights: they can edit all
 *  existing pages, create new pages and publish/approve without waiting for
 *  another manager. */
const CONTENT_APPROVERS = [
  Role.CONTENT_MANAGER,
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
      select: {
        key: true,
        title: true,
        shortDescription: true,
        longDescription: true,
        category: true,
        body: true,
        updatedAt: true,
      },
      orderBy: { key: 'asc' },
    });
  }

  /** Editor listing — includes UNPUBLISHED items (dashboard management view). */
  @Roles(...CONTENT_EDITORS)
  @Get('manage')
  manage() {
    return this.prisma.contentItem.findMany({
      select: {
        id: true,
        key: true,
        title: true,
        shortDescription: true,
        longDescription: true,
        category: true,
        body: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
      },
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
   * Create a brand-new page/article (Content Manager full CMS rights).
   * Editors hold content:publish, so the item goes LIVE immediately and an
   * APPROVED ContentRevision snapshot is appended for the audit trail.
   */
  @Roles(...CONTENT_EDITORS)
  @Post()
  async create(
    @Body() dto: CreateContentDto,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    if (!dto.title.trim()) throw new BadRequestException('Title is required.');
    const exists = await this.prisma.contentItem.findUnique({
      where: { key: dto.key },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException(
        `A content item with key "${dto.key}" already exists.`,
      );
    }

    const item = await this.prisma.contentItem.create({
      data: {
        key: dto.key,
        title: dto.title.trim(),
        shortDescription: dto.shortDescription?.trim() || null,
        longDescription: dto.longDescription?.trim() || null,
        category: dto.category?.trim() || null,
        body: dto.body ?? '',
        isPublished: true,
        updatedById: actor!.id,
      },
    });
    await this.prisma.contentRevision.create({
      data: {
        contentItemId: item.id,
        proposedTitle: item.title,
        proposedShortDescription: item.shortDescription,
        proposedLongDescription: item.longDescription,
        proposedBody: item.body,
        submittedById: actor!.id,
        status: RevisionStatus.APPROVED,
        reviewedById: actor!.id,
        reviewedAt: new Date(),
      },
    });

    return {
      id: item.id,
      key: item.key,
      live: true,
      message: 'Page created and published.',
    };
  }

  /**
   * Create or propose an edit to a content item.
   * - Editors (incl. CONTENT_MANAGER): applied to the live item immediately,
   *   with an APPROVED revision snapshot kept for the audit trail.
   */
  @Roles(...CONTENT_EDITORS)
  @Put(':key')
  async upsert(
    @Param('key') key: string,
    @Body() dto: UpsertContentDto,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    const canPublishDirectly = ([
      Role.CONTENT_MANAGER,
      Role.STAFF_MANAGER,
      Role.STAFF_ADMIN,
      Role.SUPER_ADMIN,
    ] as Role[]).includes(actor!.role);

    const item = await this.prisma.contentItem.upsert({
      where: { key },
      create: {
        key,
        title: dto.title.trim(),
        shortDescription: dto.shortDescription?.trim() || null,
        longDescription: dto.longDescription?.trim() || null,
        category: dto.category?.trim() || null,
        body: dto.body,
        isPublished: canPublishDirectly,
        updatedById: actor!.id,
      },
      update: canPublishDirectly
        ? {
            title: dto.title.trim(),
            shortDescription: dto.shortDescription?.trim() || null,
            longDescription: dto.longDescription?.trim() || null,
            // Only touch category when the caller sends it (journal flows do;
            // plain page edits leave the existing value alone).
            ...(dto.category !== undefined
              ? { category: dto.category?.trim() || null }
              : {}),
            body: dto.body,
            updatedById: actor!.id,
          }
        : {}, // live content untouched
    });

    const revision = await this.prisma.contentRevision.create({
      data: {
        contentItemId: item.id,
        proposedTitle: dto.title.trim(),
        proposedShortDescription: dto.shortDescription?.trim() || null,
        proposedLongDescription: dto.longDescription?.trim() || null,
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
          shortDescription: revision.proposedShortDescription,
          longDescription: revision.proposedLongDescription,
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

  /** Publish (show) a content item — Managers & Content Manager. */
  @Roles(...CONTENT_APPROVERS)
  @Post(':key/publish')
  async publish(@Param('key') key: string) {
    const item = await this.prisma.contentItem.findUnique({ where: { key } });
    if (!item) throw new NotFoundException('Content item not found');
    await this.prisma.contentItem.update({ where: { key }, data: { isPublished: true } });
    return { success: true };
  }

  /** Unpublish (hide) a live content item — Managers & Content Manager. */
  @Roles(...CONTENT_APPROVERS)
  @Post(':key/unpublish')
  async unpublish(@Param('key') key: string) {
    const item = await this.prisma.contentItem.findUnique({ where: { key } });
    if (!item) throw new NotFoundException('Content item not found');
    await this.prisma.contentItem.update({ where: { key }, data: { isPublished: false } });
    return { success: true };
  }
}

