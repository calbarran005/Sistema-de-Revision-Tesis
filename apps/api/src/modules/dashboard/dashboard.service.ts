import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getKPIs(filters?: { programId?: string; advisorId?: string; period?: string }) {
    const where: any = {};
    if (filters?.programId) where.student = { programId: filters.programId };
    if (filters?.period) where.academicPeriod = filters.period;

    const [
      totalSubmissions, pendingReview, approved, rejected, analyzing,
      avgAiScore, avgHumanScore,
    ] = await Promise.all([
      this.prisma.submission.count({ where }),
      this.prisma.submission.count({ where: { ...where, status: { in: ['PENDING_REVIEW', 'IN_REVIEW', 'ANALYZING', 'SUBMITTED'] } } }),
      this.prisma.submission.count({ where: { ...where, status: 'APPROVED' } }),
      this.prisma.submission.count({ where: { ...where, status: 'REJECTED' } }),
      this.prisma.submission.count({ where: { ...where, status: 'ANALYZING' } }),
      this.prisma.aIAnalysis.aggregate({ _avg: { complianceScore: true } }).then(r => r._avg.complianceScore),
      this.prisma.humanReview.aggregate({ _avg: { adjustedGrade: true } }).then(r => r._avg.adjustedGrade),
    ]);

    const lowComplianceSubmissions = await this.prisma.submission.findMany({
      where: { ...where, aiAnalysis: { complianceScore: { lt: 60 }, status: 'COMPLETED' } },
      select: {
        id: true, title: true, status: true,
        student: { select: { user: { select: { firstName: true, lastName: true } } } },
        aiAnalysis: { select: { complianceScore: true } },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    return {
      totalSubmissions, pendingReview, approved, rejected, analyzing,
      approvalRate: totalSubmissions > 0 ? Math.round((approved / totalSubmissions) * 100) : 0,
      avgAiScore: avgAiScore ? Math.round(Number(avgAiScore)) : 0,
      avgHumanScore: avgHumanScore ? Number(avgHumanScore).toFixed(2) : '0',
      lowComplianceSubmissions,
    };
  }

  async getSubmissionsByMonth(year?: number) {
    const targetYear = year || new Date().getFullYear();
    const submissions = await this.prisma.submission.findMany({
      where: {
        createdAt: {
          gte: new Date(`${targetYear}-01-01`),
          lt: new Date(`${targetYear + 1}-01-01`),
        },
      },
      select: { createdAt: true, status: true },
    });

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(targetYear, i).toLocaleString('es', { month: 'short' }),
      total: 0, approved: 0, rejected: 0, pending: 0,
    }));

    submissions.forEach((s) => {
      const m = new Date(s.createdAt).getMonth();
      months[m].total++;
      if (s.status === 'APPROVED') months[m].approved++;
      else if (s.status === 'REJECTED') months[m].rejected++;
      else if (!['OBSERVED', 'DRAFT'].includes(s.status)) months[m].pending++;
    });

    return months;
  }

  async getStatusDistribution() {
    const counts = await this.prisma.submission.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return counts.map(c => ({ status: c.status, count: c._count._all }));
  }

  async getScoreDistribution() {
    const analyses = await this.prisma.aIAnalysis.findMany({
      where: { status: 'COMPLETED', complianceScore: { not: null } },
      select: { complianceScore: true },
    });

    const buckets = [
      { range: '0-20', min: 0, max: 20, count: 0 },
      { range: '21-40', min: 21, max: 40, count: 0 },
      { range: '41-60', min: 41, max: 60, count: 0 },
      { range: '61-80', min: 61, max: 80, count: 0 },
      { range: '81-100', min: 81, max: 100, count: 0 },
    ];

    analyses.forEach(a => {
      const score = Number(a.complianceScore);
      const bucket = buckets.find(b => score >= b.min && score <= b.max);
      if (bucket) bucket.count++;
    });

    return buckets;
  }

  async getAdvisorWorkload() {
    const advisors = await this.prisma.advisorProfile.findMany({
      include: {
        user: { select: { firstName: true, lastName: true } },
        students: {
          include: {
            submissions: {
              where: { status: { in: ['PENDING_REVIEW', 'IN_REVIEW'] } },
              select: { id: true },
            },
          },
        },
      },
    });

    return advisors.map(a => ({
      id: a.id,
      name: `${a.user.firstName} ${a.user.lastName}`,
      totalStudents: a.students.length,
      pendingReviews: a.students.reduce((sum, s) => sum + s.submissions.length, 0),
    }));
  }

  async getRecentActivity(limit = 10) {
    return this.prisma.auditLog.findMany({
      where: { userId: { not: null } },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
