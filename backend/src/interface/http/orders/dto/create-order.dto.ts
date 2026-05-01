import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsInt, Min, MaxLength, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @ApiProperty({ example: 'João Silva', description: 'Name of the customer (fallback when customerId not provided)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  customerName: string;

  // Quando o frontend já tem o cliente selecionado (PDV/checkout), envia o ID
  // direto pra evitar lookup ambíguo por nome (clientes com nomes iguais
  // resolveriam pra o primeiro cadastrado, jogando pontos no cliente errado).
  // customerName continua obrigatório como fallback (ex: AI agent criando
  // cliente novo via WhatsApp pelo nome).
  @ApiProperty({ required: false, description: 'Existing customer ID — preferido sobre lookup por nome' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  customerId?: number;

  @ApiProperty({ example: 'Cartão de Visita - 4x4 - Couchê 300g', description: 'Details about the printing job' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  productDescription: string;

  @ApiProperty({ example: 150.0, description: 'Total value of the order' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: true, required: false, description: 'Whether this order was created via the Point of Sale interface' })
  @IsOptional()
  @IsBoolean()
  isPdv?: boolean;

  @ApiProperty({ required: false, description: 'JSON details containing cart items or estimate specs' })
  @IsOptional()
  details?: any;

  @ApiProperty({ required: false, description: 'Reference ID of the originating estimate' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  estimateId?: number;

  @ApiProperty({ example: 'DINHEIRO', required: false, description: 'Payment method for PDV sales' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  paymentMethod?: string;

  @ApiProperty({ required: false, description: 'ID of the salesperson' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  salespersonId?: number;

  @ApiProperty({ required: false, description: 'ID of the producer' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  producerId?: number;

  // ── Programa de Fidelidade — resgate aplicado neste pedido ────────────────
  // Quando o operador (PDV) ou cliente (ecommerce) escolhe usar pontos/cashback
  // pra pagar parte do pedido, esses campos chegam aqui. O service valida saldo,
  // chama LoyaltyService.applyRedeem (que debita do saldo + grava no order).
  // Backend é a autoridade — frontend só sugere via preview-redeem.
  @ApiProperty({ required: false, description: 'Pontos de fidelidade aplicados como desconto' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  pointsRedeemed?: number;

  @ApiProperty({ required: false, description: 'Cashback (R$) aplicado como desconto' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cashbackRedeemed?: number;
}
