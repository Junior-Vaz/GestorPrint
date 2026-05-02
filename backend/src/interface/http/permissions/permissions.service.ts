import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Catálogo canônico dos resources (telas/módulos do ERP). Adicione um
 * novo resource aqui quando criar uma tela nova — defaults serão aplicados
 * automaticamente na próxima consulta do admin via `seedDefaults`.
 *
 * Mantido como lista flat pra simplificar o storage (string em vez de enum).
 */
export const RESOURCES = [
  // Visão geral
  'home',
  // Operação
  'pdv', 'estimates', 'orders-board',
  // Cadastros
  'customers', 'products', 'suppliers',
  // Financeiro
  'financial', 'expenses', 'receivables', 'payables', 'reports',
  // Sistema
  'users', 'settings', 'audit', 'ai', 'permissions',
  // Ecommerce
  'ecommerce-dashboard', 'ecommerce-orders', 'ecommerce-catalog',
  'ecommerce-coupons', 'ecommerce-blog', 'ecommerce-site',
  'ecommerce-reviews', 'ecommerce-settings',
  // Engajamento — programa de fidelidade
  'loyalty',
] as const;

export type Resource = typeof RESOURCES[number];
export type Action = 'view' | 'create' | 'edit' | 'delete';
export const ROLES = ['ADMIN', 'SALES', 'PRODUCTION'] as const;
export type Role = typeof ROLES[number];

export interface PermissionRow {
  role:      Role;
  resource:  string;
  canView:   boolean;
  canCreate: boolean;
  canEdit:   boolean;
  canDelete: boolean;
}

/**
 * Defaults sensatos por role. `_` significa false, `V` view-only, `*` tudo
 * (view + create + edit + delete). Resources omitidos ficam com tudo false
 * (negados por padrão — princípio do least privilege).
 */
const DEFAULTS: Record<Role, Record<string, 'V' | '*' | 'VE' | 'VCE' | '_'>> = {
  ADMIN: {
    home: '*', pdv: '*', estimates: '*', 'orders-board': '*',
    customers: '*', products: '*', suppliers: '*',
    financial: '*', expenses: '*', receivables: '*', payables: '*', reports: '*',
    users: '*', settings: '*', audit: '*', ai: '*', permissions: '*',
    'ecommerce-dashboard': '*', 'ecommerce-orders': '*', 'ecommerce-catalog': '*',
    'ecommerce-coupons': '*', 'ecommerce-blog': '*', 'ecommerce-site': '*',
    'ecommerce-reviews': '*', 'ecommerce-settings': '*',
    loyalty: '*',
  },
  SALES: {
    home: 'V',
    pdv: '*', estimates: '*', 'orders-board': 'VE',
    customers: '*', products: 'V',
    financial: 'V', receivables: 'VE',
    'ecommerce-dashboard': 'V', 'ecommerce-orders': 'VE',
    'ecommerce-catalog': 'V', 'ecommerce-reviews': 'V',
    // Loyalty omitido pra SALES — operador NÃO precisa abrir a tela de
    // configuração da fidelidade. Aplicar resgate de pontos no PDV é
    // gateado por `orders.create`, que SALES já tem. Saldo do cliente
    // aparece no detalhe do cliente apenas pra quem tem `loyalty.view`
    // (admin do programa). Se uma gráfica quiser, pode liberar manualmente
    // pra SALES via tela de Permissões.
  },
  PRODUCTION: {
    home: 'V',
    'orders-board': 'VE',
    products: 'V',
    'ecommerce-orders': 'V',
  },
};

/** Expande o atalho ('V', '*', etc) num objeto de booleanos. */
function expandPreset(preset: 'V' | '*' | 'VE' | 'VCE' | '_'): Pick<PermissionRow, 'canView' | 'canCreate' | 'canEdit' | 'canDelete'> {
  switch (preset) {
    case '*':   return { canView: true,  canCreate: true,  canEdit: true,  canDelete: true  };
    case 'VCE': return { canView: true,  canCreate: true,  canEdit: true,  canDelete: false };
    case 'VE':  return { canView: true,  canCreate: false, canEdit: true,  canDelete: false };
    case 'V':   return { canView: true,  canCreate: false, canEdit: false, canDelete: false };
    case '_':
    default:    return { canView: false, canCreate: false, canEdit: false, canDelete: false };
  }
}

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Retorna a matriz completa do tenant (3 roles × N resources). */
  async getMatrix(tenantId: number): Promise<PermissionRow[]> {
    const rows = await (this.prisma as any).rolePermission.findMany({ where: { tenantId } });
    if (rows.length === 0) {
      // Tabela vazia → primeira vez, popula defaults e retorna.
      await this.seedDefaults(tenantId);
      return (this.prisma as any).rolePermission.findMany({ where: { tenantId } });
    }
    // Garante que NOVOS resources adicionados ao código apareçam mesmo em
    // tenants antigos — preenche o que está faltando, sem sobrescrever
    // o que o admin já editou.
    await this.fillMissingResources(tenantId, rows);
    return (this.prisma as any).rolePermission.findMany({ where: { tenantId } });
  }

  /** Permissões consolidadas pra um único user (role específica). */
  async getMyPermissions(tenantId: number, role: string): Promise<Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>> {
    const matrix = await this.getMatrix(tenantId);
    const mine = matrix.filter(r => r.role === role);
    const out: Record<string, any> = {};
    for (const r of mine) {
      out[r.resource] = {
        view:   r.canView,
        create: r.canCreate,
        edit:   r.canEdit,
        delete: r.canDelete,
      };
    }
    return out;
  }

  /** Verifica acesso programaticamente (usado pelo guard @CanAccess). */
  async check(tenantId: number, role: string, resource: string, action: Action): Promise<boolean> {
    const row = await (this.prisma as any).rolePermission.findUnique({
      where: { tenantId_role_resource: { tenantId, role, resource } },
    });
    if (!row) return false;
    return row[`can${action.charAt(0).toUpperCase() + action.slice(1)}`] === true;
  }

  /** Atualiza UM toggle. UI chama isso a cada checkbox clicado. */
  async update(
    tenantId: number,
    role: string,
    resource: string,
    field: 'canView' | 'canCreate' | 'canEdit' | 'canDelete',
    value: boolean,
  ) {
    await (this.prisma as any).rolePermission.upsert({
      where:  { tenantId_role_resource: { tenantId, role, resource } },
      update: { [field]: value },
      create: {
        tenantId, role, resource,
        canView: false, canCreate: false, canEdit: false, canDelete: false,
        [field]: value,
      },
    });
    // Audit — crítico pra compliance: quem mudou permissão de quem.
    await this.audit.logAction(
      null,
      'UPDATE',
      'RolePermission',
      undefined,
      { role, resource, field, value },
      tenantId,
    );
  }

  /** Reseta TUDO pros defaults. Chamado no botão "Restaurar padrão". */
  async resetToDefaults(tenantId: number) {
    await (this.prisma as any).rolePermission.deleteMany({ where: { tenantId } });
    await this.seedDefaults(tenantId);
    await this.audit.logAction(
      null,
      'RESET_DEFAULTS',
      'RolePermission',
      undefined,
      { scope: 'all_roles_all_resources' },
      tenantId,
    );
  }

  /** Popula defaults pra um tenant que ainda não tem nada. */
  async seedDefaults(tenantId: number) {
    const data: any[] = [];
    for (const role of ROLES) {
      for (const resource of RESOURCES) {
        const preset = DEFAULTS[role]?.[resource] || '_';
        data.push({ tenantId, role, resource, ...expandPreset(preset) });
      }
    }
    await (this.prisma as any).rolePermission.createMany({ data, skipDuplicates: true });
  }

  /** Adiciona resources que existem no código mas não estão no banco. */
  private async fillMissingResources(tenantId: number, existing: PermissionRow[]) {
    const present = new Set(existing.map(r => `${r.role}:${r.resource}`));
    const missing: any[] = [];
    for (const role of ROLES) {
      for (const resource of RESOURCES) {
        if (!present.has(`${role}:${resource}`)) {
          const preset = DEFAULTS[role]?.[resource] || '_';
          missing.push({ tenantId, role, resource, ...expandPreset(preset) });
        }
      }
    }
    if (missing.length > 0) {
      await (this.prisma as any).rolePermission.createMany({ data: missing, skipDuplicates: true });
    }
  }
}
