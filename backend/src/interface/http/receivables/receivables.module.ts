import { Module } from '@nestjs/common';
import { ReceivablesService } from './receivables.service';
import { ReceivablesController } from './receivables.controller';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Module({
  controllers: [ReceivablesController],
  providers: [ReceivablesService, PrismaService],
  exports: [ReceivablesService],
})
export class ReceivablesModule {}
