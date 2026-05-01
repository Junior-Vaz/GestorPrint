import { Controller, Get, UseGuards } from '@nestjs/common';
import { LogsService } from './logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @CanAccess('audit', 'view')
  getRecent() {
    return this.logsService.getBuffer();
  }
}
