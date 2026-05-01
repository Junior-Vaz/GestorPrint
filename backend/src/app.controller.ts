import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET /api → identificação do serviço (nome + versão lida do package.json)
  @Get()
  getInfo() {
    return this.appService.getInfo();
  }

  // GET /api/health → healthcheck (usado pelo Docker e monitoramento externo)
  @SkipThrottle()
  @Get('health')
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
