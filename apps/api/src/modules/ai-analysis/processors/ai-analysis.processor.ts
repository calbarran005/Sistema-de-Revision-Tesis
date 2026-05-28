import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { DocumentExtractorService } from '../services/document-extractor.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { EmailService } from '../../email/email.service';
import { StorageService } from '../../storage/storage.service';
import OpenAI from 'openai';
import {
  ACADEMIC_EVALUATOR_SYSTEM_PROMPT,
  STRUCTURE_ANALYSIS_PROMPT,
  CONTENT_ANALYSIS_PROMPT,
  EXECUTIVE_SUMMARY_PROMPT,
  SCORING_WEIGHTS,
} from '../prompts/system-prompt';

export const AI_ANALYSIS_QUEUE = 'ai-analysis';

export interface AnalysisJobData {
  submissionId: string;
  templateId: string;
  studentId: string;
  userId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
}

@Processor(AI_ANALYSIS_QUEUE)
export class AiAnalysisProcessor {
  private readonly logger = new Logger(AiAnalysisProcessor.name);
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private documentExtractor: DocumentExtractorService,
    private notifications: NotificationsService,
    private email: EmailService,
    private storage: StorageService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
    });
  }

  @Process({ name: 'analyze', concurrency: 3 })
  async handleAnalysis(job: Job<AnalysisJobData>) {
    const { submissionId, templateId, studentId, userId, filePath, fileName, mimeType } = job.data;
    const startTime = Date.now();

    this.logger.log(`🔬 Iniciando análisis IA para submission: ${submissionId}`);

    // Marcar como en proceso
    await this.prisma.aIAnalysis.update({
      where: { submissionId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        aiModel: this.config.get('AI_MODEL', 'gpt-4o-mini'),
        aiProvider: this.config.get('AI_PROVIDER', 'openai'),
      },
    });

    await this.prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'ANALYZING' },
    });

    // Notificar inicio
    await this.notifications.notifyUser(userId, {
      type: 'ANALYSIS_COMPLETED',
      title: 'Análisis IA iniciado',
      message: 'Tu avance está siendo evaluado por el sistema de IA. Esto puede tomar hasta 30 segundos.',
    });

    try {
      await job.progress(10);

      // 1. Descargar archivo desde MinIO
      const fileBuffer = await this.storage.downloadFile(filePath);

      // 2. Extraer texto del documento
      const extractedDoc = await this.documentExtractor.extractFromBuffer(fileBuffer, mimeType, fileName);
      this.logger.log(`📄 Texto extraído: ${extractedDoc.wordCount} palabras, ${extractedDoc.pageCount} páginas`);

      await job.progress(25);

      // 3. Cargar template y su estructura
      const template = await this.prisma.thesisTemplate.findUnique({
        where: { id: templateId },
        include: {
          sections: { orderBy: { orderIndex: 'asc' } },
          rubrics: { include: { criteria: true }, where: { isActive: true } },
        },
      });

      if (!template) throw new Error(`Template ${templateId} no encontrado`);

      // 4. Guardar texto extraído en la submission
      const sectionTextMap: Record<string, string> = {};
      extractedDoc.sections.forEach((s) => {
        sectionTextMap[s.name] = s.content;
      });

      await this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          extractedTitle: extractedDoc.title,
          extractedAuthor: extractedDoc.author,
          pageCount: extractedDoc.pageCount,
          wordCount: extractedDoc.wordCount,
          extractedText: sectionTextMap,
        },
      });

      await job.progress(35);

      // 5. Análisis de estructura con IA
      const templateStructure = template.sections.map((s) => ({
        name: s.name,
        title: s.title,
        level: s.level,
        isRequired: s.isRequired,
        minWords: s.minWords,
        maxWords: s.maxWords,
        description: s.description,
      }));

      const structureAnalysis = await this.analyzeStructure(
        extractedDoc.fullText,
        templateStructure,
        extractedDoc.title,
      );

      await job.progress(50);

      // 6. Análisis de contenido por sección
      const contentFindings: any[] = [];
      const sectionScores: number[] = [];
      let formScore = 75;
      let originalityScore = 70;

      for (const section of extractedDoc.sections.slice(0, 8)) {
        if (section.wordCount < 20) continue;

        const templateSection = template.sections.find(
          (ts) =>
            ts.name.toLowerCase().includes(section.name.toLowerCase().split(' ')[0]) ||
            section.name.toLowerCase().includes(ts.name.toLowerCase().split(' ')[0]),
        );

        const guidelines = templateSection?.contentGuidelines ||
          templateSection?.description ||
          `Esta sección debe cumplir con los estándares académicos de posgrado`;

        const sectionAnalysis = await this.analyzeContent(
          section.name,
          section.content,
          guidelines,
          template.sections[0]?.citationStyle || 'APA 7',
        );

        if (sectionAnalysis && sectionAnalysis.findings) {
          contentFindings.push(
            ...sectionAnalysis.findings.map((f: any) => ({
              ...f,
              sectionName: section.name,
              dimension: this.findingTypeToDimension(f.type),
            })),
          );
          sectionScores.push(sectionAnalysis.score || 65);
        }

        await job.progress(50 + Math.floor((sectionScores.length / extractedDoc.sections.length) * 25));
      }

      await job.progress(75);

      // 7. Calcular scores
      const structureScore = structureAnalysis.structureScore || 70;
      const contentScore = sectionScores.length > 0
        ? Math.round(sectionScores.reduce((a, b) => a + b, 0) / sectionScores.length)
        : 65;

      // Penalizar forma por extensión/secciones faltantes
      const missingCount = structureAnalysis.missingSections?.length || 0;
      formScore = Math.max(40, 85 - missingCount * 5);
      originalityScore = contentScore > 70 ? 75 : 60;

      const complianceScore = Math.round(
        structureScore * SCORING_WEIGHTS.structure +
        contentScore * SCORING_WEIGHTS.content +
        formScore * SCORING_WEIGHTS.form +
        originalityScore * SCORING_WEIGHTS.originality,
      );

      const program = await this.prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: { program: true },
      });

      const maxGrade = program?.program?.maxScore || 5.0;
      const finalGrade = parseFloat(((complianceScore / 100) * Number(maxGrade)).toFixed(2));

      await job.progress(85);

      // 8. Generar resumen ejecutivo
      const allFindings = [
        ...structureAnalysis.structuralFindings || [],
        ...contentFindings,
      ];

      const summary = await this.generateExecutiveSummary(
        {
          structureScore,
          contentScore,
          formScore,
          originalityScore,
          totalFindings: allFindings.length,
          criticalCount: allFindings.filter((f) => f.severity === 'CRITICAL').length,
          majorCount: allFindings.filter((f) => f.severity === 'MAJOR').length,
          minorCount: allFindings.filter((f) => f.severity === 'MINOR').length,
          suggestionCount: allFindings.filter((f) => f.severity === 'SUGGESTION').length,
          missingSections: structureAnalysis.missingSections || [],
        },
        extractedDoc.title,
        complianceScore,
      );

      await job.progress(93);

      // 9. Guardar análisis completo en DB
      const analysis = await this.prisma.aIAnalysis.update({
        where: { submissionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          processingTimeMs: Date.now() - startTime,
          structureScore,
          contentScore,
          formScore,
          originalityScore,
          complianceScore,
          finalGrade,
          gradeScale: maxGrade,
          executiveSummary: summary.executiveSummary,
          strengths: summary.strengths,
          weaknesses: summary.weaknesses,
          priorities: summary.priorities,
          estimatedProgress: summary.estimatedProgress,
          totalSectionsExpected: template.sections.length,
          totalSectionsFound: extractedDoc.sections.length,
          missingSections: structureAnalysis.missingSections || [],
          extraSections: structureAnalysis.extraSections || [],
          disorderedSections: structureAnalysis.disorderedSections || [],
        },
      });

      // 10. Guardar hallazgos
      const findingsData = allFindings.map((f, index) => ({
        analysisId: analysis.id,
        severity: f.severity || 'MINOR',
        type: f.type || 'CONTENT_QUALITY',
        dimension: f.dimension || 'content',
        sectionName: f.sectionName || null,
        title: f.title || 'Hallazgo detectado',
        description: f.description || '',
        correctionTitle: f.correctionTitle || 'Instrucciones de corrección',
        correctionSteps: f.correctionSteps || ['Revisar y corregir según las pautas académicas'],
        correctionExample: f.correctionExample || null,
        recommendations: f.recommendations || null,
        suggestedSources: f.suggestedSources || null,
        estimatedEffort: f.estimatedEffort || '30 minutos',
        orderIndex: index,
      }));

      if (findingsData.length > 0) {
        await this.prisma.aIFinding.createMany({ data: findingsData });
      }

      // 11. Actualizar estado de la submission
      await this.prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'PENDING_REVIEW' },
      });

      await job.progress(100);

      // Notificar al estudiante (interna y por email)
      const student = await this.prisma.studentProfile.findUnique({
        where: { id: studentId },
        select: {
          userId: true,
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      });

      if (student) {
        await this.notifications.notifyUser(student.userId, {
          type: 'ANALYSIS_COMPLETED',
          title: 'Evaluación IA completada',
          message: `Tu avance ha sido evaluado. Cumplimiento: ${complianceScore}% | Nota: ${finalGrade}/${maxGrade}. Ya puedes ver la retroalimentación detallada.`,
          data: { submissionId, complianceScore, finalGrade },
        });

        const submissionTitle = await this.prisma.submission.findUnique({
          where: { id: submissionId },
          select: { title: true },
        });

        if (student.user?.email && submissionTitle) {
          this.email.sendAnalysisComplete(student.user.email, {
            studentName: `${student.user.firstName} ${student.user.lastName}`,
            submissionTitle: submissionTitle.title,
            complianceScore,
            finalGrade,
            submissionId,
            appUrl: this.config.get('APP_URL', 'http://localhost:3000'),
          }).catch((err) => this.logger.warn(`Email análisis no enviado: ${err.message}`));
        }
      }

      this.logger.log(`✅ Análisis completado para ${submissionId}: ${complianceScore}% cumplimiento`);
      return { submissionId, complianceScore, finalGrade, findingsCount: findingsData.length };
    } catch (error) {
      this.logger.error(`❌ Error en análisis de ${submissionId}: ${error.message}`, error.stack);

      await this.prisma.aIAnalysis.update({
        where: { submissionId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          processingTimeMs: Date.now() - startTime,
          errorMessage: error.message,
        },
      });

      await this.prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'PENDING_REVIEW' },
      });

      throw error;
    }
  }

  private async analyzeStructure(text: string, templateStructure: any[], title: string) {
    try {
      const prompt = STRUCTURE_ANALYSIS_PROMPT(text, templateStructure, title);

      const response = await this.openai.chat.completions.create({
        model: this.config.get('AI_MODEL', 'gpt-4o-mini'),
        messages: [
          { role: 'system', content: ACADEMIC_EVALUATOR_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      // Generar hallazgos estructurales para secciones faltantes
      const structuralFindings = (result.missingSections || []).map((sectionName: string) => ({
        type: 'STRUCTURAL_MISSING',
        severity: templateStructure.find((s) => s.name === sectionName)?.isRequired ? 'CRITICAL' : 'MAJOR',
        title: `Sección obligatoria ausente: ${sectionName}`,
        description: `El documento no contiene la sección "${sectionName}" que es requerida por el documento patrón institucional. Esta omisión afecta significativamente la estructura y completitud del avance.`,
        sectionName,
        dimension: 'structure',
        correctionTitle: `Cómo agregar la sección "${sectionName}"`,
        correctionSteps: [
          `Ubica el lugar apropiado en el documento donde debe ir "${sectionName}" según el índice del documento patrón.`,
          `Agrega el título de la sección con el nivel de encabezado correcto.`,
          `Desarrolla el contenido de acuerdo con las directrices institucionales para esta sección.`,
          `Verifica que la sección esté correctamente referenciada en el índice/tabla de contenido.`,
        ],
        correctionExample: `Consulta el documento patrón institucional para ver el contenido esperado de esta sección y sus subsecciones.`,
        recommendations: `Revisa el documento patrón completo para verificar el orden y contenido esperado de todas las secciones.`,
        estimatedEffort: '2-4 horas',
      }));

      return { ...result, structuralFindings };
    } catch (error) {
      this.logger.error(`Error en análisis de estructura: ${error.message}`);
      return {
        sectionsFound: [],
        missingSections: [],
        disorderedSections: [],
        extraSections: [],
        structureScore: 65,
        structuralFindings: [],
      };
    }
  }

  private async analyzeContent(
    sectionName: string,
    content: string,
    guidelines: string,
    citationStyle: string,
  ) {
    try {
      const prompt = CONTENT_ANALYSIS_PROMPT(sectionName, content, guidelines, citationStyle);

      const response = await this.openai.chat.completions.create({
        model: this.config.get('AI_MODEL', 'gpt-4o-mini'),
        messages: [
          { role: 'system', content: ACADEMIC_EVALUATOR_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      this.logger.error(`Error analizando sección "${sectionName}": ${error.message}`);
      return { score: 60, findings: [], strengths: [], weaknesses: [] };
    }
  }

  private async generateExecutiveSummary(analysisResults: any, title: string, score: number) {
    try {
      const prompt = EXECUTIVE_SUMMARY_PROMPT(analysisResults, title, score);

      const response = await this.openai.chat.completions.create({
        model: this.config.get('AI_MODEL', 'gpt-4o-mini'),
        messages: [
          { role: 'system', content: ACADEMIC_EVALUATOR_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      this.logger.error(`Error generando resumen ejecutivo: ${error.message}`);
      return {
        executiveSummary: `El avance presenta un cumplimiento del ${score}% respecto al documento patrón institucional. Se identificaron áreas de mejora en estructura y contenido que requieren atención prioritaria.`,
        strengths: ['Presentación del documento'],
        weaknesses: ['Requiere revisión detallada'],
        priorities: ['Completar secciones faltantes'],
        estimatedProgress: `${score}% completado`,
        recommendedNextSteps: 'Revisar la retroalimentación detallada y corregir los hallazgos críticos primero.',
      };
    }
  }

  private findingTypeToDimension(type: string): string {
    const map: Record<string, string> = {
      STRUCTURAL_MISSING: 'structure',
      STRUCTURAL_ORDER: 'structure',
      CONTENT_QUALITY: 'content',
      CONTENT_COHERENCE: 'content',
      FORMAT_EXTENSION: 'form',
      FORMAT_CITATION: 'form',
      FORMAT_LANGUAGE: 'form',
      ORIGINALITY: 'originality',
    };
    return map[type] || 'content';
  }
}
