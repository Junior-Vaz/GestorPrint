import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';

/**
 * DTO MINIMAL de propósito — aceita qualquer array; o service filtra/coage
 * os elementos pra inteiros válidos. Tentativas de validar `@IsInt({ each })`
 * + `@Type(() => Number)` causavam "Validation failed (numeric string is
 * expected)" quando entradas vinham como string/null/NaN do localStorage.
 *
 * Princípio: no border, aceita o lixo. No service, normaliza.
 */
export class SyncWishlistDto {
  @ApiProperty({
    type: [Number],
    description: 'IDs dos produtos do localStorage do guest pra mergear no servidor. Strings são aceitas e convertidas.',
    example: [12, 47, 103],
    required: false,
    default: [],
  })
  @IsOptional()
  @IsArray()
  productIds?: any[];
}
