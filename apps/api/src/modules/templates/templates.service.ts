import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { DocumentExtractorService } from '../ai-analysis/services/document-extractor.service';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export const TEMPLATE_QUEUE = 'template-processing';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private extractor: DocumentExtractorService,
    private config: ConfigService,
    @InjectQueue(TEMPLATE_QUEUE) private queue: Queue,
  ) {
    this.openai = new OpenAI({ apiKey: config.get('OPENAI_API_KEY') });
  }

  async uploadTemplate(file: Express.Multer.File, body: { name: string; programId: string; version: string; description?: string }, userId: string) {
    const { filePath, fileName, fileSize } = await this.storage.uploadTemplate(file);

    const template = await this.prisma.thesisTemplate.create({
      data: {
        programId: body.programId,
        name: body.name,
        version: body.version,
        description: body.description,
        fileName,
        filePath,
        fileSize,
        mimeType: file.mimetype,
        isProcessed: false,
        createdBy: userId,
      },
    });

    // Encolar procesamiento
    await this.queue.add('process', { templateId: template.id, filePath, mimeType: file.mimetype, fileName }, { attempts: 3 });

    return template;
  }

  async processTemplate(templateId: string, filePath: string, mimeType: string, fileName: string) {
    this.logger.log(`Procesando template: ${templateId}`);
    const buffer = await this.storage.downloadFile(filePath);
    const extracted = await this.extractor.extractFromBuffer(buffer, mimeType, fileName);

    // Usar IA para identificar la estructura del template
    const structurePrompt = `Analiza este documento patrón de tesis universitaria y extrae su estructura completa.

Texto del documento:
${extracted.fullText.substring(0, 20000)}

Retorna JSON con la estructura de secciones:
{
  "sections": [
    {
      "name": "nombre_interno",
      "title": "Título de la Sección",
      "level": 1,
      "isRequired": true,
      "minWords": 500,
      "maxWords": 2000,
      "description": "Qué debe contener esta sección",
      "contentGuidelines": "Guías detalladas de contenido",
      "citationStyle": "APA 7"
    }
  ]
}`;

    let sections: any[] = [];
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.get('AI_MODEL', 'gpt-4o-mini'),
        messages: [
          { role: 'system', content: 'Eres un experto en estructura de documentos académicos universitarios.' },
          { role: 'user', content: structurePrompt },
        ],
        temperature: 0.1,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      });
      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      sections = parsed.sections || [];
    } catch (err) {
      this.logger.error(`Error extrayendo estructura con IA: ${err.message}`);
      // Fallback: usar secciones detectadas del texto
      sections = extracted.sections.map((s, i) => ({
        name: s.name.toLowerCase().replace(/\s+/g, '_'),
        title: s.name,
        level: s.level,
        isRequired: true,
        description: `Sección extraída automáticamente: ${s.name}`,
        contentGuidelines: 'Seguir las directrices del documento patrón institucional.',
        citationStyle: 'APA 7',
      }));
    }

    // Guardar secciones
    if (sections.length > 0) {
      await this.prisma.templateSection.deleteMany({ where: { templateId } });
      await this.prisma.templateSection.createMany({
        data: sections.map((s: any, i: number) => ({
          templateId,
          name: s.name || `section_${i}`,
          title: s.title || s.name,
          level: s.level || 1,
          orderIndex: i,
          isRequired: s.isRequired ?? true,
          minWords: s.minWords || null,
          maxWords: s.maxWords || null,
          description: s.description || null,
          contentGuidelines: s.contentGuidelines || null,
          citationStyle: s.citationStyle || 'APA 7',
        })),
      });
    }

    await this.prisma.thesisTemplate.update({
      where: { id: templateId },
      data: {
        isProcessed: true,
        processedAt: new Date(),
        totalSections: sections.length,
        extractedStructure: sections as any,
      },
    });

    this.logger.log(`Template ${templateId} procesado: ${sections.length} secciones`);
    return { templateId, sectionsExtracted: sections.length };
  }

  findAll(programId?: string) {
    return this.prisma.thesisTemplate.findMany({
      where: { ...(programId && { programId }), isActive: true },
      include: { program: { select: { name: true, code: true } }, _count: { select: { sections: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const t = await this.prisma.thesisTemplate.findUnique({
      where: { id },
      include: {
        sections: { orderBy: { orderIndex: 'asc' } },
        rubrics: { include: { criteria: true }, where: { isActive: true } },
        program: true,
      },
    });
    if (!t) throw new NotFoundException('Template no encontrado');
    return t;
  }

  async createRubric(templateId: string, data: any) {
    return this.prisma.evaluationRubric.create({
      data: {
        templateId,
        name: data.name,
        description: data.description,
        structureWeight: data.structureWeight || 30,
        contentWeight: data.contentWeight || 40,
        formWeight: data.formWeight || 20,
        originalityWeight: data.originalityWeight || 10,
        criteria: data.criteria ? { create: data.criteria } : undefined,
      },
      include: { criteria: true },
    });
  }
}
