import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as puppeteer from 'puppeteer';
import { GenerateThesisDto, ExportThesisPdfDto } from './dto/generate-thesis.dto';

@Injectable()
export class ThesisGeneratorService {
  private readonly logger = new Logger(ThesisGeneratorService.name);
  private openai: OpenAI;

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({ apiKey: this.config.get<string>('OPENAI_API_KEY') });
  }

  async generateContent(dto: GenerateThesisDto) {
    this.logger.log(`Generando contenido de tesis para: "${dto.title}"`);
    try {
      const currentYear = new Date().getFullYear();
      const prompt = `Eres un académico experto en investigación universitaria peruana, especializado en Ingeniería de Sistemas. Genera el contenido académico completo para un Informe de Proyecto de Tesis con los siguientes datos:

DATOS DE LA TESIS:
- Título: "${dto.title}"
- Línea de Investigación: ${dto.researchLine}
- Universidad: Universidad Nacional de Trujillo
- Programa: Ingeniería de Sistemas
- Ciudad: ${dto.city}
- Año: ${dto.year}

INSTRUCCIÓN CRÍTICA: Responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional antes ni después) con la siguiente estructura exacta:

{
  "introduction": "<texto continuo de 2000-2500 palabras>",
  "references": ["<ref1 APA V7>", "<ref2 APA V7>", ...],
  "problemTree": {
    "centralProblem": "<problema central>",
    "causes": ["<causa1>", "<causa2>", "<causa3>", "<causa4>", "<causa5>"],
    "effects": ["<efecto1>", "<efecto2>", "<efecto3>", "<efecto4>", "<efecto5>"]
  },
  "objectiveTree": {
    "mainObjective": "<objetivo central>",
    "means": ["<medio1>", "<medio2>", "<medio3>", "<medio4>", "<medio5>"],
    "ends": ["<fin1>", "<fin2>", "<fin3>", "<fin4>", "<fin5>"]
  }
}

REQUERIMIENTOS PARA "introduction":
- PROSA CONTINUA sin subtítulos ni numeración (fluir naturalmente entre temas)
- Incluir en orden fluido: (1) Realidad Problemática de lo general a específico con estadísticas, (2) Antecedentes con 4-5 artículos científicos indexados y tesis nacionales/internacionales, (3) Marco Teórico con teorías relevantes y descripción detallada de exactamente 3 metodologías estándar para la solución tecnológica propuesta, (4) Justificación teórica/práctica/metodológica, (5) Formulación del Problema como pregunta de investigación, (6) Hipótesis condicional, (7) Objetivo General y 3-4 Objetivos Específicos medibles, (8) Limitaciones de espacio y tiempo
- Español académico formal, mínimo 2000 palabras

REQUERIMIENTOS PARA "references":
- Exactamente 30 referencias mínimo
- 80% de años ${currentYear - 5} a ${currentYear} (últimos 5 años)
- 80% artículos de revistas científicas indexadas (Scopus, WoS, SciELO)
- 80% en idioma inglés
- Formato APA V7 estricto con DOI cuando corresponda
- Ordenadas alfabéticamente por primer apellido del autor`;

      const response = await this.openai.chat.completions.create({
        model: this.config.get<string>('AI_MODEL', 'gpt-4o-mini'),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4500,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0].message.content || '{}';
      return JSON.parse(raw);
    } catch (error) {
      this.logger.error('Error al generar contenido con IA', error);
      throw new InternalServerErrorException('Error al generar el contenido con IA. Verifique la clave de API.');
    }
  }

  async generatePdf(dto: ExportThesisPdfDto): Promise<Buffer> {
    const html = this.buildThesisHtml(dto.formData, dto.content);
    return this.htmlToPdf(html);
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    const execPath = this.config.get<string>('PUPPETEER_EXECUTABLE_PATH') || undefined;
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '2.5cm', right: '2.5cm', bottom: '3cm', left: '3cm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `<div style="font-family:Arial,sans-serif;font-size:10pt;color:#000;width:100%;text-align:right;padding-right:2.5cm;padding-bottom:0.5cm;box-sizing:border-box;"><span class="pageNumber"></span></div>`,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private buildThesisHtml(
    data: GenerateThesisDto,
    content: ExportThesisPdfDto['content'],
  ): string {
    const introParagraphs = (content.introduction || '')
      .split(/\n+/)
      .filter((p) => p.trim().length > 0)
      .map((p) => `<p class="body-text">${p.trim()}</p>`)
      .join('');

    const refsHtml = (content.references || [])
      .map((ref) => `<p class="ref-item">${this.escHtml(ref)}</p>`)
      .join('');

    const pt = content.problemTree || { centralProblem: '', causes: [], effects: [] };
    const ot = content.objectiveTree || { mainObjective: '', means: [], ends: [] };

    const treeItemsHtml = (items: string[]) =>
      items.map((i) => `<div class="tree-item">${this.escHtml(i)}</div>`).join('');

    const authors = Array.isArray(data.authors) ? data.authors : [data.authors];

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Arial Narrow',Arial,sans-serif; font-size:12pt; line-height:1.5; color:#000; }

  /* ===== CARÁTULA ===== */
  .cover { page-break-after:always; width:100%; min-height:24cm; display:flex; flex-direction:column; align-items:center; text-align:center; padding:0.5cm 0; gap:0.6cm; }
  .cover-inst { font-size:13pt; font-weight:bold; text-transform:uppercase; line-height:1.4; }
  .cover-faculty { font-size:12pt; font-weight:bold; text-transform:uppercase; }
  .cover-program { font-size:12pt; text-transform:uppercase; }
  .cover-logo { width:80px; height:80px; border:3px solid #1e3a5f; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto; }
  .cover-logo-text { font-size:24pt; font-weight:bold; color:#1e3a5f; letter-spacing:-1px; }
  .cover-type { font-size:12pt; font-weight:bold; text-transform:uppercase; border-top:2px solid #000; border-bottom:2px solid #000; padding:6pt 0; width:100%; margin:0.4cm 0; }
  .cover-title { font-size:13pt; font-weight:bold; line-height:1.4; max-width:90%; margin:0 auto; }
  .cover-authors { font-size:12pt; line-height:2; }
  .cover-advisor { font-size:12pt; margin-top:0.2cm; }
  .cover-line { font-size:11pt; margin-top:0.2cm; }
  .cover-footer { font-size:12pt; margin-top:auto; line-height:1.8; }

  /* ===== JURADO ===== */
  .jury { page-break-after:always; width:100%; min-height:24cm; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:2cm; }
  .section-heading { font-size:13pt; font-weight:bold; text-transform:uppercase; text-align:center; margin:16pt 0 12pt 0; }
  .jury-member { text-align:center; }
  .jury-line { border-top:1px solid #000; width:220pt; margin:0 auto 4pt; }
  .jury-name { font-size:12pt; font-weight:bold; }
  .jury-role { font-size:12pt; }

  /* ===== ÍNDICE ===== */
  .toc { page-break-after:always; }
  .toc-row { display:flex; align-items:flex-end; margin:4pt 0; font-size:12pt; }
  .toc-label { white-space:nowrap; }
  .toc-dots { flex:1; border-bottom:1px dotted #000; margin:0 4pt 2pt; min-width:20pt; }
  .toc-page { white-space:nowrap; }

  /* ===== CUERPO ===== */
  .content-section { page-break-before:always; }
  .body-text { text-align:justify; margin-bottom:12pt; line-height:1.5; }

  /* ===== REFERENCIAS ===== */
  .ref-item { margin-bottom:10pt; padding-left:2em; text-indent:-2em; text-align:justify; line-height:1.5; }

  /* ===== ÁRBOL ===== */
  .tree-block { margin:12pt 0; }
  .tree-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8pt; margin:8pt 0; }
  .tree-item { border:1px solid #555; padding:6pt 8pt; font-size:10pt; text-align:center; background:#f8f8f8; }
  .tree-central { border:2px solid #1e3a5f; padding:10pt; text-align:center; font-weight:bold; font-size:11pt; max-width:380pt; margin:8pt auto; }
  .tree-label { font-size:11pt; font-weight:bold; text-transform:uppercase; margin:8pt 0 4pt; text-align:center; }

  /* ===== DECLARACIÓN ===== */
  .declaration { page-break-before:always; }
  .declaration-body { text-align:justify; margin-bottom:12pt; line-height:1.5; }
  .sig-row { display:flex; justify-content:space-around; margin-top:60pt; }
  .sig-block { text-align:center; }
  .sig-line { border-top:1px solid #000; width:160pt; margin:0 auto 4pt; }
</style>
</head>
<body>

<!-- ============ CARÁTULA ============ -->
<div class="cover">
  <div>
    <div class="cover-inst">Universidad Nacional de Trujillo</div>
    <div class="cover-faculty">Facultad de Ingeniería</div>
    <div class="cover-program">Programa de Estudios de Ingeniería de Sistemas</div>
  </div>
  <div class="cover-logo"><div class="cover-logo-text">UNT</div></div>
  <div class="cover-type">Informe de Proyecto de Tesis</div>
  <div class="cover-title">${this.escHtml(data.title)}</div>
  <div class="cover-authors">
    ${authors.map((a) => `<div>Bach. ${this.escHtml(a)}</div>`).join('')}
  </div>
  <div class="cover-advisor">
    <strong>Asesor:</strong><br>
    ${this.escHtml(data.advisorDegree || 'Dr.')} ${this.escHtml(data.advisor)}
  </div>
  <div class="cover-line">
    <strong>Línea de Investigación:</strong><br>
    ${this.escHtml(data.researchLine)}
  </div>
  <div class="cover-footer">
    <div>${this.escHtml(data.city)} – Perú</div>
    <div>${data.year}</div>
  </div>
</div>

<!-- ============ JURADO DICTAMINADOR ============ -->
<div class="jury">
  <div class="section-heading">Jurado Dictaminador</div>
  <div class="jury-member">
    <div class="jury-line"></div>
    <div class="jury-name">${this.escHtml(data.juryPresidentDegree || 'Dr.')} ${this.escHtml(data.juryPresident)}</div>
    <div class="jury-role">Presidente</div>
  </div>
  <div class="jury-member">
    <div class="jury-line"></div>
    <div class="jury-name">${this.escHtml(data.jurySecretaryDegree || 'Dr.')} ${this.escHtml(data.jurySecretary)}</div>
    <div class="jury-role">Secretario</div>
  </div>
  <div class="jury-member">
    <div class="jury-line"></div>
    <div class="jury-name">${this.escHtml(data.juryVocalDegree || 'Dr.')} ${this.escHtml(data.juryVocal)}</div>
    <div class="jury-role">Vocal / Asesor</div>
  </div>
</div>

<!-- ============ ÍNDICE GENERAL ============ -->
<div class="toc">
  <div class="section-heading">Índice General</div>
  ${[
    ['Carátula', 'i'],
    ['Jurado Dictaminador', 'ii'],
    ['Índice General', 'iii'],
    ['Capítulo I: Introducción', '1'],
    ['Referencias Bibliográficas', '—'],
    ['Anexos', '—'],
    ['&nbsp;&nbsp;&nbsp;Anexo 1: Árbol de Problemas', '—'],
    ['&nbsp;&nbsp;&nbsp;Anexo 2: Árbol de Objetivos', '—'],
    ['Declaración Jurada', '—'],
  ]
    .map(
      ([label, pg]) =>
        `<div class="toc-row"><span class="toc-label">${label}</span><span class="toc-dots"></span><span class="toc-page">${pg}</span></div>`,
    )
    .join('')}
</div>

<!-- ============ CAPÍTULO I: INTRODUCCIÓN ============ -->
<div class="content-section">
  <div class="section-heading">Capítulo I: Introducción</div>
  ${introParagraphs}
</div>

<!-- ============ REFERENCIAS BIBLIOGRÁFICAS ============ -->
<div class="content-section">
  <div class="section-heading">Referencias Bibliográficas</div>
  ${refsHtml}
</div>

<!-- ============ ANEXOS ============ -->
<div class="content-section">
  <div class="section-heading">Anexos</div>

  <div style="margin-top:20pt;">
    <div class="section-heading" style="font-size:12pt;margin-bottom:16pt;">Anexo 1: Árbol de Problemas</div>
    <div class="tree-block">
      <div class="tree-label">Efectos</div>
      <div class="tree-grid">${treeItemsHtml(pt.effects || [])}</div>
      <div style="text-align:center;font-size:20pt;color:#666;">↑</div>
      <div class="tree-central">${this.escHtml(pt.centralProblem || '')}</div>
      <div style="text-align:center;font-size:20pt;color:#666;">↑</div>
      <div class="tree-label">Causas</div>
      <div class="tree-grid">${treeItemsHtml(pt.causes || [])}</div>
    </div>
  </div>

  <div style="page-break-before:always;margin-top:20pt;">
    <div class="section-heading" style="font-size:12pt;margin-bottom:16pt;">Anexo 2: Árbol de Objetivos</div>
    <div class="tree-block">
      <div class="tree-label">Fines</div>
      <div class="tree-grid">${treeItemsHtml(ot.ends || [])}</div>
      <div style="text-align:center;font-size:20pt;color:#666;">↑</div>
      <div class="tree-central">${this.escHtml(ot.mainObjective || '')}</div>
      <div style="text-align:center;font-size:20pt;color:#666;">↑</div>
      <div class="tree-label">Medios</div>
      <div class="tree-grid">${treeItemsHtml(ot.means || [])}</div>
    </div>
  </div>
</div>

<!-- ============ DECLARACIÓN JURADA ============ -->
<div class="declaration">
  <div class="section-heading">Declaración Jurada de Autoría</div>
  <div class="declaration-body">
    Yo/Nosotros, ${authors.map((a) => `<strong>${this.escHtml(a)}</strong>`).join(' y ')}, identificado(s) con DNI (completar),
    egresado(s) del Programa de Estudios de Ingeniería de Sistemas de la Universidad Nacional de Trujillo, declaro/declaramos
    bajo juramento que:
  </div>
  <div class="declaration-body">
    1. El Informe de Proyecto de Tesis titulado "<em>${this.escHtml(data.title)}</em>" es de mi/nuestra
    autoría y no ha sido presentado con anterioridad para la obtención de título o grado profesional alguno.
  </div>
  <div class="declaration-body">
    2. La información y los datos presentados son verídicos y auténticos, y no han sido manipulados, falsificados
    ni copiados de otras investigaciones.
  </div>
  <div class="declaration-body">
    3. Las citas y referencias utilizadas han sido debidamente identificadas de acuerdo con las normas
    internacionales de referencia bibliográfica APA V7.
  </div>
  <div class="declaration-body">
    4. En caso de detectarse alguna falta a la ética académica, al honor o al plagio, asumo/asumimos
    las consecuencias y sanciones legales a que hubiere lugar, conforme a la normativa vigente.
  </div>
  <div class="declaration-body" style="margin-top:16pt;">
    ${this.escHtml(data.city)}, ${data.year}
  </div>
  <div class="sig-row">
    ${authors
      .map(
        (a) => `
      <div class="sig-block">
        <div class="sig-line"></div>
        <div>Bach. ${this.escHtml(a)}</div>
        <div>DNI: ________________________</div>
      </div>`,
      )
      .join('')}
  </div>
</div>

</body>
</html>`;
  }

  private escHtml(str: string): string {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
