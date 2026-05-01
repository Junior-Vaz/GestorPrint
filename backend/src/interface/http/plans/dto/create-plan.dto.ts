import {
  IsString, IsNumber, IsInt, IsBoolean, IsOptional,
  MaxLength, Min, Max,
} from 'class-validator';

export class CreatePlanDto {
  @IsString() @MaxLength(30) name: string;
  @IsString() @MaxLength(60) displayName: string;
  @IsOptional() @IsString() description?: string;

  @IsNumber() @Min(0) price: number;
  @IsInt() @Min(1) @Max(99999) maxUsers: number;
  @IsInt() @Min(1) @Max(99999) maxOrders: number;
  @IsInt() @Min(1) @Max(99999) maxCustomers: number;

  @IsOptional() @IsBoolean() hasPdf?: boolean;
  @IsOptional() @IsBoolean() hasReports?: boolean;
  @IsOptional() @IsBoolean() hasKanban?: boolean;
  @IsOptional() @IsBoolean() hasFileUpload?: boolean;
  @IsOptional() @IsBoolean() hasWhatsapp?: boolean;
  @IsOptional() @IsBoolean() hasPix?: boolean;
  @IsOptional() @IsBoolean() hasAudit?: boolean;
  @IsOptional() @IsBoolean() hasCommissions?: boolean;
  @IsOptional() @IsBoolean() hasApiAccess?: boolean;
  @IsOptional() @IsBoolean() hasReceivables?: boolean;
  @IsOptional() @IsBoolean() hasPlotterEstimate?: boolean;
  @IsOptional() @IsBoolean() hasCuttingEstimate?: boolean;
  @IsOptional() @IsBoolean() hasEmbroideryEstimate?: boolean;
  // Ecommerce / loja online
  @IsOptional() @IsBoolean() hasEcommerce?: boolean;
  @IsOptional() @IsBoolean() hasMpCard?: boolean;
  @IsOptional() @IsBoolean() hasMelhorEnvios?: boolean;
  // Programa de Fidelidade — pontos, cashback, tiers, aniversário, referral
  @IsOptional() @IsBoolean() hasLoyalty?: boolean;

  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}
