import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength,
} from 'class-validator';
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
import { CacheService } from '../common/cache.service';
import { CacheNamespaces, CacheTtls } from '../common/cache.namespaces';

class UpsertContentDto {
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  shortDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()
  longDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
  category?: string;
  @ApiProperty() @IsString() body!: string;
  /** Editor-side visibility — false hides the section from the public page
   *  (the storefront falls back to its built-in default copy). */
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isVisible?: boolean;
}

class SetVisibilityDto {
  @ApiProperty() @IsBoolean() isVisible!: boolean;
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

/** Newsletter subscription DTO — public, no auth required. */
class SubscribeDto {
  @ApiProperty({ format: 'email' }) @IsString() @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: 'email must be a valid email address',
  })
  email!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) source?: string;
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
    private cache: CacheService,
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

  /** Invalidate the cached public live-content feed after any live change. */
  private invalidateLiveContent(): void {
    this.cache.bump(CacheNamespaces.CONTENT);
  }

  /** PUBLIC: live website content only — pending revisions are never exposed.
   *
   *  Real-time sync contract with the storefront (Frontend/js/content.js):
   *  - Emits an ETag derived from the newest updatedAt + row count so the
   *    storefront's 10s poller can use If-None-Match and skip re-hydration
   *    when nothing changed (304 / unchanged payload).
   *  - product-template.<slug>.* items are included in the same feed so
   *    product-page edits go live through the identical instant path as
   *    page sections (no separate product-content channel needed). The
   *    editor (Dashboard → Product Templates) and the storefront product
   *    page (Frontend/product.html) share ONE key contract:
   *    product-template.<slug>.<field> (see productFieldKey() in
   *    Dashboard/apps/admin/src/config/product-templates.ts) — a field added
   *    to the template config is picked up by the storefront with zero
   *    storefront changes, and removing a template field deletes its
   *    ContentItem (DELETE /content/:key) which the storefront treats as
   *    "never customized" (falls back to the catalog value).
   */
  @Public()
  @Get()
  async live(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const items = await this.cache.getOrSet(CacheNamespaces.CONTENT, 'all', CacheTtls.CONTENT_SECONDS, () =>
      this.prisma.contentItem.findMany({
        where: { isPublished: true },
        select: {
          key: true,
          title: true,
          shortDescription: true,
          longDescription: true,
          category: true,
          body: true,
          isVisible: true,
          updatedAt: true,
        },
        orderBy: { key: 'asc' },
      }),
    );
    // ETag = newest updatedAt + row count. Cheap, stable, and sufficient for
    // the storefront poller to detect "anything changed" without a hash pass.
    const rows = items as Array<{ updatedAt?: Date | string }>;
    let newest = 0;
    for (const it of rows) {
      const t = it?.updatedAt ? new Date(it.updatedAt).getTime() : 0;
      if (Number.isFinite(t) && t > newest) newest = t;
    }
    const etag = `"cms-${newest.toString(36)}-${rows.length}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=10');
    const ifNoneMatch = req?.headers?.['if-none-match'];
    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(304);
      return undefined;
    }
    return items;
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
        isVisible: true,
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

    if (canPublishDirectly) this.invalidateLiveContent();

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
        isVisible: dto.isVisible ?? true,
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
            // Visibility is editor-side — applied immediately regardless of
            // the review workflow (it never changes the approved copy).
            ...(dto.isVisible !== undefined ? { isVisible: dto.isVisible } : {}),
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

    if (canPublishDirectly) this.invalidateLiveContent();

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
    this.invalidateLiveContent();
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
    this.invalidateLiveContent();
    return { success: true };
  }

  /** Unpublish (hide) a live content item — Managers & Content Manager. */
  @Roles(...CONTENT_APPROVERS)
  @Post(':key/unpublish')
  async unpublish(@Param('key') key: string) {
    const item = await this.prisma.contentItem.findUnique({ where: { key } });
    if (!item) throw new NotFoundException('Content item not found');
    await this.prisma.contentItem.update({ where: { key }, data: { isPublished: false } });
    this.invalidateLiveContent();
    return { success: true };
  }

  /**
   * Toggle editor-side visibility of a section (PATCH /content/:key).
   * `isVisible: false` removes the section from the rendered storefront page
   * (the layout reflows — the page stays responsive) while the section stays
   * in the template and in the dashboard, so it can be brought back anytime.
   */
  @Roles(...CONTENT_EDITORS)
  @Patch(':key')
  async setVisibility(
    @Param('key') key: string,
    @Body() dto: SetVisibilityDto,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    const existing = await this.prisma.contentItem.findUnique({ where: { key } });

    // A page/section that has never been edited has no row yet. Hiding it
    // creates a lightweight, PUBLISHED visibility stub (empty body — no copy is
    // ever leaked through the public feed) so the storefront can detect and hide
    // it. Showing a never-touched key is a no-op: the built-in default markup is
    // already visible, so there is nothing to restore.
    if (!existing) {
      if (dto.isVisible) return { success: true, key, isVisible: true, created: false };
      const item = await this.prisma.contentItem.create({
        data: {
          key,
          title: '',
          shortDescription: null,
          longDescription: null,
          category: null,
          body: '',
          isPublished: true,
          isVisible: false,
          updatedById: actor!.id,
        },
      });
      this.invalidateLiveContent();
      return { success: true, key, isVisible: item.isVisible, created: true };
    }

    // Existing row — plain toggle (section/page hide, unchanged behavior).
    await this.prisma.contentItem.update({
      where: { key },
      data: { isVisible: dto.isVisible, updatedById: actor!.id },
    });
    this.invalidateLiveContent();
    return { success: true, key, isVisible: dto.isVisible };
  }

  /**
   * Remove a template section entirely (DELETE /content/:key). The storefront
   * falls back to the default copy baked into the page markup. The item's
   * revision history is removed with it (cascade).
   */
  @Roles(...DIRECT_PUBLISHERS)
  @Delete(':key')
  async remove(@Param('key') key: string) {
    const item = await this.prisma.contentItem.findUnique({ where: { key } });
    if (!item) throw new NotFoundException('Content item not found');
    await this.prisma.contentRevision.deleteMany({ where: { contentItem: { key } } });
    await this.prisma.contentItem.delete({ where: { key } });
    this.invalidateLiveContent();
    return { success: true, key };
  }

  /** Public newsletter subscription — no auth required.
   *  Canonical subscribe path is POST /newsletter/subscribe (NewsletterModule).
   *  This legacy alias (POST /content/subscribe) is kept for older storefront
   *  bundles and delegates to the same table with identical idempotent
   *  semantics. New clients should use /newsletter/subscribe. */
  @Public()
  @Post('subscribe')
  async subscribe(@Body() dto: SubscribeDto) {
    const existing = await (this.prisma as any).subscriber.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      return {
        success: true,
        subscribed: true,
        message: 'You are already subscribed to our newsletter.',
        subscriberId: existing.id,
      };
    }
    const subscriber = await (this.prisma as any).subscriber.create({
      data: {
        email: dto.email.toLowerCase(),
        firstName: dto.firstName?.trim() || null,
        lastName: dto.lastName?.trim() || null,
        source: dto.source || 'homepage',
        consented: true,
      },
    });
    return {
      success: true,
      subscribed: true,
      message: 'You are now subscribed — thank you!',
      subscriberId: subscriber.id,
    };
  }

  /** Check whether an email is already subscribed (public). */
  @Public()
  @Get('subscribed/:email')
  async checkSubscribed(@Param('email') email: string) {
    const existing = await (this.prisma as any).subscriber.findUnique({
      where: { email: email.toLowerCase() },
    });
    return {
      subscribed: !!existing,
      subscriberId: existing?.id ?? null,
    };
  }
}

