import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, RevisionStatus } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

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
 *  STAFF_MANAGER ("Manager"), STAFF_ADMIN and SUPER_ADMIN review and approve.
 *  The CONTENT_MANAGER proposes changes — their edits/creations land in the
 *  moderation queue and the Manager is notified; nothing goes live until a
 *  reviewer approves it. */
const CONTENT_APPROVERS = [
  Role.CONTENT_MANAGER,
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];
/** Roles whose content writes publish immediately (no review needed). */
const DIRECT_PUBLISHERS: Role[] = [
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];

@ApiBearerAuth()
@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** Notify every reviewer role (Manager / Admin / Super Admin) that a
   *  Content Manager proposed a change. Only users holding exactly one of
   *  these approver roles receive it — Sales, Support and the submitting
   *  Content Manager never get approval-request notifications. */
  private notifyManagersOfProposal(action: 'created' | 'updated', key: string, title: string) {
    void this.notifications
      .notifyRoles(
        [Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN],
        {
          type: 'CONTENT',
          title: `Content ${action} — approval needed`,
          message: `"${title}" (${key}) was ${action} by a Content Manager and is awaiting approval before it appears on the storefront.`,
          actionUrl: '/content',
        },
      )
      .catch(() => {
        /* notification fan-out must never break the content write */
      });
  }

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
   * Create a brand-new page/article.
   * - DIRECT_PUBLISHERS (Manager/Admin/Super Admin): item goes LIVE immediately
   *   with an APPROVED revision snapshot for the audit trail.
   * - CONTENT_MANAGER: item is created UNPUBLISHED with a PENDING revision;
   *   Managers are notified and it only appears on the storefront after one
   *   of them approves it.
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

    const canPublishDirectly = DIRECT_PUBLISHERS.includes(actor!.role);

    const item = await this.prisma.contentItem.create({
      data: {
        key: dto.key,
        title: dto.title.trim(),
        shortDescription: dto.shortDescription?.trim() || null,
        longDescription: dto.longDescription?.trim() || null,
        category: dto.category?.trim() || null,
        body: dto.body ?? '',
        isPublished: canPublishDirectly,
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
        status: canPublishDirectly ? RevisionStatus.APPROVED : RevisionStatus.PENDING,
        reviewedById: canPublishDirectly ? actor!.id : null,
        reviewedAt: canPublishDirectly ? new Date() : null,
      },
    });

    if (!canPublishDirectly) {
      this.notifyManagersOfProposal('created', item.key, item.title);
    }

    return {
      id: item.id,
      key: item.key,
      live: canPublishDirectly,
      status: canPublishDirectly ? 'APPROVED' : 'PENDING',
      message: canPublishDirectly
        ? 'Page created and published.'
        : 'Page created — it will appear on the website after a Manager approves it.',
    };
  }

  /**
   * Create or propose an edit to a content item.
   * - DIRECT_PUBLISHERS (Manager/Admin/Super Admin): applied to the live item
   *   immediately, with an APPROVED revision snapshot for the audit trail.
   * - CONTENT_MANAGER: live content is untouched; the edit is stored as a
   *   PENDING revision and Managers are notified. The change only appears on
   *   the storefront after a Manager approves it.
   */
  @Roles(...CONTENT_EDITORS)
  @Put(':key')
  async upsert(
    @Param('key') key: string,
    @Body() dto: UpsertContentDto,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    const canPublishDirectly = DIRECT_PUBLISHERS.includes(actor!.role);

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

    if (!canPublishDirectly) {
      this.notifyManagersOfProposal('updated', item.key, dto.title.trim());
    }

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
    // A Content Manager cannot approve their own proposals — approval must
    // come from a Manager, Admin or Super Admin.
    if (actor!.role === Role.CONTENT_MANAGER) {
      throw new ForbiddenException('Content Managers cannot approve revisions — Manager approval is required.');
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

