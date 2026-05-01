import { Module, forwardRef } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { EstimatesModule } from '../estimates/estimates.module';

@Module({
  imports: [forwardRef(() => EstimatesModule)],
  controllers: [FilesController],
  providers: [FilesService, PrismaService],
  exports: [FilesService],
})
export class FilesModule {}
