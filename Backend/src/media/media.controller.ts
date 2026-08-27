import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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