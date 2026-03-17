import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FilesService {
  private readonly uploadPath = path.join(process.cwd(), 'uploads');

  constructor(private prisma: PrismaService) {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async saveFile(orderId: number, file: Express.Multer.File) {
    const filename = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(this.uploadPath, filename);

    fs.writeFileSync(filePath, file.buffer);

    return (this.prisma as any).attachment.create({
      data: {
        filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        orderId,
      },
    });
  }

  async getFile(filename: string) {
    const filePath = path.join(this.uploadPath, filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Arquivo não encontrado no servidor');
    }
    return filePath;
  }

  async remove(id: number) {
    const attachment = await (this.prisma as any).attachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Anexo não encontrado');

    const filePath = path.join(this.uploadPath, attachment.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return (this.prisma as any).attachment.delete({ where: { id } });
  }

  async findByOrder(orderId: number) {
    return (this.prisma as any).attachment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
