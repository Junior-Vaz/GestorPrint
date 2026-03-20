import { Controller, Get, Patch, Param, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: number) {
    return this.notificationsService.findAll(tenantId);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.notificationsService.markAsRead(+id, tenantId);
  }

  @Post('read-all')
  markAllAsRead(@CurrentTenant() tenantId: number) {
    return this.notificationsService.markAllAsRead(tenantId);
  }
}
