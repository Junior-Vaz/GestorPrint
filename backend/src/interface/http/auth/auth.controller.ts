import { Controller, Post, Body, Get, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @Post('login')
  @ApiOperation({
    summary: 'Login do ERP (operadores de gráfica)',
    description: 'Apenas usuários TENANT — operadores de gráfica. ' +
                 'PLATFORM users (equipe da plataforma) devem usar /auth/saas-login.',
  })
  @ApiResponse({ status: 201, description: 'Login OK — retorna access_token e dados do user.' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  @ApiResponse({ status: 403, description: 'Conta suspensa ou cancelada' })
  async login(@Body() body: LoginDto) {
    // expectedType='TENANT' — só aceita operadores de gráfica.
    // PLATFORM users tentando logar aqui caem em "credenciais inválidas"
    // (não revelamos que existe um SaaS Admin separado pra defesa em camadas).
    const user = await this.authService.validateUser(body.email, body.password, 'TENANT');
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.authService.login(user);
  }

  /**
   * Login dedicado do SaaS Admin Panel — só PLATFORM users.
   * Separado pra evitar confusão e permitir rate-limit/lockout independente.
   */
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @Post('saas-login')
  @ApiOperation({
    summary: 'Login do SaaS Admin (equipe da plataforma)',
    description: 'Apenas usuários PLATFORM — funcionários da Anthropic que operam o SaaS Admin panel.',
  })
  @ApiResponse({ status: 201, description: 'Login OK — retorna access_token + dados do platform user.' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas ou usuário não é PLATFORM' })
  async saasLogin(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password, 'PLATFORM');
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.authService.login(user);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: 'Retorna o user logado (hidratado do banco com photoUrl, etc)' })
  async getProfile(@Request() req: any) {
    // O JWT só carrega id/email/role/tenantId. Hidratar photoUrl/name atualizados
    // do banco — assim front pega mudanças sem precisar relogar (ex: usuário
    // trocou foto, admin mudou nome dele).
    const dbUser = await (this.prisma as any).user.findUnique({
      where:  { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, tenantId: true, photoUrl: true, isSuperAdmin: true },
    });
    return dbUser ?? req.user;
  }
}
