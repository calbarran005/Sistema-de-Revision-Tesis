import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_ANALYSIS_QUEUE, AnalysisJobData } from './processors/ai-analysis.processor';

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue(AI_ANALYSIS_QUEUE) private analysisQueue: Queue,
  ) {}

  async enqueueAnalysis(data: AnalysisJobData) {
    // Crear registro inicial de análisis
    const analysis = await this.prisma.aIAnalysis.upsert({
      where: { submissionId: data.submissionId },
      update: { status: 'PENDING', startedAt: null, completedAt: null, errorMessage: null },
      create: {
        submissionId: data.submissionId,
        status: 'PENDING',
        aiModel: 'gpt-4o-mini',
        aiProvider: 'openai',
      },
    });

    const job = await this.analysisQueue.add('analyze', data, {
      priority: 1,
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
    });

    // Registrar el job en DB
    await this.prisma.aIJob.create({
      data: {
        jobId: String(job.id),
        type: 'ANALYZE_SUBMISSION',
        status: 'waiting',
        payload: data as any,
      },
    });

    this.logger.log(`📦 Job de análisis encolado: ${job.id} para submission ${data.submissionId}`);
    return { jobId: job.id, analysisId: analysis.id };
  }

  async getAnalysis(submissionId: string) {
    const analysis = await this.prisma.aIAnalysis.findUnique({
      where: { submissionId },
      include: {
        findings: { orderBy: [{ severity: 'asc' }, { orderIndex: 'asc' }] },
      },
    });

    if (!analysis) throw new NotFoundException('Análisis no encontrado para este avance');
    return analysis;
  }

  async getFindings(analysisId: string, filters?: { severity?: string; dimension?: string }) {
    const where: any = { analysisId };
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.dimension) where.dimension = filters.dimension;

    return this.prisma.aIFinding.findMany({
      where,
      orderBy: [
        { severity: 'asc' },
        { dimension: 'asc' },
        { orderIndex: 'asc' },
      ],
    });
  }

  async acceptFinding(findingId: string, reviewerNote?: string) {
    return this.prisma.aIFinding.update({
      where: { id: findingId },
      data: { isAcceptedByReviewer: true, reviewerNote },
    });
  }

  async rejectFinding(findingId: string, reviewerNote: string) {
    return this.prisma.aIFinding.update({
      where: { id: findingId },
      data: { isAcceptedByReviewer: false, isModifiedByReviewer: true, reviewerNote },
    });
  }

  async getQueueStatus() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.analysisQueue.getWaitingCount(),
      this.analysisQueue.getActiveCount(),
      this.analysisQueue.getCompletedCount(),
      this.analysisQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  async startAnalysis(submissionId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, templateId: true, studentId: true, filePath: true, fileName: true, mimeType: true },
    });
    if (!submission) throw new NotFoundException('Avance no encontrado');

    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: { id: submission.studentId },
      select: { userId: true },
    });

    return this.enqueueAnalysis({
      submissionId: submission.id,
      templateId: submission.templateId,
      studentId: submission.studentId,
      userId: studentProfile?.userId || submission.studentId,
      filePath: submission.filePath,
      fileName: submission.fileName,
      mimeType: submission.mimeType,
    });
  }

  async startBatchAnalysis(submissionIds: string[]) {
    const results: any[] = [];
    const errors: any[] = [];

    for (const submissionId of submissionIds) {
      try {
        const result = await this.startAnalysis(submissionId);
        results.push({ submissionId, ...result });
      } catch (error) {
        errors.push({ submissionId, error: error.message });
      }
    }

    return {
      total: submissionIds.length,
      queued: results.length,
      failed: errors.length,
      results,
      errors,
    };
  }

  async retryFailedAnalysis(submissionId: string) {
    return this.startAnalysis(submissionId);
  }
}
