import { Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as fs from 'fs';

export interface ExtractedDocument {
  title: string;
  author: string;
  pageCount: number;
  wordCount: number;
  fullText: string;
  sections: ExtractedSection[];
  metadata: Record<string, any>;
}

export interface ExtractedSection {
  name: string;
  level: number;
  content: string;
  wordCount: number;
  pageStart?: number;
}

@Injectable()
export class DocumentExtractorService {
  private readonly logger = new Logger(DocumentExtractorService.name);

  async extractFromBuffer(buffer: Buffer, mimeType: string, filename: string): Promise<ExtractedDocument> {
    if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
      return this.extractFromPDF(buffer);
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      filename.endsWith('.docx')
    ) {
      return this.extractFromWord(buffer);
    }
    throw new Error(`Tipo de archivo no soportado: ${mimeType}`);
  }

  private async extractFromPDF(buffer: Buffer): Promise<ExtractedDocument> {
    try {
      const data = await pdfParse(buffer);
      const fullText = data.text;
      const sections = this.parseTextIntoSections(fullText);

      return {
        title: this.extractTitle(fullText),
        author: this.extractAuthor(fullText),
        pageCount: data.numpages,
        wordCount: this.countWords(fullText),
        fullText,
        sections,
        metadata: { ...data.metadata, source: 'pdf' },
      };
    } catch (error) {
      this.logger.error(`Error extrayendo PDF: ${error.message}`);
      throw new Error(`No se pudo procesar el PDF: ${error.message}`);
    }
  }

  private async extractFromWord(buffer: Buffer): Promise<ExtractedDocument> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const htmlResult = await mammoth.convertToHtml({ buffer });

      const fullText = result.value;
      const sections = this.parseHtmlIntoSections(htmlResult.value) || this.parseTextIntoSections(fullText);

      return {
        title: this.extractTitle(fullText),
        author: this.extractAuthor(fullText),
        pageCount: Math.ceil(this.countWords(fullText) / 250),
        wordCount: this.countWords(fullText),
        fullText,
        sections,
        metadata: { warnings: result.messages, source: 'docx' },
      };
    } catch (error) {
      this.logger.error(`Error extrayendo Word: ${error.message}`);
      throw new Error(`No se pudo procesar el archivo Word: ${error.message}`);
    }
  }

  private parseHtmlIntoSections(html: string): ExtractedSection[] {
    const sections: ExtractedSection[] = [];
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
    const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gi;

    let lastIndex = 0;
    let currentSection: ExtractedSection | null = null;
    let contentBuffer = '';

    // Extraer texto plano del HTML
    const cleanHtml = (str: string) => str.replace(/<[^>]+>/g, '').trim();

    const parts: { type: 'heading' | 'para'; level?: number; text: string; index: number }[] = [];

    let match;
    const headingRegexG = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
    while ((match = headingRegexG.exec(html)) !== null) {
      parts.push({ type: 'heading', level: parseInt(match[1]), text: cleanHtml(match[2]), index: match.index });
    }

    parts.sort((a, b) => a.index - b.index);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const nextPart = parts[i + 1];

      if (part.type === 'heading' && part.text.length > 2) {
        const contentHtml = html.substring(
          part.index + part.text.length + 10,
          nextPart ? nextPart.index : html.length,
        );
        const content = cleanHtml(contentHtml);

        sections.push({
          name: part.text,
          level: part.level || 1,
          content: content.substring(0, 5000),
          wordCount: this.countWords(content),
        });
      }
    }

    return sections.length > 0 ? sections : this.parseTextIntoSections(cleanHtml(html));
  }

  private parseTextIntoSections(text: string): ExtractedSection[] {
    const sections: ExtractedSection[] = [];
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    const headingPatterns = [
      /^(CAPÍTULO|CAPITULO|CHAPTER)\s+\d+[\.\:]/i,
      /^\d+\.\s+[A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚÑ\s]{3,}/,
      /^\d+\.\d+\s+[A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚÑ\s]{3,}/,
      /^(INTRODUCCIÓN|INTRODUCTION|ABSTRACT|RESUMEN|CONCLUSIONES?|BIBLIOGRAFÍA|REFERENCIAS?|METODOLOGÍA|MARCO TEÓRICO|PLANTEAMIENTO|OBJETIVOS?|JUSTIFICACIÓN|ANTECEDENTES)/i,
    ];

    let currentSection: ExtractedSection | null = null;
    let contentLines: string[] = [];

    const isHeading = (line: string) =>
      headingPatterns.some((p) => p.test(line)) ||
      (line.length < 80 && line === line.toUpperCase() && line.length > 5);

    for (const line of lines) {
      if (isHeading(line)) {
        if (currentSection) {
          currentSection.content = contentLines.join('\n');
          currentSection.wordCount = this.countWords(currentSection.content);
          sections.push(currentSection);
          contentLines = [];
        }

        const level = line.match(/^\d+\.\d+/) ? 2 : line.match(/^\d+\./) ? 1 : 1;
        currentSection = { name: line, level, content: '', wordCount: 0 };
      } else if (currentSection) {
        contentLines.push(line);
      }
    }

    if (currentSection && contentLines.length > 0) {
      currentSection.content = contentLines.join('\n');
      currentSection.wordCount = this.countWords(currentSection.content);
      sections.push(currentSection);
    }

    // Si no se detectaron secciones, crear una sola sección con todo el texto
    if (sections.length === 0) {
      sections.push({
        name: 'Documento Completo',
        level: 1,
        content: text.substring(0, 10000),
        wordCount: this.countWords(text),
      });
    }

    return sections;
  }

  private extractTitle(text: string): string {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    // El título suele estar en las primeras líneas, es la línea más larga antes de "Universidad" o similar
    for (const line of lines.slice(0, 20)) {
      if (
        line.length > 20 &&
        line.length < 250 &&
        !line.includes('@') &&
        !/^(Universidad|Faculty|Facultad|Programa|Maestría|Doctorado)/i.test(line)
      ) {
        return line;
      }
    }
    return 'Título no detectado';
  }

  private extractAuthor(text: string): string {
    const authorPatterns = [
      /(?:Autor|Presentado por|Elaborado por|Estudiante)[:\s]+([A-ZÁÉÍÓÚ][a-záéíóú]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóú]+){1,3})/i,
      /(?:Por)[:\s]+([A-ZÁÉÍÓÚ][a-záéíóú]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóú]+){1,3})/i,
    ];

    for (const pattern of authorPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return 'Autor no detectado';
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }
}
