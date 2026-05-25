import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private config: ConfigService,
  ) {}

  async generateIndividualReport(submissionId: string): Promise<Buffer> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true, email: true } }, program: true } },
        template: { select: { name: true, version: true } },
        aiAnalysis: { include: { findings: { orderBy: [{ severity: 'asc' }] } } },
        humanReview: { include: { reviewer: { select: { firstName: true, lastName: true } }, checklistItems: true } },
      },
    });

    if (!submission) throw new NotFoundException('Avance no encontrado');

    const html = this.buildReportHtml(submission);
    return this.htmlToPdf(html);
  }

  private buildReportHtml(data: any): string {
    const ai = data.aiAnalysis;
    const review = data.humanReview;
    const now = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

    const severityLabel = { CRITICAL: 'Crítico', MAJOR: 'Mayor', MINOR: 'Menor', SUGGESTION: 'Sugerencia' };
    const severityColor = { CRITICAL: '#dc2626', MAJOR: '#ea580c', MINOR: '#ca8a04', SUGGESTION: '#2563eb' };

    const findingsHtml = (ai?.findings || []).map((f: any) => `
      <div style="border-left:4px solid ${severityColor[f.severity] || '#999'};padding:12px 16px;margin:12px 0;background:#f9fafb;border-radius:0 6px 6px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="font-size:14px">${f.title}</strong>
          <span style="background:${severityColor[f.severity] || '#999'};color:white;padding:2px 10px;border-radius:12px;font-size:11px">${severityLabel[f.severity] || f.severity}</span>
        </div>
        <p style="margin:4px 0;color:#374151;font-size:13px">${f.description}</p>
        ${f.sectionName ? `<p style="margin:4px 0;color:#6b7280;font-size:12px"><em>Sección: ${f.sectionName}</em></p>` : ''}
        <div style="margin-top:8px;padding:8px;background:#eff6ff;border-radius:4px">
          <strong style="font-size:12px;color:#1e40af">Cómo corregir:</strong>
          <ol style="margin:4px 0;padding-left:20px;font-size:12px;color:#374151">
            ${(f.correctionSteps || []).map((s: string) => `<li>${s}</li>`).join('')}
          </ol>
        </div>
      </div>`).join('');

    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; font-size: 13px; line-height: 1.6; }
  .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 32px 40px; }
  .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .header p { opacity: 0.85; font-size: 13px; }
  .watermark { font-size: 11px; opacity: 0.7; margin-top: 8px; }
  .section { padding: 24px 40px; border-bottom: 1px solid #e5e7eb; }
  .section-title { font-size: 16px; font-weight: 700; color: #1e3a5f; margin-bottom: 16px; border-bottom: 2px solid #1e3a5f; padding-bottom: 6px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-item { margin-bottom: 10px; }
  .info-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  .info-value { font-size: 14px; font-weight: 600; color: #111827; }
  .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 16px 0; }
  .score-card { text-align: center; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
  .score-value { font-size: 28px; font-weight: 700; color: #1e3a5f; }
  .score-label { font-size: 11px; color: #6b7280; margin-top: 4px; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-yellow { background: #fef9c3; color: #854d0e; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .summary-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .footer { background: #f9fafb; padding: 16px 40px; text-align: center; font-size: 11px; color: #6b7280; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head><body>
<div class="header">
  <h1>ACTA DE EVALUACIÓN DE AVANCE DE TESIS</h1>
  <p>${this.config.get('INSTITUTION_NAME', 'Universidad Nacional')}</p>
  <div class="watermark">Generado: ${now} | Sistema de Gestión de Tesis v1.0</div>
</div>

<div class="section">
  <div class="section-title">Información del Avance</div>
  <div class="grid-2">
    <div>
      <div class="info-item"><div class="info-label">Estudiante</div><div class="info-value">${data.student.user.firstName} ${data.student.user.lastName}</div></div>
      <div class="info-item"><div class="info-label">Email</div><div class="info-value">${data.student.user.email}</div></div>
      <div class="info-item"><div class="info-label">Programa</div><div class="info-value">${data.student.program?.name || 'N/A'}</div></div>
    </div>
    <div>
      <div class="info-item"><div class="info-label">Título del Avance</div><div class="info-value">${data.title}</div></div>
      <div class="info-item"><div class="info-label">Versión</div><div class="info-value">v${data.versionNumber} | Período ${data.academicPeriod}</div></div>
      <div class="info-item"><div class="info-label">Documento Patrón</div><div class="info-value">${data.template?.name || 'N/A'}</div></div>
      <div class="info-item"><div class="info-label">Estado Final</div>
        <div class="info-value"><span class="badge ${data.status === 'APPROVED' ? 'badge-green' : data.status === 'REJECTED' ? 'badge-red' : 'badge-yellow'}">${data.status}</span></div>
      </div>
    </div>
  </div>
</div>

${ai ? `
<div class="section">
  <div class="section-title">Evaluación Automatizada por IA</div>
  <div class="score-grid">
    <div class="score-card"><div class="score-value">${ai.complianceScore || 0}%</div><div class="score-label">Cumplimiento Global</div></div>
    <div class="score-card"><div class="score-value">${ai.structureScore || 0}%</div><div class="score-label">Estructura (30%)</div></div>
    <div class="score-card"><div class="score-value">${ai.contentScore || 0}%</div><div class="score-label">Contenido (40%)</div></div>
    <div class="score-card"><div class="score-value">${ai.formScore || 0}%</div><div class="score-label">Forma (20%)</div></div>
  </div>
  <div class="info-item" style="margin-top:12px">
    <div class="info-label">Nota IA (escala ${ai.gradeScale})</div>
    <div class="info-value" style="font-size:20px;color:#1e3a5f">${ai.finalGrade || 0} / ${ai.gradeScale}</div>
  </div>
  ${ai.executiveSummary ? `<div class="summary-box"><strong>Resumen Ejecutivo:</strong><p style="margin-top:8px">${ai.executiveSummary}</p></div>` : ''}

  ${ai.findings?.length > 0 ? `
  <div style="margin-top:20px">
    <strong>Hallazgos Detallados (${ai.findings.length} total):</strong>
    ${findingsHtml}
  </div>` : ''}
</div>` : ''}

${review ? `
<div class="section">
  <div class="section-title">Revisión Humana del Asesor</div>
  <div class="info-item"><div class="info-label">Revisor</div><div class="info-value">${review.reviewer?.firstName} ${review.reviewer?.lastName}</div></div>
  ${review.adjustedGrade ? `<div class="info-item"><div class="info-label">Nota Ajustada por Revisor</div><div class="info-value" style="font-size:20px;color:#1e3a5f">${review.adjustedGrade}</div></div>` : ''}
  ${review.generalComments ? `<div class="summary-box"><strong>Comentarios del Revisor:</strong><p style="margin-top:8px">${review.generalComments}</p></div>` : ''}
</div>` : ''}

<div class="footer">
  <p>Documento generado automáticamente por el Sistema de Gestión de Avances de Tesis</p>
  <p>${this.config.get('INSTITUTION_NAME', 'Universidad Nacional')} &copy; ${new Date().getFullYear()}</p>
</div>
</body></html>`;
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    let browser: puppeteer.Browser | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }, printBackground: true });
      return Buffer.from(pdf);
    } finally {
      if (browser) await browser.close();
    }
  }
}
