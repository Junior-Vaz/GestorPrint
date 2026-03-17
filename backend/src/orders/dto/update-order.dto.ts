import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @ApiProperty({ example: 'PRODUCTION', description: 'Current status of the order', required: false })
  status?: string;
}
