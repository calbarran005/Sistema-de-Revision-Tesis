import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProgramsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.academicProgram.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const p = await this.prisma.academicProgram.findUnique({
      where: { id },
      include: { templates: { where: { isActive: true }, select: { id: true, name: true, version: true } } },
    });
    if (!p) throw new NotFoundException('Programa no encontrado');
    return p;
  }

  create(data: any) {
    return this.prisma.academicProgram.create({ data });
  }

  update(id: string, data: any) {
    return this.prisma.academicProgram.update({ where: { id }, data });
  }
}
