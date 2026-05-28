import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    const host = config.get('SMTP_HOST', 'localhost');
    const port = parseInt(config.get('SMTP_PORT', '1025'));
    const secure = config.get('SMTP_SECURE') === 'true';
    const user = config.get('SMTP_USER');
    const pass = config.get('SMTP_PASS');

    this.logger.log(`📧 SMTP Config → host:${host} port:${port} user:${user || 'sin auth'}`);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }

  private renderTemplate(templateName: string, data: Record<string, any>): string {
    const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
    if (!fs.existsSync(templatePath)) {
      return this.renderFallback(templateName, data);
    }
    const source = fs.readFileSync(templatePath, 'utf-8');
    return handlebars.compile(source)(data);
  }

  private renderFallback(type: string, data: any): string {
    return `
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333}
.header{background:#1e3a5f;color:white;padding:20px;text-align:center}
.content{padding:30px}.footer{background:#f5f5f5;padding:15px;text-align:center;font-size:12px}</style>
</head><body>
<div class="header"><h2>${data.institutionName || 'Sistema de Tesis'}</h2></div>
<div class="content"><h3>${data.title || type}</h3><p>${data.message || ''}</p>
${data.link ? `<p><a href="${data.link}" style="background:#1e3a5f;color:white;padding:10px 20px;text-decoration:none;border-radius:4px">${data.linkText || 'Ver detalle'}</a></p>` : ''}
</div><div class="footer"><p>Sistema de Gestión de Tesis &copy; ${new Date().getFullYear()}</p></div>
</body></html>`;
  }

  async sendSubmissionReceived(to: string, data: { studentName: string; submissionTitle: string; submissionId: string; appUrl: string }) {
    await this.send(to, `Avance recibido: ${data.submissionTitle}`, 'submission-received', {
      ...data,
      title: 'Avance Recibido',
      message: `Hola ${data.studentName}, tu avance "${data.submissionTitle}" fue recibido exitosamente y está pendiente de revisión por tu asesor. Recibirás una notificación cuando sea evaluado.`,
      link: `${data.appUrl}/submissions/${data.submissionId}`,
      linkText: 'Ver mi Avance',
    });
  }

  async sendAnalysisComplete(to: string, data: { studentName: string; submissionTitle: string; complianceScore: number; finalGrade: number; submissionId: string; appUrl: string }) {
    await this.send(to, `Análisis IA completado: ${data.submissionTitle}`, 'analysis-complete', {
      ...data,
      title: 'Análisis IA Completado',
      message: `Hola ${data.studentName}, el análisis de tu avance "${data.submissionTitle}" fue completado. Cumplimiento: ${data.complianceScore}% | Nota IA: ${data.finalGrade}.`,
      link: `${data.appUrl}/submissions/${data.submissionId}`,
      linkText: 'Ver Retroalimentación Detallada',
    });
  }

  async sendPasswordReset(to: string, data: { userName: string; resetUrl: string }) {
    await this.send(to, 'Recuperación de contraseña', 'password-reset', {
      ...data,
      title: 'Recuperación de Contraseña',
      message: `Hola ${data.userName}, haz clic en el siguiente botón para restablecer tu contraseña. Este enlace expira en 1 hora.`,
      link: data.resetUrl,
      linkText: 'Restablecer Contraseña',
    });
  }

  async sendReviewComplete(
    to: string,
    data: { studentName: string; submissionTitle: string; decision: string; note: string; submissionId: string; appUrl: string },
    pdfBuffer?: Buffer,
  ) {
    const decisionLabel = data.decision === 'APPROVED' ? 'Aprobado' : data.decision === 'REJECTED' ? 'Rechazado' : 'Con Observaciones';
    const attachments = pdfBuffer
      ? [{ filename: `acta-evaluacion-${data.submissionId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      : [];
    await this.send(
      to,
      `Revisión completada: ${data.submissionTitle}`,
      'review-complete',
      {
        ...data,
        title: `Avance ${decisionLabel}`,
        message: `Hola ${data.studentName}, tu avance "${data.submissionTitle}" ha sido ${decisionLabel.toLowerCase()} por tu asesor. ${data.note ? `Comentario: ${data.note}` : ''}${pdfBuffer ? ' Se adjunta el acta de evaluación IA.' : ''}`,
        link: `${data.appUrl}/submissions/${data.submissionId}`,
        linkText: 'Ver Retroalimentación',
      },
      attachments,
    );
  }

  private async send(to: string, subject: string, template: string, data: any, attachments: any[] = []) {
    const html = this.renderTemplate(template, { ...data, institutionName: this.config.get('INSTITUTION_NAME', 'Universidad') });
    try {
      await this.transporter.sendMail({
        from: `"${this.config.get('EMAIL_FROM_NAME', 'Sistema de Tesis')}" <${this.config.get('EMAIL_FROM', 'noreply@universidad.edu.co')}>`,
        to,
        subject,
        html,
        attachments,
      });
      this.logger.log(`Email enviado a ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Error enviando email a ${to}: ${error.message}`);
    }
  }
}
