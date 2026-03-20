import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: number) {
    const users = await (this.prisma as any).user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user: any) => {
      const { password, ...result } = user;
      return result;
    });
  }

  async findOne(id: number, tenantId: number) {
    const user = await (this.prisma as any).user.findFirst({
      where: { id, tenantId },
    });
    if (user) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async create(data: any, tenantId: number) {
    const hashedPassword = await bcrypt.hash(data.password || 'mudar123', 10);
    return (this.prisma as any).user.create({
      data: {
        ...data,
        tenantId,
        password: hashedPassword,
      },
    });
  }

  async update(id: number, data: any, tenantId: number) {
    const updateData = { ...data };

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    } else {
      delete updateData.password;
    }

    return (this.prisma as any).user.updateMany({
      where: { id, tenantId },
      data: updateData,
    });
  }

  async remove(id: number, tenantId: number) {
    const adminCount = await (this.prisma as any).user.count({ where: { role: 'ADMIN', tenantId } });
    const user = await (this.prisma as any).user.findFirst({ where: { id, tenantId } });

    if (user?.role === 'ADMIN' && adminCount <= 1) {
      throw new Error('Não é possível excluir o único administrador do sistema.');
    }

    return (this.prisma as any).user.deleteMany({
      where: { id, tenantId },
    });
  }
}
