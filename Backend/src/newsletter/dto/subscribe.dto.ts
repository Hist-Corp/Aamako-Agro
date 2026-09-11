import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubscribeDto {
  @ApiProperty({ example: 'you@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Ram' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Bahadur' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional({ example: 'homepage', description: 'Subscription source page' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;
}

export class SubscribeResponse {
  @ApiProperty() success: boolean;
  @ApiProperty() message: string;
}