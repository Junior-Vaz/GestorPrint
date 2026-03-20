import { IsIn } from 'class-validator';

export class CreateSubscriptionDto {
  @IsIn(['PIX', 'BOLETO'])
  billingType: string;
}
