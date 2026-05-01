import { BadRequestException, Body, Controller, ForbiddenException, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import {
  PlatformSettingsService,
  PLATFORM_SETTING_KEYS,
  PlatformSettingKey,
} from '../../../shared/platform-settings.service';

interface UpdateBody {
  [key: string]: string | undefined;
}

/**
 * Endpoints exclusivos do super admin (isSuperAdmin=true no JWT).
 *
 * GET retorna todas as configs com secrets mascarados (****1234).
 * PUT aceita um objeto parcial { chave: valor } e atualiza só as chaves
 * presentes. Valor vazio remove a chave do DB (volta a usar env fallback).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/platform-settings')
export class PlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  @CanAccess('settings', 'view')
  async getAll(@Req() req: any) {
    this.assertSuperAdmin(req);
    return this.settings.getMaskedAll();
  }

  @Put()
  @CanAccess('settings', 'edit')
  async update(@Req() req: any, @Body() body: UpdateBody) {
    this.assertSuperAdmin(req);
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Payload inválido');
    }

    // Valida chaves: rejeita qualquer chave que não esteja no catálogo
    const validKeys = Object.keys(PLATFORM_SETTING_KEYS) as PlatformSettingKey[];
    const updates: Partial<Record<PlatformSettingKey, string>> = {};
    for (const k of Object.keys(body)) {
      if (!validKeys.includes(k as PlatformSettingKey)) {
        throw new BadRequestException(`Chave desconhecida: ${k}`);
      }
      const v = body[k];
      // Aceita undefined (ignora) ou string (sobrescreve, vazio remove)
      if (typeof v === 'string') {
        updates[k as PlatformSettingKey] = v.trim();
      }
    }

    const userId = req?.user?.id;
    await this.settings.setMany(updates, userId);
    return { ok: true, updatedKeys: Object.keys(updates) };
  }

  /**
   * Configurações da plataforma ficam acessíveis somente ao super admin
   * (isSuperAdmin=true no JWT). Mesmo que a UI esconda o link, garantimos no backend.
   */
  private assertSuperAdmin(req: any) {
    const u = req?.user;
    if (!u || !u.isSuperAdmin) {
      throw new ForbiddenException('Apenas o super admin pode acessar');
    }
  }
}
