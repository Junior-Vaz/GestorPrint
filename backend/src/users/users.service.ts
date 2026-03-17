import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const users = await (this.prisma as any).user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    // Remove passwords from response
    return users.map((user: any) => {
      const { password, ...result } = user;
      return result;
    });
  }

  async findOne(id: number) {
    const user = await (this.prisma as any).user.findUnique({
      where: { id },
    });
    if (user) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async create(data: any) {
    const hashedPassword = await bcrypt.hash(data.password || 'mudar123', 10);
    return (this.prisma as any).user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });
  }

  async update(id: number, data: any) {
    const updateData = { ...data };
    
    // If a new password is provided, hash it
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    } else {
      delete updateData.password;
    }

    return (this.prisma as any).user.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: number) {
    // Prevent deleting the last admin if possible (basic safety)
    const adminCount = await (this.prisma as any).user.count({ where: { role: 'ADMIN' } });
    const user = await (this.prisma as any).user.findUnique({ where: { id } });
    
    if (user?.role === 'ADMIN' && adminCount <= 1) {
      throw new Error('Não é possível excluir o único administrador do sistema.');
    }

    return (this.prisma as any).user.delete({
      where: { id },
    });
  }
}
