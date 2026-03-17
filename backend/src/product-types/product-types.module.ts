import { Module } from '@nestjs/common';
import { ProductTypesService } from './product-types.service';
import { ProductTypesController } from './product-types.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ProductTypesController],
  providers: [ProductTypesService, PrismaService],
  exports: [ProductTypesService],
})
export class ProductTypesModule {}
