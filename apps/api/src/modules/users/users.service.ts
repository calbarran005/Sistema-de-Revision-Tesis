import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(pagination: PaginationDto, filters?: { role?: string; programId?: string; isActive?: boolean }) {
    const where: any = {};
    if (filters?.role) where.role = filters.role;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (pagination.search) {
      where.OR = [
        { firstName: { contains: pagination.search } },
        { lastName: { contains: pagination.search } },
        { email: { contains: pagination.search } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true, lastLoginAt: true, createdAt: true,
          studentProfile: { select: { id: true, studentCode: true, program: { select: { name: true } } } },
          advisorProfile: { select: { id: true, employeeCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, meta: { total, page: pagination.page, limit: pagination.limit, totalPages: Math.ceil(total / (pagination.limit || 20)) } };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        studentProfile: { include: { program: true, advisor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } } },
        advisorProfile: { include: { students: { include: { user: { select: { firstName: true, lastName: true } } } } } },
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { password, refreshToken, resetPasswordToken, ...safe } = user;
    return safe;
  }

  async create(data: { email: string; password: string; firstName: string; lastName: string; role: string }) {
    const exists = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw new ConflictException('Ya existe un usuario con este email');
    const hashed = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: { ...data, password: hashed, role: data.role as any },
    });
    const { password, ...safe } = user;
    return safe;
  }

  async update(id: string, data: any) {
    if (data.password) data.password = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.update({ where: { id }, data });
    const { password, refreshToken, resetPasswordToken, ...safe } = user;
    return safe;
  }

  async deactivate(id: string) {
    return this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  async assignAdvisor(studentUserId: string, advisorUserId: string) {
    const [studentProfile, advisorProfile] = await Promise.all([
      this.prisma.studentProfile.findUnique({ where: { userId: studentUserId } }),
      this.prisma.advisorProfile.findUnique({ where: { userId: advisorUserId } }),
    ]);
    if (!studentProfile) throw new NotFoundException('Perfil de estudiante no encontrado');
    if (!advisorProfile) throw new NotFoundException('Perfil de asesor no encontrado');
    return this.prisma.studentProfile.update({
      where: { id: studentProfile.id },
      data: { advisorId: advisorProfile.id },
    });
  }
}
