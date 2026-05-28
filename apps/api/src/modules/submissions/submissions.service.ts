import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private notifications: NotificationsService,
    private email: EmailService,
    private config: ConfigService,
  ) {}

  async uploadSubmission(
    file: Express.Multer.File,
    studentId: string,
    userId: string,
    body: {
      title: string;
      description?: string;
      templateId: string;
      academicPeriod: string;
      deliveryNumber?: number;
    },
  ) {
    // Validaciones
    this.validateFile(file);

    // Obtener perfil de estudiante
    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!studentProfile) throw new ForbiddenException('Solo estudiantes pueden subir avances');

    return this.processIndividualSubmission(file, studentProfile.id, userId, body);
  }

  async uploadBatchSubmissions(
    files: Express.Multer.File[],
    userId: string,
    body: {
      templateId: string;
      academicPeriod: string;
      deliveryNumber?: number;
      studentId?: string;
    },
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se han proporcionado archivos');
    }

    const results: any[] = [];
    const errors: any[] = [];

    // Determinar el estudiante objetivo
    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });

    const targetStudentId = studentProfile ? studentProfile.id : body.studentId;

    if (!targetStudentId) {
      throw new BadRequestException('Se requiere un ID de estudiante para la carga por lotes');
    }

    for (const file of files) {
      try {
        this.validateFile(file);
        const submission = await this.processIndividualSubmission(file, targetStudentId, userId, {
          title: file.originalname.replace(/\.[^/.]+$/, ''),
          templateId: body.templateId,
          academicPeriod: body.academicPeriod,
          deliveryNumber: body.deliveryNumber,
        });
        results.push(submission);
      } catch (error) {
        errors.push({ fileName: file.originalname, error: error.message });
      }
    }

    return {
      total: files.length,
      successful: results.length,
      failed: errors.length,
      submissions: results,
      errors,
    };
  }

  private validateFile(file: Express.Multer.File) {
    if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Solo se permiten archivos PDF o Word (.docx): ${file.originalname}`);
    }
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(`El archivo no puede superar 50MB: ${file.originalname}`);
    }
  }

  private async processIndividualSubmission(
    file: Express.Multer.File,
    studentId: string,
    _userId: string,
    body: {
      title: string;
      description?: string;
      templateId: string;
      academicPeriod: string;
      deliveryNumber?: number;
    },
  ) {
    // Verificar template existe
    const template = await this.prisma.thesisTemplate.findUnique({
      where: { id: body.templateId, isActive: true },
    });
    if (!template) throw new NotFoundException('Documento patrón no encontrado');

    // Calcular versión
    const lastVersion = await this.prisma.submission.findFirst({
      where: { studentId, templateId: body.templateId },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (lastVersion?.versionNumber || 0) + 1;

    // Subir archivo a MinIO
    const { filePath, fileName, fileSize } = await this.storage.uploadDocument(
      file,
      `submissions/${studentId}`,
    );

    // Crear submission en DB
    const submission = await this.prisma.submission.create({
      data: {
        studentId,
        templateId: body.templateId,
        title: body.title,
        description: body.description,
        versionNumber,
        parentSubmissionId: lastVersion?.id || null,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        academicPeriod: body.academicPeriod,
        deliveryNumber: parseInt(String(body.deliveryNumber || 1), 10),
        fileName,
        filePath,
        fileSize,
        mimeType: file.mimetype,
      },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        template: { select: { name: true } },
      },
    });

    // Crear registro de análisis inicial (pendiente hasta que un revisor lo inicie)
    await this.prisma.aIAnalysis.upsert({
      where: { submissionId: submission.id },
      update: { status: 'PENDING', startedAt: null, completedAt: null, errorMessage: null },
      create: {
        submissionId: submission.id,
        status: 'PENDING',
        aiModel: 'gpt-4o-mini',
        aiProvider: 'openai',
      },
    });

    // Notificar al estudiante
    const targetStudent = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: { userId: true },
    });

    if (targetStudent) {
      await this.notifications.notifyUser(targetStudent.userId, {
        type: 'SUBMISSION_RECEIVED',
        title: 'Avance recibido',
        message: `Tu avance "${body.title}" (v${versionNumber}) fue subido exitosamente y está pendiente de revisión.`,
        data: { submissionId: submission.id },
      });
    }

    // Enviar email de confirmación al estudiante (fire-and-forget para no bloquear la respuesta)
    const studentEmail = submission.student?.user?.email;
    const studentName = `${submission.student?.user?.firstName || ''} ${submission.student?.user?.lastName || ''}`.trim();
    if (studentEmail) {
      this.email.sendSubmissionReceived(studentEmail, {
        studentName,
        submissionTitle: body.title,
        submissionId: submission.id,
        appUrl: this.config.get('APP_URL', 'http://localhost:3000'),
      }).catch((err) => this.logger.warn(`Email confirmación no enviado: ${err.message}`));
    }

    this.logger.log(`Submission creada: ${submission.id} para estudiante ${studentId}`);
    return submission;
  }

  async findAll(filters: {
    page?: number;
    limit?: number;
    status?: string;
    programId?: string;
    studentId?: string;
    advisorId?: string;
    search?: string;
    academicPeriod?: string;
    minScore?: number;
    maxScore?: number;
  }, userRole: string, userId: string) {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.academicPeriod) where.academicPeriod = filters.academicPeriod;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { student: { user: { firstName: { contains: filters.search } } } },
        { student: { user: { lastName: { contains: filters.search } } } },
      ];
    }

    // Restricción por rol
    if (userRole === 'STUDENT') {
      const profile = await this.prisma.studentProfile.findUnique({ where: { userId } });
      if (profile) where.studentId = profile.id;
    } else if (userRole === 'ADVISOR') {
      const profile = await this.prisma.advisorProfile.findUnique({ where: { userId } });
      if (profile) where.student = { advisorId: profile.id };
    }

    if (filters.programId) {
      where.student = { ...where.student, programId: filters.programId };
    }

    // Filtro por score de IA
    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
      where.aiAnalysis = {
        complianceScore: {
          ...(filters.minScore !== undefined && { gte: filters.minScore }),
          ...(filters.maxScore !== undefined && { lte: filters.maxScore }),
        },
      };
    }

    const page = parseInt(String(filters.page || 1), 10);
    const limit = parseInt(String(filters.limit || 20), 10);
    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
              program: { select: { name: true, code: true } },
            },
          },
          template: { select: { name: true, version: true } },
          aiAnalysis: {
            select: { status: true, complianceScore: true, finalGrade: true, completedAt: true },
          },
          humanReview: {
            select: { status: true, adjustedGrade: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.submission.count({ where }),
    ]);

    return {
      data: submissions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            program: true,
            advisor: {
              include: { user: { select: { firstName: true, lastName: true, email: true } } },
            },
          },
        },
        template: {
          include: { sections: { orderBy: { orderIndex: 'asc' } } },
        },
        aiAnalysis: {
          include: {
            findings: { orderBy: [{ severity: 'asc' }, { orderIndex: 'asc' }] },
          },
        },
        humanReview: {
          include: {
            comments: { orderBy: { createdAt: 'desc' } },
            checklistItems: { orderBy: { orderIndex: 'asc' } },
            reviewer: { select: { firstName: true, lastName: true } },
          },
        },
        versions: { select: { id: true, versionNumber: true, createdAt: true, status: true } },
      },
    });

    if (!submission) throw new NotFoundException('Avance no encontrado');

    // Control de acceso
    if (userRole === 'STUDENT') {
      const profile = await this.prisma.studentProfile.findUnique({ where: { userId } });
      if (submission.studentId !== profile?.id) {
        throw new ForbiddenException('No tienes acceso a este avance');
      }
    }

    return submission;
  }

  async getPresignedUrl(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      select: { filePath: true, fileName: true, mimeType: true },
    });
    if (!submission) throw new NotFoundException('Avance no encontrado');

    const url = await this.storage.getPresignedUrl(submission.filePath, 3600);
    return { url, fileName: submission.fileName, mimeType: submission.mimeType, expiresIn: 3600 };
  }

  async getVersionHistory(submissionId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { studentId: true, templateId: true },
    });
    if (!submission) throw new NotFoundException('Avance no encontrado');

    return this.prisma.submission.findMany({
      where: { studentId: submission.studentId, templateId: submission.templateId },
      select: {
        id: true,
        versionNumber: true,
        status: true,
        createdAt: true,
        aiAnalysis: { select: { complianceScore: true, finalGrade: true } },
        humanReview: { select: { adjustedGrade: true } },
      },
      orderBy: { versionNumber: 'asc' },
    });
  }

  async updateStatus(id: string, status: string, _note?: string) {
    return this.prisma.submission.update({
      where: { id },
      data: { status: status as any },
    });
  }
}
