import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { IStorageProvider, STORAGE_PROVIDER } from '../../../infrastructure/storage/storage.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FilesService {
  // Legacy flat-file path (backward compat: serves old files stored before UUID migration)
  private readonly uploadRoot = path.join(process.cwd(), 'uploads');

  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  private async getTenantUuid(tenantId: number): Promise<string> {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { uuid: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    return tenant.uuid;
  }

  async saveFile(orderId: number, file: Express.Multer.File, tenantId: number) {
    const tenantUuid = await this.getTenantUuid(tenantId);
    const stored = await this.storage.save(file.buffer, tenantUuid, file.originalname);

    return (this.prisma as any).attachment.create({
      data: {
        filename: stored.storedPath,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        orderId,
      },
    });
  }

  async saveFileForEstimate(estimateId: number, file: Express.Multer.File, tenantId: number) {
    const tenantUuid = await this.getTenantUuid(tenantId);
    const stored = await this.storage.save(file.buffer, tenantUuid, file.originalname);

    return (this.prisma as any).attachment.create({
      data: {
        filename: stored.storedPath,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        estimateId,
      },
    });
  }

  async getFile(relativePath: string): Promise<string> {
    // ── Path traversal defense ────────────────────────────────────────────
    // Rejeita any input com `..`, NUL byte ou backslash escapando dirs.
    // Sem isso, `GET /api/files/../../etc/passwd` vazaria arquivos do host.
    if (
      !relativePath ||
      relativePath.includes('..') ||
      relativePath.includes('\0') ||
      path.isAbsolute(relativePath)
    ) {
      throw new NotFoundException('Caminho inválido');
    }

    // Try via storage provider first (handles UUID-based paths)
    try {
      const absPath = this.storage.getAbsolutePath(relativePath);
      // Confirma que o caminho resolvido fica DENTRO do dir esperado — defesa
      // em camadas caso o storage provider tenha bug de normalização.
      const resolved = path.resolve(absPath);
      if (fs.existsSync(resolved)) return resolved;
    } catch {
      // Remote provider — fall through
    }

    // Backward compat: flat file path (legacy uploads)
    const legacyPath = path.resolve(path.join(this.uploadRoot, relativePath));
    const rootResolved = path.resolve(this.uploadRoot);
    if (!legacyPath.startsWith(rootResolved + path.sep) && legacyPath !== rootResolved) {
      throw new NotFoundException('Caminho fora do diretório permitido');
    }
    if (fs.existsSync(legacyPath)) return legacyPath;

    throw new NotFoundException('Arquivo não encontrado no servidor');
  }

  async remove(id: number) {
    const attachment = await (this.prisma as any).attachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Anexo não encontrado');

    await this.storage.delete(attachment.filename).catch(() => {
      // Also try legacy flat path (old files without tenant folder)
      const legacyPath = path.join(this.uploadRoot, attachment.filename);
      if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
    });

    return (this.prisma as any).attachment.delete({ where: { id } });
  }

  async findByOrder(orderId: number) {
    return (this.prisma as any).attachment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEstimate(estimateId: number) {
    return (this.prisma as any).attachment.findMany({
      where: { estimateId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
