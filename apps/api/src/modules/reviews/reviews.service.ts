import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { ReportsService } from '../reports/reports.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private email: EmailService,
    private reports: ReportsService,
    private config: ConfigService,
  ) {}

  async createOrGetReview(submissionId: string, reviewerId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { aiAnalysis: true, student: { include: { user: true } }, template: { include: { rubrics: { include: { criteria: true }, where: { isActive: true }, take: 1 } } } },
    });
    if (!submission) throw new NotFoundException('Avance no encontrado');

    let review = await this.prisma.humanReview.findUnique({ where: { submissionId }, include: { comments: true, checklistItems: true } });

    if (!review) {
      review = await this.prisma.humanReview.create({
        data: {
          submissionId,
          reviewerId,
          status: 'IN_PROGRESS',
          checklistItems: {
            create: submission.template.rubrics[0]?.criteria.map((c, i) => ({
              criterionName: c.name,
              criterionDescription: c.description,
              dimension: c.dimension,
              maxScore: c.maxScore,
              orderIndex: i,
            })) || [],
          },
        },
        include: { comments: true, checklistItems: true },
      });

      await this.prisma.submission.update({ where: { id: submissionId }, data: { status: 'IN_REVIEW' } });
    }

    return review;
  }

  async addComment(reviewId: string, data: { content: string; pageNumber?: number; sectionName?: string; quotedText?: string }) {
    return this.prisma.reviewComment.create({ data: { reviewId, ...data } });
  }

  async updateChecklist(reviewId: string, itemId: string, data: { isChecked?: boolean; score?: number; note?: string }) {
    return this.prisma.checklistItem.update({ where: { id: itemId }, data });
  }

  async updateScores(reviewId: string, scores: {
    humanStructureScore?: number;
    humanContentScore?: number;
    humanFormScore?: number;
    humanOriginalityScore?: number;
    adjustedGrade?: number;
    gradeJustification?: string;
    generalComments?: string;
  }) {
    const review = await this.prisma.humanReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Revisión no encontrada');

    const structureScore = scores.humanStructureScore ?? Number(review.humanStructureScore);
    const contentScore = scores.humanContentScore ?? Number(review.humanContentScore);
    const formScore = scores.humanFormScore ?? Number(review.humanFormScore);
    const originalityScore = scores.humanOriginalityScore ?? Number(review.humanOriginalityScore);

    const complianceScore = structureScore && contentScore && formScore && originalityScore
      ? Math.round(structureScore * 0.30 + contentScore * 0.40 + formScore * 0.20 + originalityScore * 0.10)
      : null;

    return this.prisma.humanReview.update({
      where: { id: reviewId },
      data: {
        ...scores,
        ...(complianceScore && { humanComplianceScore: complianceScore }),
      },
    });
  }

  async finalizeReview(
    reviewId: string,
    decision: 'APPROVED' | 'REJECTED' | 'OBSERVED',
    decisionNote: string,
    notificationEmail?: string,
  ) {
    const review = await this.prisma.humanReview.findUnique({
      where: { id: reviewId },
      include: {
        submission: {
          include: {
            student: { include: { user: true } },
            aiAnalysis: true,
          },
        },
      },
    });
    if (!review) throw new NotFoundException('Revisión no encontrada');

    await this.prisma.$transaction([
      this.prisma.humanReview.update({
        where: { id: reviewId },
        data: { status: 'FINALIZED', finalizedAt: new Date(), completedAt: new Date(), decisionNote },
      }),
      this.prisma.submission.update({
        where: { id: review.submissionId },
        data: { status: decision as any },
      }),
    ]);

    // Notificación interna
    await this.notifications.notifyUser(review.submission.student.userId, {
      type: decision === 'APPROVED' ? 'SUBMISSION_APPROVED' : 'SUBMISSION_REJECTED',
      title: decision === 'APPROVED' ? '✅ Avance Aprobado' : decision === 'REJECTED' ? '❌ Avance Rechazado' : '👁️ Avance con Observaciones',
      message: decisionNote || `Tu avance ha sido ${decision === 'APPROVED' ? 'aprobado' : decision === 'REJECTED' ? 'rechazado' : 'observado'} por el revisor.`,
      data: { submissionId: review.submissionId, reviewId },
    });

    // Generar acta PDF para adjuntar al email
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await this.reports.generateIndividualReport(review.submissionId);
    } catch (err) {
      this.logger.error(`No se pudo generar el acta PDF: ${err.message}`);
    }

    // Enviar email al estudiante siempre, y también al email adicional si se especifica
    const studentEmail = review.submission.student.user.email;
    const studentName = `${review.submission.student.user.firstName} ${review.submission.student.user.lastName}`;
    const decisionLabel = decision === 'APPROVED' ? 'Aprobado' : decision === 'REJECTED' ? 'Rechazado' : 'Observado';
    const aiScore = review.submission.aiAnalysis?.complianceScore || 0;
    const aiGrade = review.submission.aiAnalysis?.finalGrade || 0;
    const appUrl = this.config.get('APP_URL', 'http://localhost:3000');
    const emailData = {
      studentName,
      submissionTitle: review.submission.title,
      decision,
      note: `Estado: ${decisionLabel}. Observaciones: ${decisionNote || 'Sin observaciones adicionales'}. Resultados IA: Cumplimiento ${aiScore}%, Nota ${aiGrade}.`,
      submissionId: review.submissionId,
      appUrl,
    };

    if (studentEmail) {
      await this.email.sendReviewComplete(studentEmail, emailData, pdfBuffer);
    }

    if (notificationEmail && notificationEmail !== studentEmail) {
      await this.email.sendReviewComplete(notificationEmail, emailData, pdfBuffer);
    }

    return { success: true, decision };
  }

  findBySubmission(submissionId: string) {
    return this.prisma.humanReview.findUnique({
      where: { submissionId },
      include: {
        comments: { orderBy: { createdAt: 'desc' } },
        checklistItems: { orderBy: { orderIndex: 'asc' } },
        reviewer: { select: { firstName: true, lastName: true } },
      },
    });
  }
}
