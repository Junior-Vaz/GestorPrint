import {
  Controller,
  Get,
  Body,
  Patch,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { MessagingService } from '../messaging/messaging.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { IStorageProvider, STORAGE_PROVIDER } from '../../../infrastructure/storage/storage.interface';

const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5 MB

@ApiTags('settings')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly messagingService: MessagingService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  @Get()
  @CanAccess('settings', 'view')
  getSettings(@CurrentTenant() tenantId: number) {
    return this.settingsService.getSettings(tenantId);
  }

  /**
   * GET /settings/public — subconjunto liberado pra qualquer role autenticada
   * (sem `@CanAccess('settings','view')`). Retorna companyName, logoUrl,
   * phone, cnpj e businessHours. Necessário porque o Kanban exibido pra
   * PRODUCTION operator usa companyName na mensagem do WhatsApp do cliente,
   * mas PRODUCTION não tem permissão pra ver Settings completas.
   *
   * Declarado ANTES de qualquer @Get(':id') ou outras rotas dinâmicas pra
   * evitar conflito de match.
   */
  @Get('public')
  getPublicSettings(@CurrentTenant() tenantId: number) {
    return this.settingsService.getPublicSettings(tenantId);
  }

  @Patch()
  @CanAccess('settings', 'edit')
  updateSettings(@Body() updateData: UpdateSettingsDto, @CurrentTenant() tenantId: number) {
    return this.settingsService.updateSettings(updateData, tenantId);
  }

  @Patch('pricing')
  @CanAccess('settings', 'edit')
  updatePricing(@Body() pricingConfig: any, @CurrentTenant() tenantId: number) {
    return this.settingsService.updatePricingConfig(pricingConfig, tenantId);
  }

  /** Testa conexão SMTP sem enviar email — usa transporter.verify(). */
  @Post('test-smtp')
  @CanAccess('settings', 'edit')
  async testSmtp(@CurrentTenant() tenantId: number) {
    return this.messagingService.verifySmtp(tenantId);
  }

  /** Envia um email de teste pra confirmar fluxo end-to-end. */
  @Post('test-smtp-send')
  @CanAccess('settings', 'edit')
  async testSmtpSend(
    @Body() body: { to: string },
    @CurrentTenant() tenantId: number,
  ) {
    if (!body?.to?.trim()) throw new BadRequestException('Email destinatário obrigatório.');
    return this.messagingService.verifyAndSend(
      body.to.trim(),
      'Teste de SMTP — GestorPrint',
      `<p>Funcionou! Sua configuração de SMTP está OK.</p>
       <p>Esse é um email de teste enviado em ${new Date().toLocaleString('pt-BR')}.</p>`,
      tenantId,
    );
  }

  @Post('logo')
  @CanAccess('settings', 'edit')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_LOGO_SIZE },
    }),
  )
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentTenant() tenantId: number,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');

    const tenantUuidRow = await this.settingsService.getTenantUuid(tenantId);
    const stored = await this.storage.save(file.buffer, tenantUuidRow, file.originalname);
    const logoUrl = stored.publicUrl;

    await this.settingsService.updateSettings({ logoUrl }, tenantId);
    return { logoUrl };
  }
}
