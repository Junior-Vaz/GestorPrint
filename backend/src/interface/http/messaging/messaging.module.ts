import { Module, Global } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Global()
@Module({
  providers: [MessagingService, PrismaService],
  exports: [MessagingService],
})
export class MessagingModule {}
