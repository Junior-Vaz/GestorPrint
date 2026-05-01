import { Module } from '@nestjs/common';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { McpModule } from '../mcp/mcp.module';

/**
 * AiChatModule — agente IA do **ERP** (chat operacional).
 *
 * Reaproveita o McpService (do McpModule) pra executar as 16 tools.
 * Não tem nada a ver com a Evolution API ou WhatsApp — só fala diretamente
 * com Gemini e com o ERP via tools.
 */
@Module({
  imports:     [McpModule],
  controllers: [AiChatController],
  providers:   [AiChatService],
})
export class AiChatModule {}
