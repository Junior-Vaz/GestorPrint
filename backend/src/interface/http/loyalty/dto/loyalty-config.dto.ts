import {
  IsBoolean, IsNumber, IsInt, IsOptional, IsString,
  IsArray, ValidateNested, Min, Max, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Tier de fidelidade (Bronze/Prata/Ouro/Platina ou nomes custom).
 * `minSpend`: gasto acumulado nos últimos 12 meses pra entrar no tier.
 * `discount`: % de desconto aplicado em todo pedido pago do cliente neste tier.
 * `pointsMultiplier`: multiplicador de pontos ganhos (ex: 2 = dobro).
 */
export class LoyaltyTierDto {
  @IsString() @MaxLength(30) name: string;
  @IsNumber() @Min(0) minSpend: number;
  @IsNumber() @Min(0) @Max(100) discount: number;
  @IsNumber() @Min(0) @Max(10) pointsMultiplier: number;
}

export class BirthdayCouponDto {
  @IsBoolean() enabled: boolean;
  @IsNumber() @Min(0) @Max(100) discountPercent: number;
  @IsInt() @Min(1) @Max(365) validityDays: number;
}

export class UpdateLoyaltyConfigDto {
  // Liga/desliga o programa todo. Quando false, hooks de Order não creditam,
  // mas o saldo existente NÃO é zerado — fica congelado.
  @IsBoolean() enabled: boolean;

  // ── Pontos ──
  @IsNumber() @Min(0) @Max(100) pointsPerReal: number;       // 1 = 1 pt por R$1
  @IsNumber() @Min(0.001) @Max(1) realsPerPoint: number;     // 0.05 = 1 pt vale R$0.05
  @IsInt()   @Min(1)   @Max(60)   pointsExpiryMonths: number;
  @IsInt()   @Min(0)   @Max(100000) minRedeemPoints: number;

  // ── Cashback (% do valor do pedido vira saldo monetário) ──
  @IsNumber() @Min(0) @Max(50) cashbackPercent: number;
  @IsInt()    @Min(1) @Max(60) cashbackExpiryMonths: number;

  // ── Tiers ──
  @IsArray() @ValidateNested({ each: true }) @Type(() => LoyaltyTierDto)
  tiers: LoyaltyTierDto[];

  // ── Aniversário ──
  @ValidateNested() @Type(() => BirthdayCouponDto)
  birthdayCoupon: BirthdayCouponDto;

  // ── Referral ──
  @IsInt()    @Min(0) @Max(100000) referralBonusPoints: number;
  @IsNumber() @Min(0) @Max(10000)  referralBonusCashback: number;
}

export class AdjustLoyaltyDto {
  // Ajuste manual feito por admin — registra LoyaltyTransaction tipo ADJUST.
  // Aceita pontos ou cashback (zero pra ignorar). Reason obrigatório pra
  // rastreabilidade (vai pro extrato visível ao operador e cliente).
  @IsInt() points: number;     // pode ser negativo (debitar)
  @IsNumber() cashback: number; // pode ser negativo (debitar)
  @IsString() @MaxLength(200) reason: string;
}

export class PreviewRedeemDto {
  @IsInt() customerId: number;
  // Total do pedido em R$ — base pra calcular desconto máximo permitido.
  @IsNumber() @Min(0) orderAmount: number;
  // Pontos que o cliente quer aplicar (será limitado ao saldo + máximo do pedido).
  @IsOptional() @IsInt() @Min(0) points?: number;
  // Cashback que o cliente quer aplicar (idem).
  @IsOptional() @IsNumber() @Min(0) cashback?: number;
}
