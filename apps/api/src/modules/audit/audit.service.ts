import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: { userId?: string; action: string; entityType: string; entityId?: string; description: string; metadata?: any; ipAddress?: string }) {
    return this.prisma.auditLog.create({ data }).catch(() => null);
  }
}
