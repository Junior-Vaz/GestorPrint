import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { PermissionsService } from './permissions.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly svc: PermissionsService) {}

  /** Permissões do user logado — chamado no boot do frontend. Qualquer role. */
  @Get('me')
  async getMine(
    @CurrentTenant() tenantId: number,
    @Request() req: any,
  ) {
    const user = req.user as { role: string; isSuperAdmin?: boolean };
    // Super admin tem permissão total em tudo, sem precisar consultar matriz
    if (user.isSuperAdmin) {
      return { role: 'ADMIN', permissions: 'all', superAdmin: true };
    }
    const permissions = await this.svc.getMyPermissions(tenantId, user.role);
    return { role: user.role, permissions };
  }

  /** Matriz completa pra tela admin. Só ADMIN. */
  @Get()
  @Roles('ADMIN')
  getMatrix(@CurrentTenant() tenantId: number) {
    return this.svc.getMatrix(tenantId);
  }

  /** Atualiza um toggle específico. Só ADMIN. */
  @Patch(':role/:resource')
  @Roles('ADMIN')
  async update(
    @CurrentTenant() tenantId: number,
    @Param('role') role: string,
    @Param('resource') resource: string,
    @Body() body: { field: 'canView' | 'canCreate' | 'canEdit' | 'canDelete'; value: boolean },
  ) {
    if (!['canView', 'canCreate', 'canEdit', 'canDelete'].includes(body.field)) {
      return { ok: false, error: 'Campo inválido' };
    }
    await this.svc.update(tenantId, role, resource, body.field, !!body.value);
    return { ok: true };
  }

  /** Restaura defaults. Só ADMIN. */
  @Post('reset')
  @Roles('ADMIN')
  async reset(@CurrentTenant() tenantId: number) {
    await this.svc.resetToDefaults(tenantId);
    return { ok: true };
  }
}
