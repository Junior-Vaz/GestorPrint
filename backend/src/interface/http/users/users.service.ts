import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { PaginationDto, PaginatedResult, paginateResult } from '../../../shared/dto/pagination.dto';

/**
 * UsersService — gerencia equipe da gráfica (tela "Usuários" no ERP).
 *
 * SEGURANÇA — proteção contra ataque a super admin:
 * Super admins são internos da plataforma SaaS (gerenciados via SaaS Admin
 * panel, não pelo ERP do tenant). Esta service ESCONDE super admins do listing
 * e BLOQUEIA mutations contra eles, mesmo se o requisitante for admin do mesmo
 * tenant. Justificativa: tenant 1 hospeda os super admins, e qualquer ADMIN
 * desse tenant é promovido a super admin pelo onModuleInit do AuthService —
 * mas ainda assim alguém com escalation lateral (ex: SALES promovido a ADMIN)
 * teria acesso. Defesa em profundidade.
 *
 * Regras:
 *  - findAll/findOne: filtra `isSuperAdmin: true` da listagem
 *  - update/remove: rejeita se alvo é super admin (independe do requester)
 *  - create: rejeita se data.role === 'ADMIN' E tenantId === 1 (super admin
 *    só nasce via seed/SaaS Admin, não via UI do ERP)
 *
 * O super admin pode editar a si mesmo via /api/auth/profile (rota separada
 * que não usa este service), e ser gerenciado via SaaS Admin panel que tem
 * suas próprias rotas.
 */
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: number, dto: PaginationDto): Promise<PaginatedResult<any>> {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const { search, status: role } = dto;
    const skip = (page - 1) * limit;

    // SEGURANÇA: super admins NUNCA aparecem na gestão de equipe do ERP.
    // Mesmo um admin do tenant 1 (que é super admin pela regra de promoção)
    // não vê outros super admins no listing.
    //
    // O campo `isSuperAdmin` é Boolean @default(false) no schema — não-nullable —
    // então `userType: 'TENANT'` cobre todos os admins normais (Prisma rejeita
    // null porque viola o tipo).
    const where: any = { tenantId, userType: 'TENANT' };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;

    const [users, total] = await (this.prisma as any).$transaction([
      (this.prisma as any).user.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      (this.prisma as any).user.count({ where }),
    ]);

    const data = users.map((user: any) => { const { password, ...rest } = user; return rest; });
    return paginateResult(data, total, page, limit);
  }

  async findOne(id: number, tenantId: number) {
    // Mesma regra: lookup direto também esconde super admin (sem isso, alguém
    // que adivinha o id retornaria via findOne).
    const user = await (this.prisma as any).user.findFirst({
      where: { id, tenantId, userType: 'TENANT' },
    });
    if (user) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async create(data: any, tenantId: number) {
    // ── Plan limits ────────────────────────────────────────────────────────
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { maxUsers: true, isActive: true, planStatus: true },
    });
    if (!tenant?.isActive || ['SUSPENDED', 'CANCELLED'].includes(tenant.planStatus)) {
      throw new ForbiddenException('Conta suspensa ou cancelada. Entre em contato com o suporte.');
    }
    // Conta só usuários "normais" da equipe — super admins do tenant 1 são
    // internos da plataforma, não contam pra quota da gráfica.
    const userCount = await (this.prisma as any).user.count({ where: { tenantId, userType: 'TENANT' } });
    if (userCount >= tenant.maxUsers) {
      throw new ForbiddenException(
        `Limite de ${tenant.maxUsers} usuário(s) atingido. Faça upgrade do seu plano.`,
      );
    }

    // SEGURANÇA: bloqueia criação de novo ADMIN no tenant 1 via UI do ERP.
    // Tenant 1 é da plataforma — admins novos lá viram super admins pelo
    // onModuleInit, então só podem ser criados via processo controlado
    // (seed inicial ou SaaS Admin panel).
    if (tenantId === 1 && data.role === 'ADMIN') {
      throw new ForbiddenException(
        'Criação de ADMIN no tenant da plataforma não é permitida via ERP. Use o painel SaaS Admin.',
      );
    }

    // SEGURANÇA: nunca aceita isSuperAdmin=true vindo do body — esse flag
    // só pode ser setado via seed/onModuleInit ou SaaS Admin panel.
    const { isSuperAdmin: _ignore, ...safeData } = data;

    const hashedPassword = await bcrypt.hash(safeData.password || 'mudar123', 10);
    return (this.prisma as any).user.create({
      data: {
        ...safeData,
        tenantId,
        password: hashedPassword,
        userType: 'TENANT', // sempre false pra usuários criados via ERP
      },
    });
  }

  async update(id: number, data: any, tenantId: number) {
    // SEGURANÇA: pega o user alvo PRIMEIRO pra checar se é super admin.
    // Sem essa checagem, um admin do tenant 1 conseguiria trocar senha de
    // qualquer super admin (incluindo o seu próprio) via UI do ERP — abrindo
    // brecha pra account takeover.
    const target = await (this.prisma as any).user.findFirst({
      where: { id, tenantId },
      select: { id: true, userType: true, role: true },
    });
    if (!target) throw new NotFoundException('Usuário não encontrado neste tenant');
    // Defesa em camadas: o filtro `userType: 'TENANT'` em findFirst já bloqueia,
    // mas mantemos check explícito caso o filtro mude no futuro.
    if (target.userType === 'PLATFORM') {
      throw new ForbiddenException(
        'Membros da plataforma são gerenciados via SaaS Admin. Use o painel da plataforma.',
      );
    }

    // SEGURANÇA: nunca aceita isSuperAdmin no body — flag protegida.
    const { isSuperAdmin: _, ...safeData } = data;

    const updateData: any = { ...safeData };
    if (safeData.password) {
      updateData.password = await bcrypt.hash(safeData.password, 10);
    } else {
      delete updateData.password;
    }

    return (this.prisma as any).user.updateMany({
      where: { id, tenantId, userType: 'TENANT' },
      data: updateData,
    });
  }

  async remove(id: number, tenantId: number) {
    // SEGURANÇA: bloqueia delete de super admin antes de qualquer outra checagem.
    // Mesmo um requester super admin não deve deletar via ERP — usa SaaS Admin.
    const target = await (this.prisma as any).user.findFirst({
      where: { id, tenantId },
      select: { id: true, role: true, userType: true },
    });
    if (!target) throw new NotFoundException('Usuário não encontrado neste tenant');
    if (target.userType === 'PLATFORM') {
      throw new ForbiddenException(
        'Membros da plataforma não podem ser removidos via ERP.',
      );
    }

    // Não deixa o tenant ficar sem nenhum admin (regra antiga, mantida).
    if (target.role === 'ADMIN') {
      const adminCount = await (this.prisma as any).user.count({
        where: { role: 'ADMIN', tenantId, userType: 'TENANT' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Não é possível excluir o único administrador do sistema.');
      }
    }

    return (this.prisma as any).user.deleteMany({
      where: { id, tenantId, userType: 'TENANT' },
    });
  }
}
