import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as puppeteer from 'puppeteer';
import {
  GenerateThesisDto,
  ExportThesisPdfDto,
  ThesisVariable,
  OperationalizationRow,
  BudgetRow,
  BudgetSummaryRow,
  ScheduleRow,
  ThesisConsistencyMatrix,
  ThesisInstrument,
  ThesisResultBlock,
  ThesisArticle,
  ThesisDocumentType,
} from './dto/generate-thesis.dto';
import { UNT_LOGO_DATA_URI } from './assets/unt-logo';

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
      const datos = `DATOS DE LA TESIS:
- Título: "${dto.title}"
- Línea de Investigación: ${dto.researchLine}
- Universidad: Universidad Nacional de Trujillo
- Facultad de Ingeniería, Programa de Estudios de Ingeniería de Sistemas
- Ciudad: ${dto.city}
- Año: ${dto.year}`;

      const rol = `Eres un académico experto en investigación universitaria peruana, especializado en Ingeniería de Sistemas. Sigues estrictamente el esquema oficial "Esquema del PT" de la Universidad Nacional de Trujillo (UNT). Escribes en español académico formal. Respondes ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, y NO dejas ningún campo vacío ni con marcadores como "(Pendiente de completar)".`;

      // ─── Llamada 1: Introducción + Referencias + Árboles + Matriz de Consistencia ───
      const promptIntro = `${rol}

${datos}

Genera el JSON con esta estructura EXACTA:
{
  "introduction": "<prosa continua MUY EXTENSA de 3500-4500 palabras>",
  "references": ["<ref1 APA>", "... (EXACTAMENTE 30 o más)"],
  "problemTree": { "centralProblem": "<problema central>", "causes": ["<5 causas>"], "effects": ["<5 efectos>"] },
  "objectiveTree": { "mainObjective": "<objetivo central>", "means": ["<5 medios>"], "ends": ["<5 fines>"] },
  "consistencyMatrix": { "problem":"<pregunta de investigación>", "objective":"<objetivo general>", "hypothesis":"<hipótesis>", "variables":"<variables independiente y dependiente>", "methodology":"<tipo y diseño resumidos>" }
}

REQUERIMIENTOS PARA "introduction" (Capítulo I):
- PROSA CONTINUA sin subtítulos ni numeración (fluir naturalmente entre temas, separando ideas con saltos de párrafo \\n)
- EXTENSIÓN OBLIGATORIA: mínimo 3500 palabras (idealmente 4000-4500). Desarrolla cada parte con profundidad, sin ser repetitivo: amplía con datos, ejemplos, autores y argumentación académica.
- Incluir en orden fluido y DESARROLLADO A FONDO:
  (1) Realidad Problemática: contexto internacional, latinoamericano, nacional (Perú) y local, de lo general a lo específico, con estadísticas y cifras concretas (varios párrafos).
  (2) Antecedentes: describir 5-6 estudios (artículos científicos indexados y tesis nacionales e internacionales), cada uno con autor(es), año, objetivo, metodología y principales resultados (un párrafo por antecedente).
  (3) Marco Teórico: teorías y enfoques conceptuales relevantes, definición de las variables clave, y descripción DETALLADA de exactamente 3 metodologías estándar alternativas para la solución tecnológica propuesta (un párrafo amplio por metodología, con sus fases/ventajas/desventajas).
  (4) Justificación teórica, práctica y metodológica (un párrafo cada una).
  (5) Formulación del Problema como pregunta de investigación.
  (6) Hipótesis condicional.
  (7) Objetivo General y 3-4 Objetivos Específicos medibles.
  (8) Limitaciones del estudio en el aspecto técnico, económico y operativo.

REQUERIMIENTOS PARA "references":
- OBLIGATORIO mínimo 30 referencias reales y verosímiles
- 25% de los últimos 5 años (${currentYear - 5} a ${currentYear}) y 75% de los últimos 10 años
- 40% artículos de revistas científicas indexadas (Scopus, WoS, SciELO) y 60% libros físicos/digitales
- Al menos 25% en idioma inglés
- Formato APA V7 estricto con DOI cuando corresponda, ordenadas alfabéticamente por apellido`;

      // ─── Llamada 2: Capítulo II - Método + Instrumentos (Anexo 5) ───
      const promptMethod = `${rol}

${datos}

Genera el JSON del Capítulo II: Método y los instrumentos de recolección, con esta estructura EXACTA (todos los campos OBLIGATORIOS, COMPLETOS y EXTENSOS, coherentes con el título y la línea de investigación). Cada párrafo debe ser amplio y argumentado (mínimo 4-6 oraciones), citando autores metodológicos cuando corresponda (p. ej. Hernández-Sampieri):
{
  "method": {
    "researchTypeOrientation": "<2 párrafos: Básica o Aplicada, justificando ampliamente>",
    "researchTypeContrast": "<2 párrafos: Descriptiva/Correlacional/Explicativa, justificando>",
    "researchLevel": "<3 párrafos: nivel, proyección, transversal/longitudinal, experimental/no experimental, con sustento>",
    "researchDesign": "<3 párrafos describiendo el diseño, su esquema (ej. G: O1 - X - O2) y la explicación de cada elemento>",
    "population": "<2 párrafos describiendo la población y su ubicación espacio-temporal>",
    "sample": "<2 párrafos con las unidades de análisis y criterios de inclusión/exclusión>",
    "sampling": "<2 párrafos: tipo probabilístico/no probabilístico, fórmula o criterio y tamaño>",
    "variables": [{"name":"<variable>","type":"Independiente|Dependiente|Interviniente","definition":"<definición conceptual>"}],
    "operationalization": [{"variable":"<var>","dimension":"<dimensión>","indicators":"<indicadores>","instrument":"<instrumento>"}],
    "techniques": "<2-3 párrafos sobre técnicas e instrumentos de recolección>",
    "validation": "<2-3 párrafos sobre validez (juicio de expertos) y confiabilidad (alfa de Cronbach)>",
    "dataAnalysis": "<2-3 párrafos: análisis descriptivo e inferencial, pruebas estadísticas y software>",
    "procedure": "<5-6 párrafos describiendo la metodología propuesta organizada en fases/etapas, detallando qué se hace en cada fase>",
    "ethics": "<2-3 párrafos sobre consideraciones éticas (consentimiento informado, confidencialidad, originalidad)>"
  },
  "instruments": [
    {"name":"<nombre del instrumento, ej. Cuestionario / Ficha de Observación>","description":"<2-3 oraciones sobre su propósito y escala>","items":["<ítem o pregunta 1>","<ítem 2>","... 10-15 ítems>"]}
  ]
}

REQUERIMIENTOS:
- "variables": 2 a 4 variables. "operationalization": 5 a 8 filas (una por dimensión).
- "instruments": 2 instrumentos, cada uno con 10-15 ítems concretos y relevantes al tema.
- NO uses marcadores como "(Pendiente)"; redacta contenido real y desarrollado.`;

      // ─── Llamada 3: Capítulo III - Aspectos Administrativos ───
      const promptAdmin = `${rol}

${datos}

Genera el JSON del Capítulo III: Aspectos Administrativos con esta estructura EXACTA (todas las tablas con filas reales, montos realistas en soles peruanos S/; NINGÚN arreglo vacío):
{
  "administrative": {
    "personnel": [{"item":"<rol/persona, ej. Investigador, Asesor>","quantity":"<n>","unitCost":"<S/ monto>","total":"<S/ monto>"}],
    "goods": [{"item":"<bien o útil de escritorio>","quantity":"<n>","unitCost":"<S/ monto>","total":"<S/ monto>"}],
    "travel": [{"item":"<viaje doméstico local/nacional>","quantity":"<n>","unitCost":"<S/ monto>","total":"<S/ monto>"}],
    "services": [{"item":"<servicio: energía, internet, impresión, anillado, consultoría>","quantity":"<n>","unitCost":"<S/ monto>","total":"<S/ monto>"}],
    "technological": [{"item":"<hardware o software>","quantity":"<n>","unitCost":"<S/ monto>","total":"<S/ monto>"}],
    "budgetSummary": [{"concept":"Personal|Bienes|Viajes|Servicios|Tecnológicos","amount":"<S/ monto>"}],
    "budgetTotal": "<S/ monto total sumado>",
    "financingExternal": "<1 párrafo sobre fuentes externas>",
    "financingSelf": "<1 párrafo indicando porcentaje de autofinanciamiento>",
    "period": "<1 párrafo: fecha de inicio, fecha de término y dedicación en horas semanales>",
    "schedule": [{"activity":"<actividad del proyecto>","months":[true,false,true,false,false,false,false,false]}]
  }
}

REQUERIMIENTOS:
- Cada tabla (personnel, goods, travel, services, technological) con 2 a 5 filas reales.
- "budgetSummary" debe incluir los 5 conceptos y "budgetTotal" su suma coherente.
- "schedule": 8-12 actividades con un horizonte de 6 a 8 meses; el arreglo "months" debe tener la MISMA longitud en todas las actividades.`;

      // ─── Llamada 4: Capítulos finales de la TESIS (Resultados, Discusión, Conclusiones, Recomendaciones) ───
      const promptThesis = `${rol}

${datos}

Genera el JSON con los capítulos finales del INFORME FINAL DE TESIS (ya ejecutada la investigación), coherentes con el título y la línea de investigación. Redacta como si los resultados ya se hubieran obtenido. Estructura EXACTA (todos los campos OBLIGATORIOS, COMPLETOS y EXTENSOS):
{
  "results": [
    {"title":"<resultado alineado a un objetivo específico de la investigación>","content":"<2-3 párrafos amplios describiendo el resultado obtenido, mencionando datos cuantitativos concretos, porcentajes y la referencia a una tabla o figura (ej. 'la Tabla 7 muestra...', 'la Figura 1 evidencia...')>"}
  ],
  "discussion": "<4-6 párrafos: contrastación de los resultados con los antecedentes y el marco teórico citando autores, interpretación de los hallazgos, coincidencias y diferencias con otros estudios, e implicancias prácticas>",
  "conclusions": ["<una conclusión por cada objetivo (general y específicos), redactada de forma afirmativa y respaldada en los resultados (4-6 ítems)>"],
  "recommendations": ["<recomendación concreta y accionable derivada de las conclusiones (4-6 ítems)>"]
}

REQUERIMIENTOS:
- "results": 3 a 5 bloques, uno por cada objetivo específico; cada "content" con datos verosímiles.
- "conclusions" y "recommendations": entre 4 y 6 ítems cada uno; NO uses marcadores como "(Pendiente)".`;

      // ─── Llamada 5: Artículo científico (plantilla RCSI) ───
      const promptArticle = `${rol}

${datos}

Genera un ARTÍCULO CIENTÍFICO original, autocontenido y condensado, derivado de la investigación, siguiendo la plantilla de la Revista Científica de Sistemas e Informática (RCSI). Estructura EXACTA (todos los campos OBLIGATORIOS y COMPLETOS):
{
  "titleEn": "<traducción fiel del título al inglés, máximo 20 palabras>",
  "abstract": "<abstract en INGLÉS de 150-200 palabras en un solo párrafo, incluyendo: justificación (breve introducción), objetivo, metodología, principales resultados y conclusión>",
  "keywords": "<3 a 5 palabras clave en INGLÉS, en orden alfabético, separadas por coma, que NO estén en el título>",
  "resumen": "<traducción fiel del abstract al ESPAÑOL, 150-200 palabras, un solo párrafo>",
  "palabrasClave": "<traducción fiel de las keywords al ESPAÑOL, orden alfabético, separadas por coma>",
  "introduction": "<3-4 párrafos: problema de investigación, su relevancia/justificación, breve revisión de literatura actualizada y el objetivo del estudio>",
  "materialsAndMethods": "<2-3 párrafos en PASADO y de forma secuencial (metodología repetible): área/espacio del estudio, tipo-nivel-diseño, población-muestra-muestreo, técnicas e instrumentos y análisis de datos>",
  "resultsAndDiscussion": "<4-6 párrafos: presenta los nuevos conocimientos de forma clara y objetiva con datos cuantitativos concretos (menciona tablas/figuras), e inmediatamente los discute contrastándolos con estudios previos citando autores>",
  "conclusions": "<1-2 párrafos: conclusiones breves, precisas y acordes con los objetivos, e indicando líneas de investigación futuras>"
}

REQUERIMIENTOS:
- Español académico formal (salvo titleEn, abstract y keywords que van en inglés).
- Texto continuo en prosa; separa párrafos con \\n. NO uses marcadores como "(Pendiente)".`;

      const model = this.config.get<string>('AI_MODEL', 'gpt-4o-mini');
      const call = (prompt: string, maxTokens: number) =>
        this.openai.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.7,
          response_format: { type: 'json_object' },
        });

      const [resIntro, resMethod, resAdmin, resThesis, resArticle] = await Promise.all([
        call(promptIntro, 9000),
        call(promptMethod, 7000),
        call(promptAdmin, 3500),
        call(promptThesis, 5000),
        call(promptArticle, 4000),
      ]);

      const parse = (r: any, label: string) => {
        try {
          return JSON.parse(r.choices[0].message.content || '{}');
        } catch (e) {
          this.logger.error(`No se pudo parsear el JSON de la sección "${label}"`, e);
          return {};
        }
      };

      const intro = parse(resIntro, 'introducción');
      const methodData = parse(resMethod, 'método');
      const adminData = parse(resAdmin, 'administrativo');
      const thesisData = parse(resThesis, 'tesis');
      const articleData = parse(resArticle, 'artículo');

      return {
        introduction: intro.introduction || '',
        references: Array.isArray(intro.references) ? intro.references : [],
        problemTree: intro.problemTree || { centralProblem: '', causes: [], effects: [] },
        objectiveTree: intro.objectiveTree || { mainObjective: '', means: [], ends: [] },
        consistencyMatrix: intro.consistencyMatrix || {},
        method: methodData.method || {},
        instruments: Array.isArray(methodData.instruments) ? methodData.instruments : [],
        administrative: adminData.administrative || {},
        // Capítulos finales exclusivos del Informe Final de Tesis
        results: Array.isArray(thesisData.results) ? thesisData.results : [],
        discussion: thesisData.discussion || '',
        conclusions: Array.isArray(thesisData.conclusions) ? thesisData.conclusions : [],
        recommendations: Array.isArray(thesisData.recommendations) ? thesisData.recommendations : [],
        // Artículo científico (plantilla RCSI)
        article: (articleData.article || articleData) as ThesisArticle,
      };
    } catch (error) {
      this.logger.error('Error al generar contenido con IA', error);
      throw new InternalServerErrorException('Error al generar el contenido con IA. Verifique la clave de API.');
    }
  }

  async generatePdf(dto: ExportThesisPdfDto): Promise<Buffer> {
    const docType: ThesisDocumentType =
      dto.documentType === 'tesis' || dto.documentType === 'articulo'
        ? dto.documentType
        : 'proyecto';
    const html =
      docType === 'articulo'
        ? this.buildArticleHtml(dto.formData, dto.content)
        : this.buildThesisHtml(dto.formData, dto.content, docType);
    return this.htmlToPdf(html, docType === 'articulo' ? 'Letter' : 'A4');
  }

  private async htmlToPdf(html: string, format: 'A4' | 'Letter' = 'A4'): Promise<Buffer> {
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
        format,
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

  /** Construye el HTML del artículo científico siguiendo la plantilla RCSI. */
  private buildArticleHtml(
    data: GenerateThesisDto,
    content: ExportThesisPdfDto['content'],
  ): string {
    const art = content.article || {};
    const authors = Array.isArray(data.authors) ? data.authors : [data.authors];
    const refs = content.references || [];

    const prose = (text?: string): string => {
      const t = (text || '').trim();
      if (!t) return '<p class="art-body">(Pendiente de completar)</p>';
      return t
        .split(/\n+/)
        .filter((p) => p.trim().length > 0)
        .map((p) => `<p class="art-body">${this.escHtml(p.trim())}</p>`)
        .join('');
    };

    const authorsBlock = authors
      .map(
        (a, i) =>
          `<div class="art-author">${this.escHtml(a)}<sup>${i + 1}</sup>, ORCID iD: 0000-0000-0000-0000, ${this.slugEmail(a)}@unitru.edu.pe</div>`,
      )
      .join('');

    const affiliationsBlock = authors
      .map(
        (_, i) =>
          `<div class="art-affil"><sup>${i + 1}</sup> Universidad Nacional de Trujillo, ${this.escHtml(data.city)}, Perú</div>`,
      )
      .join('');

    const refsBlock = refs.length
      ? refs.map((r) => `<p class="art-ref">${this.escHtml(r)}</p>`).join('')
      : '<p class="art-body">(Pendiente de completar)</p>';

    const creditRoles = [
      'Conceptualización',
      'Curación de datos',
      'Análisis formal',
      'Investigación',
      'Metodología',
      'Redacción - borrador original',
      'Redacción - revisión y edición',
    ];
    const creditBlock = creditRoles
      .map((r) => `<p class="art-body"><strong>${r}:</strong> ${this.escHtml(authors.join(', '))}</p>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Times New Roman',Times,serif; font-size:12pt; line-height:1.5; color:#000; }
  .art-title-en { font-family:'Book Antiqua','Times New Roman',serif; font-size:14pt; font-weight:bold; text-align:center; margin-bottom:6pt; }
  .art-title-es { font-family:'Book Antiqua','Times New Roman',serif; font-size:13pt; font-weight:bold; font-style:italic; text-align:center; margin-bottom:14pt; }
  .art-author { font-size:11pt; text-align:center; line-height:1.4; }
  .art-affil { font-size:10pt; text-align:center; font-style:italic; line-height:1.3; }
  .art-corr { font-size:10pt; text-align:center; margin-top:4pt; margin-bottom:14pt; }
  .art-section { font-size:12pt; font-weight:bold; margin:14pt 0 6pt; }
  .art-body { text-align:justify; margin-bottom:8pt; line-height:1.5; }
  .art-abstract-label { font-weight:bold; }
  .art-box { margin:6pt 0; }
  .art-ref { text-align:justify; margin-bottom:8pt; padding-left:2em; text-indent:-2em; line-height:1.4; }
</style>
</head>
<body>
  <div class="art-title-en">${this.escHtml(art.titleEn || data.title)}</div>
  <div class="art-title-es">${this.escHtml(data.title)}</div>

  ${authorsBlock}
  ${affiliationsBlock}
  <div class="art-corr">Autor de correspondencia: ${this.slugEmail(authors[0] || 'autor')}@unitru.edu.pe</div>

  <div class="art-box">
    <p class="art-body"><span class="art-abstract-label">Abstract:</span> ${this.escHtml(art.abstract || '(Pendiente de completar)')}</p>
    <p class="art-body"><span class="art-abstract-label">Keywords:</span> ${this.escHtml(art.keywords || '')}</p>
  </div>
  <div class="art-box">
    <p class="art-body"><span class="art-abstract-label">Resumen:</span> ${this.escHtml(art.resumen || '(Pendiente de completar)')}</p>
    <p class="art-body"><span class="art-abstract-label">Palabras clave:</span> ${this.escHtml(art.palabrasClave || '')}</p>
  </div>

  <div class="art-section">1. Introducción</div>
  ${prose(art.introduction)}

  <div class="art-section">2. Materiales y métodos</div>
  ${prose(art.materialsAndMethods)}

  <div class="art-section">3. Resultados y discusión</div>
  ${prose(art.resultsAndDiscussion)}

  <div class="art-section">4. Conclusiones</div>
  ${prose(art.conclusions)}

  <div class="art-section">Agradecimientos</div>
  <p class="art-body">Los autores agradecen a la Universidad Nacional de Trujillo y a las personas e instituciones que asesoraron la presente investigación.</p>

  <div class="art-section">Conflicto de intereses</div>
  <p class="art-body">Los autores declaran no tener ningún conflicto de interés en relación con el presente trabajo.</p>

  <div class="art-section">Fuente de financiamiento</div>
  <p class="art-body">Los autores declaran que la investigación fue autofinanciada.</p>

  <div class="art-section">Contribución de autoría</div>
  ${creditBlock}

  <div class="art-section">Referencias bibliográficas</div>
  ${refsBlock}
</body>
</html>`;
  }

  /** Genera un usuario de correo a partir del nombre del autor (placeholder). */
  private slugEmail(name: string): string {
    return (name || 'autor')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 30) || 'autor';
  }

  private buildThesisHtml(
    data: GenerateThesisDto,
    content: ExportThesisPdfDto['content'],
    documentType: ThesisDocumentType = 'proyecto',
  ): string {
    const isThesis = documentType === 'tesis';
    const coverType = isThesis ? 'Informe de Tesis' : 'Informe de Proyecto de Tesis';
    const docNoun = isThesis ? 'de la tesis titulada' : 'del proyecto de tesis titulado';
    const docNounCap = isThesis ? 'El Informe de Tesis' : 'El Informe de Proyecto de Tesis';

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
    const method = content.method || {};
    const admin = content.administrative || {};
    const cm = content.consistencyMatrix || {};
    const instruments = content.instruments || [];

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
  .cover-logo-img { width:110px; height:auto; margin:0 auto; display:block; }
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

  /* ===== MÉTODO / CAPÍTULOS ===== */
  .sub-heading { font-size:12pt; font-weight:bold; margin:14pt 0 6pt; }
  .sub-heading-2 { font-size:12pt; font-weight:bold; margin:10pt 0 4pt; }
  .sub-heading-3 { font-size:12pt; font-weight:bold; font-style:italic; margin:8pt 0 4pt; }

  /* ===== TABLAS ===== */
  .data-table { width:100%; border-collapse:collapse; margin:8pt 0 14pt; font-size:10pt; }
  .data-table th, .data-table td { border:1px solid #444; padding:4pt 6pt; text-align:left; vertical-align:top; }
  .data-table th { background:#e9eef5; font-weight:bold; text-align:center; }
  .data-table td.num { text-align:center; white-space:nowrap; }
  .table-caption { font-size:10pt; font-style:italic; margin:10pt 0 2pt; }
  .gantt td.mark { text-align:center; font-weight:bold; }

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
  <img class="cover-logo-img" src="${UNT_LOGO_DATA_URI}" alt="Universidad Nacional de Trujillo" />
  <div class="cover-type">${coverType}</div>
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
    ['Capítulo II: Método', '—'],
    ['&nbsp;&nbsp;&nbsp;2.1 Tipo de Investigación', '—'],
    ['&nbsp;&nbsp;&nbsp;2.2 Nivel de Investigación', '—'],
    ['&nbsp;&nbsp;&nbsp;2.3 Diseño de Investigación', '—'],
    ['&nbsp;&nbsp;&nbsp;2.4 Población, Muestra y Muestreo', '—'],
    ['&nbsp;&nbsp;&nbsp;2.5 Variables', '—'],
    ['&nbsp;&nbsp;&nbsp;2.6 Técnicas e Instrumentos, Validación y Confiabilidad', '—'],
    ['&nbsp;&nbsp;&nbsp;2.7 Método de Análisis de Datos', '—'],
    ['&nbsp;&nbsp;&nbsp;2.8 Procedimiento', '—'],
    ['&nbsp;&nbsp;&nbsp;2.9 Consideraciones Éticas', '—'],
    ...(isThesis
      ? [
          ['Capítulo III: Resultados', '—'],
          ['Capítulo IV: Discusión', '—'],
          ['Conclusiones', '—'],
          ['Recomendaciones', '—'],
        ]
      : [
          ['Capítulo III: Aspectos Administrativos', '—'],
          ['&nbsp;&nbsp;&nbsp;3.1 Recursos y Presupuesto', '—'],
          ['&nbsp;&nbsp;&nbsp;3.2 Financiamiento', '—'],
          ['&nbsp;&nbsp;&nbsp;3.3 Cronograma de Ejecución', '—'],
        ]),
    ['Referencias Bibliográficas', '—'],
    ['Anexos', '—'],
    ['&nbsp;&nbsp;&nbsp;Anexo 1: Matriz de Consistencia', '—'],
    ['&nbsp;&nbsp;&nbsp;Anexo 2: Árbol de Problemas', '—'],
    ['&nbsp;&nbsp;&nbsp;Anexo 3: Árbol de Objetivos', '—'],
    ['&nbsp;&nbsp;&nbsp;Anexo 4: Matriz de Operacionalización de Variables', '—'],
    ['&nbsp;&nbsp;&nbsp;Anexo 5: Instrumentos de Recolección de Datos', '—'],
    ['&nbsp;&nbsp;&nbsp;Anexo 6: Constancia de Aplicación de Instrumentos', '—'],
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

<!-- ============ CAPÍTULO II: MÉTODO ============ -->
<div class="content-section">
  <div class="section-heading">Capítulo II: Método</div>

  <div class="sub-heading">2.1 Tipo de Investigación</div>
  <div class="sub-heading-3">2.1.1 De Acuerdo a la Orientación o Finalidad</div>
  ${this.proseHtml(method.researchTypeOrientation)}
  <div class="sub-heading-3">2.1.2 De Acuerdo a la Técnica de Contrastación</div>
  ${this.proseHtml(method.researchTypeContrast)}

  <div class="sub-heading">2.2 Nivel de Investigación</div>
  ${this.proseHtml(method.researchLevel)}

  <div class="sub-heading">2.3 Diseño de Investigación</div>
  ${this.proseHtml(method.researchDesign)}

  <div class="sub-heading">2.4 Población, Muestra y Muestreo</div>
  <div class="sub-heading-3">2.4.1 Población</div>
  ${this.proseHtml(method.population)}
  <div class="sub-heading-3">2.4.2 Muestra</div>
  ${this.proseHtml(method.sample)}
  <div class="sub-heading-3">2.4.3 Muestreo</div>
  ${this.proseHtml(method.sampling)}

  <div class="sub-heading">2.5 Variables</div>
  <div class="sub-heading-3">2.5.1 Tipo</div>
  ${this.varTable(method.variables)}
  <div class="sub-heading-3">2.5.2 Operacionalización</div>
  <p class="body-text">La matriz de operacionalización de variables se presenta de forma detallada en el Anexo 4.</p>

  <div class="sub-heading">2.6 Técnicas e Instrumentos, Validación y Confiabilidad</div>
  <div class="sub-heading-3">2.6.1 Técnicas e Instrumentos</div>
  ${this.proseHtml(method.techniques)}
  <div class="sub-heading-3">2.6.2 Validación y Confiabilidad</div>
  ${this.proseHtml(method.validation)}

  <div class="sub-heading">2.7 Método de Análisis de Datos</div>
  ${this.proseHtml(method.dataAnalysis)}

  <div class="sub-heading">2.8 Procedimiento</div>
  ${this.proseHtml(method.procedure)}

  <div class="sub-heading">2.9 Consideraciones Éticas</div>
  ${this.proseHtml(method.ethics)}
</div>

${
  isThesis
    ? `<!-- ============ CAPÍTULO III: RESULTADOS ============ -->
<div class="content-section">
  <div class="section-heading">Capítulo III: Resultados</div>
  ${this.resultsHtml(content.results)}
</div>

<!-- ============ CAPÍTULO IV: DISCUSIÓN ============ -->
<div class="content-section">
  <div class="section-heading">Capítulo IV: Discusión</div>
  ${this.proseHtml(content.discussion)}
</div>

<!-- ============ CONCLUSIONES ============ -->
<div class="content-section">
  <div class="section-heading">Conclusiones</div>
  ${this.numberedListHtml(content.conclusions)}
</div>

<!-- ============ RECOMENDACIONES ============ -->
<div class="content-section">
  <div class="section-heading">Recomendaciones</div>
  ${this.numberedListHtml(content.recommendations)}
</div>`
    : `<!-- ============ CAPÍTULO III: ASPECTOS ADMINISTRATIVOS ============ -->
<div class="content-section">
  <div class="section-heading">Capítulo III: Aspectos Administrativos</div>

  <div class="sub-heading">3.1 Recursos y Presupuesto</div>

  <div class="table-caption">Tabla 1. Recursos de Personal</div>
  ${this.budgetTable(admin.personnel)}

  <div class="table-caption">Tabla 2. Bienes y Útiles de Escritorio</div>
  ${this.budgetTable(admin.goods)}

  <div class="table-caption">Tabla 3. Viajes Domésticos</div>
  ${this.budgetTable(admin.travel)}

  <div class="table-caption">Tabla 4. Servicios</div>
  ${this.budgetTable(admin.services)}

  <div class="table-caption">Tabla 5. Recursos Tecnológicos (Hardware y Software)</div>
  ${this.budgetTable(admin.technological)}

  <div class="table-caption">Tabla 6. Presupuesto Consolidado</div>
  ${this.summaryTable(admin.budgetSummary, admin.budgetTotal)}

  <div class="sub-heading">3.2 Financiamiento</div>
  <div class="sub-heading-3">3.2.1 De Fuentes Externas</div>
  ${this.proseHtml(admin.financingExternal)}
  <div class="sub-heading-3">3.2.2 Autofinanciación</div>
  ${this.proseHtml(admin.financingSelf)}

  <div class="sub-heading">3.3 Cronograma de Ejecución</div>
  <div class="sub-heading-3">3.3.1 Período</div>
  ${this.proseHtml(admin.period)}
  <div class="sub-heading-3">3.3.2 Cronograma (Diagrama de Gantt)</div>
  ${this.scheduleTable(admin.schedule)}
</div>`
}

<!-- ============ REFERENCIAS BIBLIOGRÁFICAS ============ -->
<div class="content-section">
  <div class="section-heading">Referencias Bibliográficas</div>
  ${refsHtml}
</div>

<!-- ============ ANEXOS ============ -->
<div class="content-section">
  <div class="section-heading">Anexos</div>

  <div style="margin-top:20pt;">
    <div class="section-heading" style="font-size:12pt;margin-bottom:16pt;">Anexo 1: Matriz de Consistencia</div>
    ${this.consistencyTable(cm)}
  </div>

  <div style="page-break-before:always;margin-top:20pt;">
    <div class="section-heading" style="font-size:12pt;margin-bottom:16pt;">Anexo 2: Árbol de Problemas</div>
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
    <div class="section-heading" style="font-size:12pt;margin-bottom:16pt;">Anexo 3: Árbol de Objetivos</div>
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

  <div style="page-break-before:always;margin-top:20pt;">
    <div class="section-heading" style="font-size:12pt;margin-bottom:16pt;">Anexo 4: Matriz de Operacionalización de Variables</div>
    ${this.opTable(method.operationalization)}
  </div>

  <div style="page-break-before:always;margin-top:20pt;">
    <div class="section-heading" style="font-size:12pt;margin-bottom:16pt;">Anexo 5: Instrumentos de Recolección de Datos</div>
    ${this.instrumentsHtml(instruments)}
  </div>

  <div style="page-break-before:always;margin-top:20pt;">
    <div class="section-heading" style="font-size:12pt;margin-bottom:16pt;">Anexo 6: Constancia de Aplicación de Instrumentos</div>
    <p class="body-text">Por medio del presente documento, la institución <strong>________________________________</strong>, representada por <strong>________________________________</strong>, en su calidad de ________________________________, deja constancia de que ${authors.map((a) => `<strong>${this.escHtml(a)}</strong>`).join(' y ')}, ${authors.length > 1 ? 'autores' : 'autor'} ${docNoun} "<em>${this.escHtml(data.title)}</em>", aplicó(aron) los instrumentos de recolección de datos descritos en el Anexo 5 dentro de las instalaciones de la institución, con fines exclusivamente académicos y de investigación.</p>
    <p class="body-text">Se expide la presente constancia para los fines que el(los) interesado(s) estime(n) conveniente.</p>
    <p class="body-text" style="margin-top:12pt;">${this.escHtml(data.city)}, ${data.year}</p>
    <div style="margin-top:60pt;text-align:center;">
      <div style="border-top:1px solid #000;width:220pt;margin:0 auto 4pt;"></div>
      <div>Firma y sello del representante de la institución</div>
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
    1. ${docNounCap} titulado "<em>${this.escHtml(data.title)}</em>" es de mi/nuestra
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

  /** Convierte texto (posiblemente con saltos de línea) en párrafos justificados. */
  private proseHtml(text?: string): string {
    const t = (text || '').trim();
    if (!t) return '<p class="body-text">(Pendiente de completar)</p>';
    return t
      .split(/\n+/)
      .filter((p) => p.trim().length > 0)
      .map((p) => `<p class="body-text">${this.escHtml(p.trim())}</p>`)
      .join('');
  }

  private varTable(rows?: ThesisVariable[]): string {
    if (!rows || rows.length === 0) return '<p class="body-text">(Pendiente de completar)</p>';
    const body = rows
      .map(
        (r) =>
          `<tr><td>${this.escHtml(r.name || '')}</td><td class="num">${this.escHtml(r.type || '')}</td><td>${this.escHtml(r.definition || '')}</td></tr>`,
      )
      .join('');
    return `<table class="data-table"><thead><tr><th>Variable</th><th>Tipo</th><th>Definición Conceptual</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  private opTable(rows?: OperationalizationRow[]): string {
    if (!rows || rows.length === 0) return '<p class="body-text">(Pendiente de completar)</p>';
    const body = rows
      .map(
        (r) =>
          `<tr><td>${this.escHtml(r.variable || '')}</td><td>${this.escHtml(r.dimension || '')}</td><td>${this.escHtml(r.indicators || '')}</td><td>${this.escHtml(r.instrument || '')}</td></tr>`,
      )
      .join('');
    return `<table class="data-table"><thead><tr><th>Variable</th><th>Dimensión</th><th>Indicadores</th><th>Instrumento</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  private budgetTable(rows?: BudgetRow[]): string {
    if (!rows || rows.length === 0) return '<p class="body-text">(Pendiente de completar)</p>';
    const body = rows
      .map(
        (r) =>
          `<tr><td>${this.escHtml(r.item || '')}</td><td class="num">${this.escHtml(r.quantity || '')}</td><td class="num">${this.escHtml(r.unitCost || '')}</td><td class="num">${this.escHtml(r.total || '')}</td></tr>`,
      )
      .join('');
    return `<table class="data-table"><thead><tr><th>Descripción</th><th>Cantidad</th><th>Costo Unit.</th><th>Total</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  private summaryTable(rows?: BudgetSummaryRow[], total?: string): string {
    if (!rows || rows.length === 0) return '<p class="body-text">(Pendiente de completar)</p>';
    const body = rows
      .map(
        (r) =>
          `<tr><td>${this.escHtml(r.concept || '')}</td><td class="num">${this.escHtml(r.amount || '')}</td></tr>`,
      )
      .join('');
    const totalRow = total
      ? `<tr><td style="font-weight:bold;text-align:right;">TOTAL</td><td class="num" style="font-weight:bold;">${this.escHtml(total)}</td></tr>`
      : '';
    return `<table class="data-table"><thead><tr><th>Concepto</th><th>Monto (S/)</th></tr></thead><tbody>${body}${totalRow}</tbody></table>`;
  }

  private scheduleTable(rows?: ScheduleRow[]): string {
    if (!rows || rows.length === 0) return '<p class="body-text">(Pendiente de completar)</p>';
    const nMonths = rows.reduce((max, r) => Math.max(max, (r.months || []).length), 0) || 6;
    const monthHeaders = Array.from({ length: nMonths }, (_, i) => `<th>M${i + 1}</th>`).join('');
    const body = rows
      .map((r) => {
        const cells = Array.from({ length: nMonths }, (_, i) =>
          (r.months || [])[i] ? '<td class="mark">●</td>' : '<td></td>',
        ).join('');
        return `<tr><td>${this.escHtml(r.activity || '')}</td>${cells}</tr>`;
      })
      .join('');
    return `<table class="data-table gantt"><thead><tr><th>Actividad</th>${monthHeaders}</tr></thead><tbody>${body}</tbody></table>`;
  }

  private instrumentsHtml(instruments?: ThesisInstrument[]): string {
    if (!instruments || instruments.length === 0)
      return '<p class="body-text">(Pendiente de completar)</p>';
    return instruments
      .map((ins) => {
        const items = (ins.items || [])
          .map((it) => `<li style="margin-bottom:4pt;">${this.escHtml(it)}</li>`)
          .join('');
        return `<div style="margin-bottom:16pt;">
          <div class="sub-heading-2">${this.escHtml(ins.name || 'Instrumento')}</div>
          ${ins.description ? `<p class="body-text">${this.escHtml(ins.description)}</p>` : ''}
          <ol style="margin:6pt 0 6pt 24pt;text-align:justify;">${items}</ol>
        </div>`;
      })
      .join('');
  }

  /** Renderiza los bloques de resultados (Cap. III de la Tesis) como subtítulo + prosa. */
  private resultsHtml(results?: ThesisResultBlock[]): string {
    if (!results || results.length === 0)
      return '<p class="body-text">(Pendiente de completar)</p>';
    return results
      .map(
        (r, i) =>
          `<div class="sub-heading">3.${i + 1} ${this.escHtml(r.title || `Resultado ${i + 1}`)}</div>${this.proseHtml(r.content)}`,
      )
      .join('');
  }

  /** Renderiza una lista numerada (Conclusiones / Recomendaciones). */
  private numberedListHtml(items?: string[]): string {
    if (!items || items.length === 0)
      return '<p class="body-text">(Pendiente de completar)</p>';
    const lis = items
      .map((it) => `<li style="margin-bottom:8pt;">${this.escHtml(it)}</li>`)
      .join('');
    return `<ol style="margin:6pt 0 6pt 28pt;text-align:justify;line-height:1.5;">${lis}</ol>`;
  }

  private consistencyTable(cm: ThesisConsistencyMatrix): string {
    const row = (label: string, value?: string) =>
      `<tr><th style="width:32%;text-align:left;">${label}</th><td>${this.escHtml(value || '(Pendiente de completar)')}</td></tr>`;
    return `<table class="data-table"><tbody>
      ${row('Problema de Investigación', cm.problem)}
      ${row('Objetivo General', cm.objective)}
      ${row('Hipótesis', cm.hypothesis)}
      ${row('Variables', cm.variables)}
      ${row('Metodología', cm.methodology)}
    </tbody></table>`;
  }

  private escHtml(str: string): string {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
