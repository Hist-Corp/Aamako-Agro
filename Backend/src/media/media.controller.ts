import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MediaService, MediaPayload } from './media.service';

export class CreateMediaDto implements MediaPayload {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty({ description: 'Image URL (https)' })
  @IsString() @Matches(/^https:\/\/.+/i, { message: 'url must be a secure https:// URL' })
  url!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) altText?: string;
  @ApiPropertyOptional({ default: 'General' }) @IsOptional() @IsString() @MaxLength(60) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() size?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dimensions?: string;
}

export class UpdateMediaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^https:\/\/.+/i, { message: 'url must be a secure https:// URL' })
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
  constructor(private media: MediaService) {}

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

  /** Upload an image straight from the user's device. Stores the file under
   *  /uploads and returns its public URL (usable as a product imageUrl). */
  @Roles(Role.CONTENT_MANAGER, Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
      },
    }),
  )
  upload(
    @UploadedFile()
    file?: { originalname?: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const crypto = require('crypto') as typeof import('crypto');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
    const baseUrl =
      process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api`;
    return { url: `${baseUrl.replace(/\/$/, '')}/uploads/${filename}`, name: file.originalname, size: file.size };
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