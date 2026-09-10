import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TicketPriority } from '@prisma/client';

/** Public payload for a customer raising a support ticket from the storefront widget. */
export class CreateSupportTicketDto {
  @ApiProperty({ example: 'Order not received after 7 days' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  subject!: string;

  @ApiProperty({ example: 'Ram Bahadur' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Order Issue' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    example: 'I placed an order last week and it has not arrived yet.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
