import { Module } from '@nestjs/common';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyCron } from './loyalty.cron';
import { LoyaltyMailerService } from './loyalty-mailer.service';
import { MessagingModule } from '../messaging/messaging.module';

/**
 * LoyaltyModule — Programa de Fidelidade.
 *
 * Dependências externas (resolvidas via SharedModule @Global):
 *  - PrismaService
 *  - CheckFeatureUseCase
 *
 * Exporta LoyaltyService pra ser consumido por:
 *  - OrdersService (hook de credit no fechamento de pedido)
 *  - EcommerceOrdersService (idem)
 *  - EcommerceCheckoutController (preview/apply redeem do cliente final logado)
 *  - CustomersService (apply referral code no signup)
 */
@Module({
  // MessagingModule exporta MessagingService (já consumido por outros módulos
  // do projeto — Settings, MCP, Estimates). Importar aqui evita duplicar
  // instância do nodemailer transporter.
  imports:     [MessagingModule],
  controllers: [LoyaltyController],
  providers:   [LoyaltyService, LoyaltyCron, LoyaltyMailerService],
  exports:     [LoyaltyService],
})
export class LoyaltyModule {}
