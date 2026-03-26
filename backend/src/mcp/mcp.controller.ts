import { Controller, Post, Body, Get, Patch, Delete, UseGuards, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { McpService } from './mcp.service';
import { PlansService } from '../plans/plans.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('mcp')
export class McpController {
  constructor(
    private readonly mcpService: McpService,
    private readonly plansService: PlansService,
  ) { }

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
        // If the AI agent sends tenantId, enforce hasWhatsapp feature
        if (body.tenantId) {
          await this.plansService.requireFeature(body.tenantId, 'hasWhatsapp');
        }
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

  // ─── Flow Builder Endpoints ─────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('flow-config')
  getFlowConfig(@CurrentTenant() tenantId: number) {
    return this.mcpService.getFlowConfig(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('flow-config')
  updateFlowConfig(@Body() body: { nodes: any[]; edges: any[] }, @CurrentTenant() tenantId: number) {
    return this.mcpService.updateFlowConfig(body, tenantId);
  }

  // Flow session endpoints — called by whatsapp-ai service with internal key
  @Public()
  @Get('flow-session/:tenantId/:phone')
  getFlowSession(
    @Param('tenantId') tenantId: string,
    @Param('phone') phone: string,
    @Headers('x-internal-key') key: string,
  ) {
    this.validateInternalKey(key);
    return this.mcpService.getFlowSession(+tenantId, phone);
  }

  @Public()
  @Patch('flow-session/:tenantId/:phone')
  upsertFlowSession(
    @Param('tenantId') tenantId: string,
    @Param('phone') phone: string,
    @Body() body: { currentNodeId: string; collectedData: any },
    @Headers('x-internal-key') key: string,
  ) {
    this.validateInternalKey(key);
    return this.mcpService.upsertFlowSession(+tenantId, phone, body);
  }

  @Public()
  @Delete('flow-session/:tenantId/:phone')
  deleteFlowSession(
    @Param('tenantId') tenantId: string,
    @Param('phone') phone: string,
    @Headers('x-internal-key') key: string,
  ) {
    this.validateInternalKey(key);
    return this.mcpService.deleteFlowSession(+tenantId, phone);
  }

  @Public()
  @Post('flow-pix')
  async calculateAndPix(
    @Body() body: { tenantId: number; productRef: string; quantity: number; customerId?: number },
    @Headers('x-internal-key') key: string,
  ) {
    this.validateInternalKey(key);
    return this.mcpService.calculateAndPix(body.tenantId, body.productRef, body.quantity, body.customerId);
  }

  @Public()
  @Post('flow-preview')
  async flowPreview(@Body() body: any) {
    const whatsappAiUrl = process.env.WHATSAPP_AI_URL || 'http://localhost:3005';
    try {
      const res = await fetch(`${whatsappAiUrl}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.json();
    } catch {
      return { response: '⚠️ Serviço de IA não está rodando. Inicie o whatsapp-ai (porta 3005) para usar o preview real.' };
    }
  }

  // Create estimate from flow session — handles customer lookup/creation + price calculation
  @Public()
  @Post('flow-estimate')
  async createFlowEstimate(
    @Body() body: { tenantId: number; collectedData: Record<string, any> },
    @Headers('x-internal-key') key: string,
  ) {
    this.validateInternalKey(key);
    return this.mcpService.createEstimateFromFlow(body.tenantId, body.collectedData);
  }

  // Internal config endpoint — used by whatsapp-ai service (no JWT, x-internal-key required)
  @Public()
  @Get('config-internal')
  getConfigInternal(
    @Headers('x-internal-key') key: string,
    @Headers('x-tenant-id') tenantIdHeader: string,
  ) {
    this.validateInternalKey(key);
    return this.mcpService.getAiConfig(+(tenantIdHeader || '1'));
  }

  private validateInternalKey(key: string) {
    const expected = process.env.INTERNAL_API_KEY || 'gestorprint-internal-2026';
    if (key !== expected) throw new UnauthorizedException('Invalid internal key');
  }
}
