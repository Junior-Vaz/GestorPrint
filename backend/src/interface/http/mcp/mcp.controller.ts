import { Controller, Post, Body, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { McpService } from './mcp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { PROVIDER_MODELS, PROVIDER_INFO } from '../../../shared/ai-provider.factory';

/**
 * MCP (Model Context Protocol) — server de configuração da IA + integração
 * Evolution API. Tools (40+ funções) ficam no McpService e são usadas pelos
 * dois agentes (chat ERP e WhatsApp).
 *
 * Endpoints HTTP (todos ADMIN-only):
 *   GET/PATCH /mcp/config       — CRUD da AiConfig (UI ERP)
 *   GET /mcp/providers          — catálogo de providers + modelos
 *   /mcp/evolution/*            — proxy Evolution API (status, connect, etc)
 */
@ApiTags('mcp')
@ApiBearerAuth('JWT')
@Controller('mcp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class McpController {
  constructor(
    private readonly mcpService: McpService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════
  // AiConfig CRUD (UI do ERP)
  // ════════════════════════════════════════════════════════════════════════
  @Get('config')
  @CanAccess('ai', 'view')
  getConfig(@CurrentTenant() tenantId: number) {
    return this.mcpService.getAiConfig(tenantId);
  }

  /**
   * Lista de providers e seus modelos suportados — usado pelo AiView pra
   * popular dropdowns dinâmicos. Retorna shape:
   *   { providers: [{value, label, consoleUrl, models: [{value, label}]}] }
   */
  @Get('providers')
  @CanAccess('ai', 'view')
  listProviders() {
    const providers = (Object.keys(PROVIDER_INFO) as Array<keyof typeof PROVIDER_INFO>).map(key => ({
      value:      key,
      label:      PROVIDER_INFO[key].label,
      consoleUrl: PROVIDER_INFO[key].consoleUrl,
      models:     PROVIDER_MODELS[key],
    }));
    return { providers };
  }

  @Patch('config')
  @CanAccess('ai', 'edit')
  updateConfig(@Body() body: any, @CurrentTenant() tenantId: number) {
    return this.mcpService.updateAiConfig(body, tenantId);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Evolution API
  // ════════════════════════════════════════════════════════════════════════
  @Get('evolution/status')
  @CanAccess('ai', 'view')
  getEvolutionStatus(@CurrentTenant() tenantId: number) {
    return this.mcpService.getEvolutionStatus(tenantId);
  }

  @Post('evolution/connect')
  @CanAccess('ai', 'edit')
  connectEvolution(@CurrentTenant() tenantId: number) {
    return this.mcpService.connectEvolution(tenantId);
  }

  @Post('evolution/logout')
  @CanAccess('ai', 'edit')
  logoutEvolution(@CurrentTenant() tenantId: number) {
    return this.mcpService.logoutEvolution(tenantId);
  }

  @Post('evolution/restart')
  @CanAccess('ai', 'edit')
  restartEvolution(@CurrentTenant() tenantId: number) {
    return this.mcpService.restartEvolution(tenantId);
  }

  /** Retorna webhook atualmente configurado na Evolution (vs local no AiConfig). */
  @Get('evolution/webhook')
  @CanAccess('ai', 'view')
  getEvolutionWebhook(@CurrentTenant() tenantId: number) {
    return this.mcpService.getEvolutionWebhook(tenantId);
  }

  /**
   * Seta/atualiza o webhook na Evolution API. Se url vazio, usa default
   * (API_URL + /api/whatsapp/webhook). Eventos default: MESSAGES_UPSERT.
   */
  @Post('evolution/webhook')
  @CanAccess('ai', 'edit')
  setEvolutionWebhook(
    @Body() body: { url?: string; events?: string[] },
    @CurrentTenant() tenantId: number,
  ) {
    return this.mcpService.setEvolutionWebhook(body || {}, tenantId);
  }

}
