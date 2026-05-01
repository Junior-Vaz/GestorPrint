import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { MessagingModule } from '../messaging/messaging.module';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Module({
  imports: [MessagingModule], // pra testar SMTP via endpoint
  controllers: [SettingsController],
  providers: [SettingsService, PrismaService],
  exports: [SettingsService],
})
export class SettingsModule {}
