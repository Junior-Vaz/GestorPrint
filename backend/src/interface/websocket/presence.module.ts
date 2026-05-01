import { Module } from '@nestjs/common';
import { PresenceGateway } from './presence.gateway';

/**
 * Módulo isolado pro gateway de presença em tempo real. Pequeno propositalmente
 * — só wraps o gateway pra ele aparecer no DI graph e ser instanciado pelo Nest
 * quando o app sobe. Sem service/controller (estado vive no próprio gateway).
 */
@Module({
  providers: [PresenceGateway],
  exports:   [PresenceGateway],
})
export class PresenceModule {}
