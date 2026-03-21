import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [AuthModule, PlansModule],
  controllers: [AuditController],
  providers: [AuditService, PrismaService],
  exports: [AuditService]
})
export class AuditModule {}
