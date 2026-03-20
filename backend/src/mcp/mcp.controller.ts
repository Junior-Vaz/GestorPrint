import { Controller, Post, Body, Get, Patch, UseGuards } from '@nestjs/common';
import { McpService } from './mcp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) { }

  @Post('rpc')
  async handleRpc(@Body() body: any) {
    const { method, params } = body;

    switch (method) {
      case 'tools/list':
        return {
          tools: [
            {
              name: 'get_inventory',
              description: 'Lista todos os insumos (papéis, acabamentos) e preços disponíveis na gráfica.',
              inputSchema: { type: 'object', properties: {} }
            },
            {
              name: 'get_order_status',
              description: 'Consulta o status de produção e pagamento de um pedido específico.',
              inputSchema: {
                type: 'object',
                properties: {
                  orderId: { type: 'number', description: 'O ID numérico do pedido (ex: 123)' }
                },
                required: ['orderId']
              }
            },
            {
              name: 'create_estimate',
              description: 'Cria um novo rascunho de orçamento no sistema.',
              inputSchema: {
                type: 'object',
                properties: {
                  customerId: { type: 'number' },
                  totalPrice: { type: 'number' },
                  details: { type: 'object' }
                },
                required: ['customerId', 'totalPrice', 'details']
              }
            },
            {
              name: 'generate_pix',
              description: 'Gera um QR Code Pix para um pedido. Use após o cliente confirmar o orçamento.',
              inputSchema: {
                type: 'object',
                properties: {
                  orderId: { type: 'number', description: 'O ID do pedido ou orçamento convertido.' }
                },
                required: ['orderId']
              }
            },
            {
              name: 'upload_artwork',
              description: 'Faz o upload de uma arte ou foto enviada pelo cliente.',
              inputSchema: {
                type: 'object',
                properties: {
                  orderId: { type: 'number' },
                  base64: { type: 'string', description: 'Conteúdo do arquivo em Base64' },
                  filename: { type: 'string' },
                  mimetype: { type: 'string' }
                },
                required: ['orderId', 'base64', 'filename', 'mimetype']
              }
            }
          ]
        };

      case 'tools/call':
        return this.callTool(params.name, params.arguments);

      default:
        return { error: `Metodo ${method} não suportado` };
    }
  }

  private async callTool(name: string, args: any) {
    try {
      switch (name) {
        case 'get_inventory':
          const inventory = await this.mcpService.getInventory();
          return { content: [{ type: 'text', text: JSON.stringify(inventory) }] };

        case 'get_order_status':
          const status = await this.mcpService.getOrderStatus(args.orderId);
          return { content: [{ type: 'text', text: JSON.stringify(status) }] };

        case 'create_estimate':
          const estimate = await this.mcpService.createEstimateDraft(args);
          return { content: [{ type: 'text', text: `Orçamento #${estimate.id} criado com sucesso!` }] };

        case 'generate_pix':
          const pix = await this.mcpService.generatePix(args.orderId);
          return {
            content: [
              { type: 'text', text: `Pix gerado com sucesso!` },
              { type: 'text', text: `Chave Copia e Cola: ${pix.qrCode}` },
              { type: 'text', text: `Link do QR Code: ${pix.paymentUrl}` }
            ]
          };

        case 'upload_artwork':
          const buffer = Buffer.from(args.base64, 'base64');
          await this.mcpService.saveArtwork(args.orderId, {
            buffer,
            originalname: args.filename,
            mimetype: args.mimetype
          });
          return { content: [{ type: 'text', text: `Arquivo ${args.filename} anexado ao pedido #${args.orderId}!` }] };

        default:
          return { error: `Ferramenta ${name} não encontrada` };
      }
    } catch (e: any) {
      return { error: e.message };
    }
  }

  // AI Configuration Endpoints (Dashboard)
  @UseGuards(JwtAuthGuard)
  @Get('config')
  getConfig(@CurrentTenant() tenantId: number) {
    return this.mcpService.getAiConfig(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('config')
  updateConfig(@Body() body: any, @CurrentTenant() tenantId: number) {
    return this.mcpService.updateAiConfig(body, tenantId);
  }
}
