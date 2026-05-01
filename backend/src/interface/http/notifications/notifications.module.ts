import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from '../../websocket/notifications.gateway';
import { NotificationsController } from './notifications.controller';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Module({
  providers: [NotificationsService, NotificationsGateway, PrismaService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
