import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ArrayMinSize,
} from 'class-validator';
import { Unit } from '@prisma/client';

export class CreateVariantDto {
  @ApiProperty() @IsString() @MinLength(2) sku!: string;
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty({ enum: Unit }) @IsEnum(Unit) unit!: Unit;
  @ApiProperty({ description: 'Price in paisa' }) @IsInt() @Min(0) basePriceCents!: number;
}

export class CreateProductDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiProperty() @IsString() @MinLength(2) slug!: string;

  /** Comprehensive data entry — a detailed description is required. */
  @ApiProperty({ description: 'Detailed customer-facing description (min 30 chars)' })
  @IsString()
  @MinLength(30)
  description!: string;

  /** High-resolution product image (https://). Required. */
  @ApiProperty({ description: 'High-resolution product image URL (https)' })
  @IsString()
  @Matches(/^https:\/\/.+/i, {
    message: 'imageUrl must be a secure https:// URL',
  })
  imageUrl!: string;

  @ApiProperty() @IsString() categoryId!: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isPublished?: boolean;

  /** At least one sellable variant must be provided. */
  @ApiProperty({ type: [CreateVariantDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => CreateVariantDto)
  variants!: CreateVariantDto[];
}

export class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class CreateCategoryDto {
  @ApiProperty({ description: 'Display name of the category page (min 2 chars)' })
  @IsString()
  @MinLength(2)
  name!: string;

  /** Optional URL slug — generated from the name when omitted. */
  @ApiPropertyOptional({ description: 'URL slug (collection.html?cat=…). Generated from the name when omitted.' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters/numbers separated by single hyphens',
  })
  slug?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'New display name for the category' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}

export class ListProductsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;

  @ApiPropertyOptional() @IsOptional() @IsString() categorySlug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
