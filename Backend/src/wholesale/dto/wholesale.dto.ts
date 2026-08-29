import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { InquiryStatus, Tier } from '@prisma/client';

export class CreateInquiryDto {
  @ApiProperty() @IsString() @MinLength(2) companyName!: string;
  @ApiProperty() @IsString() @MinLength(2) contactName!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) message?: string;
}

export class ReviewInquiryDto {
  @ApiProperty({ enum: InquiryStatus })
  @IsEnum(InquiryStatus)
  status!: InquiryStatus;

  @ApiProperty({ enum: Tier, description: 'Tier assigned on approval' })
  @IsEnum(Tier)
  tier!: Tier;

  @ApiPropertyOptional() @IsOptional() @IsString() reviewNote?: string;

  @ApiPropertyOptional({
    description: 'User id to attach the wholesale account to (on approval)',
  })
  @IsOptional() @IsString() userId?: string;
}

export class SampleKitDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() shippingAddress!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class PrivateLabelLeadDto {
  @ApiProperty() @IsString() @MinLength(2) companyName!: string;
  @ApiProperty() @IsString() @MinLength(2) contactName!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() productInterest?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() quantityEstimate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) message?: string;
}

/** Sales/Manager response to a wholesale quote request. */
export class RespondQuoteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) responseNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() totalEstimate?: number;
}

/** Approve/reject a wholesale business application (maps onto WholesaleInquiry review). */
export class BusinessActionDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsEnum(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) reason?: string;

  @ApiPropertyOptional({ enum: Tier }) @IsOptional() @IsEnum(Tier) priceTier?: Tier;
}
