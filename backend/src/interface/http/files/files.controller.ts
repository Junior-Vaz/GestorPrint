import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Res,
  ParseIntPipe,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FilesService } from './files.service';
import { EstimatesService } from '../estimates/estimates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import type { Response } from 'express';

// Extensões bloqueadas (executáveis e scripts maliciosos)
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.ps1', '.psm1', '.vbs', '.vbe',
  '.js', '.jse', '.wsf', '.wsh', '.scr', '.pif', '.reg', '.inf', '.cpl',
  '.sh', '.bash', '.zsh', '.fish', '.py', '.rb', '.pl', '.php', '.jar',
  '.dll', '.so', '.dylib', '.app', '.dmg', '.pkg', '.deb', '.rpm',
]);

// Limite: 50 MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function validateUpload(file: Express.Multer.File) {
  if (!file) {
    throw new BadRequestException('Nenhum arquivo enviado');
  }

  const originalName = file.originalname.toLowerCase();
  const ext = originalName.substring(originalName.lastIndexOf('.'));

  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new BadRequestException(
      `Tipo de arquivo não permitido: ${ext}. Executáveis e scripts são bloqueados por segurança.`,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException(
      `Arquivo muito grande. Tamanho máximo permitido: 50 MB. Seu arquivo: ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
    );
  }
}

@ApiTags('files')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly estimatesService: EstimatesService,
  ) {}

  // Upload público de arte pelo cliente via link de orçamento
  @Public()
  @Post('public-estimate/:uuid')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async uploadPublicForEstimate(
    @Param('uuid') uuid: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    validateUpload(file);
    const ref = await this.estimatesService.resolvePublicUuid(uuid);
    if (!ref) throw new BadRequestException('Orçamento inválido, expirado ou recusado.');
    return this.filesService.saveFileForEstimate(ref.id, file, ref.tenantId);
  }

  @Post('upload/:orderId')
  @RequireFeature(FeatureKey.FILE_UPLOAD)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  uploadFile(
    @Param('orderId', ParseIntPipe) orderId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentTenant() tenantId: number,
  ) {
    validateUpload(file);
    return this.filesService.saveFile(orderId, file, tenantId);
  }

  @Post('upload-estimate/:estimateId')
  @RequireFeature(FeatureKey.FILE_UPLOAD)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  uploadForEstimate(
    @Param('estimateId', ParseIntPipe) estimateId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentTenant() tenantId: number,
  ) {
    validateUpload(file);
    return this.filesService.saveFileForEstimate(estimateId, file, tenantId);
  }

  @Get('estimate/:estimateId')
  findByEstimate(@Param('estimateId', ParseIntPipe) estimateId: number) {
    return this.filesService.findByEstimate(estimateId);
  }

  @Get('order/:orderId')
  getByOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.filesService.findByOrder(orderId);
  }

  // Serve files organized by tenant: /api/files/1/arquivo.pdf
  @Public()
  @Get(':tenantId/:filename')
  async serveFileTenant(
    @Param('tenantId') tenantId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = await this.filesService.getFile(`${tenantId}/${filename}`);
    return res.sendFile(filePath);
  }

  @Public()
  @Get(':filename')
  async serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = await this.filesService.getFile(filename);
    return res.sendFile(filePath);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.filesService.remove(id);
  }
}
