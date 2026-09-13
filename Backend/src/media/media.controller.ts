import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ImageCompressionService } from './image-compression.service';
import { MediaService, MediaPayload } from './media.service';
import { CacheService } from '../common/cache.service';
import { CacheNamespaces } from '../common/cache.namespaces';

export class CreateMediaDto implements MediaPayload {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty({ description: 'Image URL (https, or http for first-party uploaded files)' })
  @IsString() @Matches(/^https?:\/\/.+/i, { message: 'url must be a valid http(s):// URL' })
  url!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) altText?: string;
  @ApiPropertyOptional({ default: 'General' }) @IsOptional() @IsString() @MaxLength(60) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() size?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dimensions?: string;
  @ApiPropertyOptional({ description: 'Dashboard page this file was uploaded from (template editor provenance)' })
  @IsOptional() @IsString() @MaxLength(80) sourcePage?: string;
  @ApiPropertyOptional({ description: 'Template section this file was uploaded from' })
  @IsOptional() @IsString() @MaxLength(80) sourceSection?: string;
}

export class UpdateMediaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^https?:\/\/.+/i, { message: 'url must be a valid http(s):// URL' })
  url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) altText?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() size?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dimensions?: string;
}

export class ListMediaQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ enum: ['IMAGE', 'VIDEO', 'DOCUMENT'] }) @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional({ enum: ['true', 'false'] }) @IsOptional() @IsString() isPublished?: string;
}

@ApiBearerAuth()
@ApiTags('media')
@Controller('admin/media')
export class MediaController {
  constructor(
    private media: MediaService,
    private compressor: ImageCompressionService,
    private cache: CacheService,
  ) {}
  /** Editors only. Content Manager may view the whole library. */
  @Roles(Role.CONTENT_MANAGER, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Get()
  list(@Query() q: ListMediaQueryDto) {
    return this.media.list({
      category: q.category,
      type: q.type,
      isPublished: q.isPublished === undefined ? undefined : q.isPublished === 'true',
    });
  }

  /** Distinct categories for the filter chips. */
  @Roles(Role.CONTENT_MANAGER, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Get('categories')
  categories() {
    return this.media.listCategories();
  }

  /** Add an image (or file) to the library — goes live immediately. */
  @Roles(Role.CONTENT_MANAGER, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateMediaDto, @CurrentUser() actor?: { id: string }) {
    return this.media.create(dto as Required<Pick<MediaPayload, 'name' | 'url'>> & MediaPayload, actor?.id);
  }

  /** Upload an image straight from the user's device. The image is optimized
   *  exactly once at upload time (WebP re-encode + max 1920px edge + metadata
   *  strip) and the optimized file is what gets stored & served — cutting
   *  storage and page weight without visible quality loss. Animated/vector
   *  files and already-optimal images are stored untouched. */
  @Roles(Role.CONTENT_MANAGER, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      // Generous pre-compression cap: large phone photos are exactly the
      // files the optimizer shrinks best, so accept up to 25 MB and let
      // ImageCompressionService store a fraction of it. (Multer's
      // LIMIT_FILE_SIZE surfaces as a 413 via the global exception filter.)
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
      },
    }),
  )
  async upload(
    @UploadedFile()
    file?: { originalname?: string; mimetype: string; size: number; buffer: Buffer },
    // Optional metadata sent as multipart fields (category, alt text, origin
    // from bus — the page template editor and product template editor both
    // send these so the entry is born filed under the right page's section).
    @Body()
    dto?: {
      name?: string;
      category?: string;
      altText?: string;
      size?: string;
      dimensions?: string;
      sourcePage?: string;
      sourceSection?: string;
    },
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const crypto = require('crypto') as typeof import('crypto');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    // One compression pass BEFORE storing — the optimized bytes are the only
    // bytes that ever touch the disk or get served to visitors.
    const optimized = await this.compressor.compress(file.buffer, file.mimetype);
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${optimized.extension}`;
    fs.writeFileSync(path.join(uploadsDir, filename), optimized.buffer);

    // A new published asset appeared on the public feed — drop the cached copy.
    this.cache.bump(CacheNamespaces.MEDIA);

    const baseUrl =
      process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api`;
    const url = `${baseUrl.replace(/\/$/, '')}/uploads/${filename}`;

    // Auto-register every upload in the media library. Previously only the
    // media page registered items (with a second POST /admin/media); device
    // picks from the template editor simply wrote a file to disk and then
    // NEVER appeared in the "Media library" pickers — which is why sections
    // showed images as missing. Registering here makes every upload pickable.
    // `create` upserts by URL, so a stale client that still double-registers
    // an upload merges into the existing entry instead of duplicating it.
    // Category is left undefined when the caller sends none so the service
    // applies its "General" default only when creating a NEW row — a merge
    // must never re-file an existing asset into "General".
    const asset = await this.media.create(
      {
        name: dto?.name?.trim() || file.originalname || 'Untitled image',
        url,
        category: dto?.category?.trim() || undefined,
        altText: dto?.altText?.trim() || undefined,
        size:
          dto?.size ||
          (optimized.storedBytes
            ? `${Math.max(1, Math.round(optimized.storedBytes / 1024))} KB`
            : undefined),
        dimensions:
          optimized.width && optimized.height ? `${optimized.width}×${optimized.height}` : undefined,
        sourcePage: dto?.sourcePage?.trim() || undefined,
        sourceSection: dto?.sourceSection?.trim() || undefined,
      },
      actor?.id,
    );

    return {
      id: asset.id,
      url,
      name: asset.name,
      // `size` is the STORED size so the dashboard/library reflect reality.
      size: optimized.storedBytes,
      originalSize: optimized.originalBytes,
      optimized: optimized.optimized,
      dimensions: asset.dimensions,
      note: optimized.note,
    };
  }

  /** Edit / customize an asset's name, alt text, category or URL. */
  @Roles(Role.CONTENT_MANAGER, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMediaDto) {
    return this.media.update(id, dto);
  }

  @Roles(Role.CONTENT_MANAGER, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.media.setPublished(id, true);
  }

  @Roles(Role.CONTENT_MANAGER, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.media.setPublished(id, false);
  }

  @Roles(Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN, Role.CONTENT_MANAGER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.media.remove(id);
  }
}

/**
 * PUBLIC storefront feed — GET /media.
 * Returns published images from the library (categorized by page: Home, Shop,
 * Product Category, …) so the static storefront can hydrate its image
 * sections (data-cms-img) with dashboard-uploaded photos. Provenance
 * (sourcePage/sourceSection), uploader, size and unpublished assets are
 * deliberately NOT exposed here.
 */
@ApiTags('media')
@Controller('media')
export class StorefrontMediaController {
  constructor(private media: MediaService) {}

  @Public()
  @Get()
  listPublic() {
    return this.media.listPublic();
  }
}