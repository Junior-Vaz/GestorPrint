import { IsString, IsOptional, IsIn, IsEmail, IsISO8601, IsInt, IsBoolean, Min, Max, MaxLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTenantDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(60)  slug?: string;
  @IsOptional() @IsIn(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']) plan?: string;
  @IsOptional() @IsIn(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']) planStatus?: string;
  @IsOptional() @IsISO8601() trialEndsAt?: string;
  @IsOptional() @IsISO8601() planExpiresAt?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) @Type(() => Number) maxUsers?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) maxOrders?: number;
  @IsOptional() @IsString() @MaxLength(120) ownerName?: string;
  @ValidateIf(o => !!o.ownerEmail) @IsOptional() @IsEmail() ownerEmail?: string;
  @IsOptional() @IsString() @MaxLength(20) ownerPhone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
