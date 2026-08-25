import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty() @IsString() variantId!: string;
  @ApiProperty({ default: 1 }) @IsInt() @Min(1) quantity!: number;
}

export class UpdateCartItemDto {
  @ApiProperty() @IsString() variantId!: string;
  @ApiProperty({ description: '0 removes the line' }) @IsInt() @Min(0) quantity!: number;
}

export class CheckoutDto {
  @ApiProperty({ example: 'Ram Shrestha' }) @IsString() contactName!: string;
  @ApiProperty({ example: 'ram@example.com' }) @IsString() contactEmail!: string;
  @ApiProperty() @IsOptional() @IsString() contactPhone?: string;
  @ApiProperty() @IsString() shippingAddress!: string;
  @ApiProperty() @IsOptional() @IsString() notes?: string;
}
