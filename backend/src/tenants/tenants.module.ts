import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantsExpiryTask } from './tenants-expiry.task';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, TenantsExpiryTask, PrismaService],
  exports: [TenantsService],
})
export class TenantsModule {}
