import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { RuleType } from '@prisma/client';

export class CreatePricingRuleDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiProperty({ enum: RuleType }) @IsEnum(RuleType) ruleType!: RuleType;
  @ApiPropertyOptional() @IsOptional() @IsString() tierId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() variantId?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) minQuantity?: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() maxQuantity?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  discountPercent?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @IsInt() overrideUnitPriceCents?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() startsAt?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsISO8601() endsAt?: string | null;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() priority?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdatePricingRuleDto extends PartialType(CreatePricingRuleDto) {}

export class UpdateInventoryDto {
  @ApiProperty() @IsInt() @Min(0) stockOnHand!: number;
}
