import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { McpModule } from '../mcp/mcp.module';

/**
 * WhatsappModule — agente IA do canal WhatsApp.
 *
 * Substitui o serviço externo `ai-agent/` (que rodava em outra porta e
 * batia no backend via HTTP). Agora é tudo in-process:
 *   - Webhook Evolution → WhatsappController.webhook
 *   - Processamento → WhatsappService.processMessage (Vercel AI SDK + MCP)
 *   - Resposta → WhatsappService.sendText (Evolution API)
 *
 * Reaproveita McpService.toolsCatalog/callTool — mesmas 24 tools do chat ERP,
 * só que com contexto 'whatsapp' (aplica restrições do AiConfig).
 */
@Module({
  imports:     [McpModule],
  controllers: [WhatsappController],
  providers:   [WhatsappService],
  exports:     [WhatsappService],
})
export class WhatsappModule {}
