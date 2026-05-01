import {
  BadRequestException, Body, Controller, Delete,
  Get, Param, ParseIntPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformOnlyGuard } from './platform-only.guard';

/**
 * CRUD de PLATFORM users — equipe da plataforma SaaS.
 *
 * Acesso: apenas usuários PLATFORM. JwtAuthGuard (autenticação) + PlatformOnlyGuard
 * (PLATFORM check) garantem que TENANT users sejam barrados aqui mesmo se
 * tiverem JWT válido. Não usa o RBAC do tenant porque PLATFORM users não
 * pertencem a nenhum tenant operacional.
 *
 * Convenção de URL: `/api/platform-users` (não `/users`) pra deixar claro
 * que é tela do SaaS Admin Panel, não do ERP.
 */
@ApiTags('platform-users')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PlatformOnlyGuard)
@Controller('platform-users')
export class PlatformUsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os PLATFORM users' })
  async list(): Promise<any[]> {
    // Sem paginação — equipe da plataforma é pequena (< 50 users tipicamente).
    const users = await (this.prisma as any).user.findMany({
      where: { userType: 'PLATFORM' },
      select: {
        id: true, name: true, email: true, role: true, photoUrl: true,
        isActive: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return users;
  }

  @Post()
  @ApiOperation({ summary: 'Cria um novo PLATFORM user' })
  async create(@Body() body: any) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email e senha são obrigatórios');
    }
    if (body.password.length < 6) {
      throw new BadRequestException('Senha precisa ter pelo menos 6 caracteres');
    }

    // Email único entre PLATFORM users (independente do unique compound do schema,
    // que considera (email, tenantId, userType)). Aqui filtramos por userType
    // explicitamente pra mensagem amigável em vez de erro genérico do Prisma.
    const existing = await (this.prisma as any).user.findFirst({
      where: { email: body.email, userType: 'PLATFORM' },
    });
    if (existing) {
      throw new BadRequestException('Email já cadastrado na equipe da plataforma');
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);
    const user = await (this.prisma as any).user.create({
      data: {
        email:        body.email,
        password:     hashedPassword,
        name:         body.name || body.email,
        phone:        body.phone || null,
        photoUrl:     body.photoUrl || null,
        role:         'ADMIN',     // legado, ignorado pra PLATFORM
        tenantId:     1,           // ghost tenant da plataforma
        userType:     'PLATFORM',
        isSuperAdmin: true,        // legado, sincronizado
        isActive:     true,
      },
      select: {
        id: true, name: true, email: true, photoUrl: true, isActive: true,
      },
    });
    return user;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza dados ou senha de um PLATFORM user' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const target = await (this.prisma as any).user.findUnique({
      where: { id },
      select: { id: true, userType: true },
    });
    if (!target || target.userType !== 'PLATFORM') {
      throw new BadRequestException('Usuário não encontrado na equipe da plataforma');
    }

    // Filtra campos editáveis — não deixa mexer em userType, tenantId, role.
    const { password, name, email, phone, photoUrl, isActive } = body;
    const data: any = {};
    if (name      !== undefined) data.name      = name;
    if (email     !== undefined) data.email     = email;
    if (phone     !== undefined) data.phone     = phone;
    if (photoUrl  !== undefined) data.photoUrl  = photoUrl;
    if (isActive  !== undefined) data.isActive  = isActive;
    if (password) {
      if (password.length < 6) throw new BadRequestException('Senha precisa ter pelo menos 6 caracteres');
      data.password = await bcrypt.hash(password, 10);
    }

    return (this.prisma as any).user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, photoUrl: true, isActive: true },
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um PLATFORM user (não deixa zerar)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    // Salvaguarda crítica: nunca deleta o ÚLTIMO PLATFORM user — senão o SaaS
    // Admin fica inacessível e ninguém consegue logar pra criar outro.
    const total = await (this.prisma as any).user.count({ where: { userType: 'PLATFORM' } });
    if (total <= 1) {
      throw new BadRequestException('Não é possível remover o último membro da equipe da plataforma');
    }

    const target = await (this.prisma as any).user.findUnique({
      where: { id },
      select: { id: true, userType: true },
    });
    if (!target || target.userType !== 'PLATFORM') {
      throw new BadRequestException('Usuário não encontrado na equipe da plataforma');
    }

    await (this.prisma as any).user.delete({ where: { id } });
    return { ok: true };
  }
}
