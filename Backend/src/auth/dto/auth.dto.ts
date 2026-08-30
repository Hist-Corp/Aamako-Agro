import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'ram@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Ram' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiPropertyOptional({ example: 'Shrestha' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+9779800000000' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'ram@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;

  /**
   * Which surface the login originates from. Storefront logins are rejected
   * for any account registered by the Admin Dashboard (staff accounts).
   * Defaults to 'dashboard' so existing admin clients are unaffected.
   */
  @ApiPropertyOptional({ enum: ['storefront', 'dashboard'], default: 'dashboard' })
  @IsOptional()
  @IsIn(['storefront', 'dashboard'])
  scope?: 'storefront' | 'dashboard';
}

export class GoogleLoginDto {
  /**
   * Google ID token (the `credential` JWT returned by Google Identity
   * Services after the user signs in with their Google account).
   */
  @ApiProperty({ description: 'Google ID token (Google Identity Services credential)' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token returned at login' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutDto extends RefreshDto {}

/** Fields a signed-in user may edit on their own profile. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ram' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Shrestha' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional({ example: '+9779800000000' })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  phone?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password for confirmation' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;

  /** Current session's refresh token — kept alive when others are revoked. */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

