import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  PageNumber, Footer, Header, SectionType, ImageRun,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} from 'docx';
import { UNT_LOGO_BASE64 } from './unt-logo';

export interface ThesisData {
  title: string;
  authors: string[];
  advisor: string;
  advisorDegree: string;
  researchLine: string;
  city: string;
  year: number;
  juryPresident: string;
  juryPresidentDegree: string;
  jurySecretary: string;
  jurySecretaryDegree: string;
  juryVocal: string;
  juryVocalDegree: string;
}

export interface ThesisContent {
  introduction: string;
  references: string[];
  problemTree: { centralProblem: string; causes: string[]; effects: string[] };
  objectiveTree: { mainObjective: string; means: string[]; ends: string[] };
  method?: Record<string, any>;
  administrative?: Record<string, any>;
  consistencyMatrix?: Record<string, any>;
  instruments?: any[];
  // Capítulos finales exclusivos del Informe Final de Tesis
  results?: { title?: string; content?: string }[];
  discussion?: string;
  conclusions?: string[];
  recommendations?: string[];
  // Artículo científico (plantilla RCSI)
  article?: {
    titleEn?: string;
    abstract?: string;
    keywords?: string;
    resumen?: string;
    palabrasClave?: string;
    introduction?: string;
    materialsAndMethods?: string;
    resultsAndDiscussion?: string;
    conclusions?: string;
  };
}

export type ThesisDocumentType = 'proyecto' | 'tesis' | 'articulo';

const FONT = 'Arial Narrow';
const SIZE = 24; // 12pt = 24 half-points
const LINE_SPACING = { line: 360, before: 0, after: 200 }; // 1.5 spacing

function body(text: string, bold = false, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: SIZE, bold })],
    alignment: align,
    spacing: LINE_SPACING,
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), font: FONT, size: 28, bold: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240 },
    pageBreakBefore: true,
  });
}

function empty(): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: '', font: FONT, size: SIZE })], spacing: { before: 0, after: 120 } });
}

function coverCentered(text: string, bold = false, size = SIZE): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size, bold })],
    alignment: AlignmentType.CENTER,
    spacing: LINE_SPACING,
  });
}

function refItem(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: SIZE })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: LINE_SPACING,
    indent: { left: 720, hanging: 720 }, // hanging indent 0.5 inch = 720 twips
  });
}

function subHeading(text: string, italic = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: SIZE, bold: true, italics: italic })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 200, after: 80 },
  });
}

function proseParagraphs(text?: string): Paragraph[] {
  const t = (text || '').trim();
  if (!t) return [body('(Pendiente de completar)')];
  return t.split(/\n+/).filter((p) => p.trim().length > 0).map((p) => body(p.trim()));
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function logoParagraph(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [
      new ImageRun({
        type: 'png',
        data: base64ToUint8Array(UNT_LOGO_BASE64),
        transformation: { width: 130, height: 92 },
      }),
    ],
  });
}

const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 1, color: '444444' };
const TABLE_BORDERS = {
  top: TABLE_BORDER, bottom: TABLE_BORDER, left: TABLE_BORDER, right: TABLE_BORDER,
  insideHorizontal: TABLE_BORDER, insideVertical: TABLE_BORDER,
};

function cell(text: string, opts: { bold?: boolean; header?: boolean; align?: any } = {}): TableCell {
  return new TableCell({
    shading: opts.header ? { fill: 'E9EEF5' } : undefined,
    children: [
      new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        spacing: { before: 20, after: 20 },
        children: [new TextRun({ text: text || '', font: FONT, size: 20, bold: opts.bold || opts.header })],
      }),
    ],
  });
}

function dataTable(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h) => cell(h, { header: true, align: AlignmentType.CENTER })),
      }),
      ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) })),
    ],
  });
}

function tableCaption(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 20, italics: true })],
    spacing: { before: 160, after: 40 },
  });
}

// 2.5cm = ~1418 twips, 3cm = ~1701 twips
const MARGINS = { top: 1418, right: 1418, bottom: 1418, left: 1701 };

export async function generateDocxBlob(
  data: ThesisData,
  content: ThesisContent,
  documentType: ThesisDocumentType = 'proyecto',
): Promise<Blob> {
  if (documentType === 'articulo') return generateArticleDocxBlob(data, content);

  const isThesis = documentType === 'tesis';
  const coverType = isThesis ? 'INFORME DE TESIS' : 'INFORME DE PROYECTO DE TESIS';
  const docNoun = isThesis ? 'de la tesis titulada' : 'del proyecto de tesis titulado';
  const docNounCap = isThesis ? 'El Informe de Tesis' : 'El Informe de Proyecto de Tesis';
  const authors = Array.isArray(data.authors) ? data.authors : [data.authors];
  const introParagraphs = (content.introduction || '')
    .split(/\n+/)
    .filter((p) => p.trim().length > 0)
    .map((p) => body(p.trim()));

  const refParagraphs = (content.references || []).map((r) => refItem(r));

  const pt = content.problemTree || { centralProblem: '', causes: [], effects: [] };
  const ot = content.objectiveTree || { mainObjective: '', means: [], ends: [] };
  const method = content.method || {};
  const admin = content.administrative || {};
  const cm = content.consistencyMatrix || {};

  const tableOrFallback = (headers: string[], rows: string[][]): (Table | Paragraph)[] =>
    rows.length > 0 ? [dataTable(headers, rows)] : [body('(Pendiente de completar)')];

  const variableRows: string[][] = (method.variables || []).map((v: any) => [v?.name || '', v?.type || '', v?.definition || '']);
  const opRows: string[][] = (method.operationalization || []).map((o: any) => [o?.variable || '', o?.dimension || '', o?.indicators || '', o?.instrument || '']);
  const budgetRows = (arr: any[]): string[][] => (arr || []).map((r) => [r?.item || '', r?.quantity || '', r?.unitCost || '', r?.total || '']);
  const summaryRows: string[][] = (admin.budgetSummary || []).map((r: any) => [r?.concept || '', r?.amount || '']);
  if (admin.budgetTotal) summaryRows.push(['TOTAL', admin.budgetTotal]);

  const scheduleData: any[] = admin.schedule || [];
  const nMonths = scheduleData.reduce((m, r) => Math.max(m, (r?.months || []).length), 0) || 6;
  const scheduleHeaders = ['Actividad', ...Array.from({ length: nMonths }, (_, i) => `M${i + 1}`)];
  const scheduleRows: string[][] = scheduleData.map((r) => [
    r?.activity || '',
    ...Array.from({ length: nMonths }, (_, i) => ((r?.months || [])[i] ? '●' : '')),
  ]);

  // ─── CAPÍTULO II: MÉTODO ───────────────────────────────────────────────
  const chapterII: (Paragraph | Table)[] = [
    heading('Capítulo II: Método'),
    subHeading('2.1 Tipo de Investigación'),
    subHeading('2.1.1 De Acuerdo a la Orientación o Finalidad', true),
    ...proseParagraphs(method.researchTypeOrientation),
    subHeading('2.1.2 De Acuerdo a la Técnica de Contrastación', true),
    ...proseParagraphs(method.researchTypeContrast),
    subHeading('2.2 Nivel de Investigación'),
    ...proseParagraphs(method.researchLevel),
    subHeading('2.3 Diseño de Investigación'),
    ...proseParagraphs(method.researchDesign),
    subHeading('2.4 Población, Muestra y Muestreo'),
    subHeading('2.4.1 Población', true),
    ...proseParagraphs(method.population),
    subHeading('2.4.2 Muestra', true),
    ...proseParagraphs(method.sample),
    subHeading('2.4.3 Muestreo', true),
    ...proseParagraphs(method.sampling),
    subHeading('2.5 Variables'),
    subHeading('2.5.1 Tipo', true),
    ...tableOrFallback(['Variable', 'Tipo', 'Definición Conceptual'], variableRows),
    subHeading('2.5.2 Operacionalización', true),
    body('La matriz de operacionalización de variables se presenta de forma detallada en el Anexo 4.'),
    subHeading('2.6 Técnicas e Instrumentos, Validación y Confiabilidad'),
    subHeading('2.6.1 Técnicas e Instrumentos', true),
    ...proseParagraphs(method.techniques),
    subHeading('2.6.2 Validación y Confiabilidad', true),
    ...proseParagraphs(method.validation),
    subHeading('2.7 Método de Análisis de Datos'),
    ...proseParagraphs(method.dataAnalysis),
    subHeading('2.8 Procedimiento'),
    ...proseParagraphs(method.procedure),
    subHeading('2.9 Consideraciones Éticas'),
    ...proseParagraphs(method.ethics),
  ];

  // ─── CAPÍTULO III: ASPECTOS ADMINISTRATIVOS ────────────────────────────
  const chapterIII: (Paragraph | Table)[] = [
    heading('Capítulo III: Aspectos Administrativos'),
    subHeading('3.1 Recursos y Presupuesto'),
    tableCaption('Tabla 1. Recursos de Personal'),
    ...tableOrFallback(['Descripción', 'Cantidad', 'Costo Unit.', 'Total'], budgetRows(admin.personnel)),
    tableCaption('Tabla 2. Bienes y Útiles de Escritorio'),
    ...tableOrFallback(['Descripción', 'Cantidad', 'Costo Unit.', 'Total'], budgetRows(admin.goods)),
    tableCaption('Tabla 3. Viajes Domésticos'),
    ...tableOrFallback(['Descripción', 'Cantidad', 'Costo Unit.', 'Total'], budgetRows(admin.travel)),
    tableCaption('Tabla 4. Servicios'),
    ...tableOrFallback(['Descripción', 'Cantidad', 'Costo Unit.', 'Total'], budgetRows(admin.services)),
    tableCaption('Tabla 5. Recursos Tecnológicos (Hardware y Software)'),
    ...tableOrFallback(['Descripción', 'Cantidad', 'Costo Unit.', 'Total'], budgetRows(admin.technological)),
    tableCaption('Tabla 6. Presupuesto Consolidado'),
    ...tableOrFallback(['Concepto', 'Monto (S/)'], summaryRows),
    subHeading('3.2 Financiamiento'),
    subHeading('3.2.1 De Fuentes Externas', true),
    ...proseParagraphs(admin.financingExternal),
    subHeading('3.2.2 Autofinanciación', true),
    ...proseParagraphs(admin.financingSelf),
    subHeading('3.3 Cronograma de Ejecución'),
    subHeading('3.3.1 Período', true),
    ...proseParagraphs(admin.period),
    subHeading('3.3.2 Cronograma (Diagrama de Gantt)', true),
    ...tableOrFallback(scheduleHeaders, scheduleRows),
  ];

  // ─── CAPÍTULOS FINALES (sólo TESIS): Resultados, Discusión, Conclusiones, Recomendaciones ─
  const resultsBlocks: (Paragraph | Table)[] = (content.results || []).length === 0
    ? [body('(Pendiente de completar)')]
    : (content.results || []).flatMap((r, i) => [
        subHeading(`3.${i + 1} ${r?.title || `Resultado ${i + 1}`}`),
        ...proseParagraphs(r?.content),
      ]);

  const numberedList = (items?: string[]): Paragraph[] =>
    !items || items.length === 0
      ? [body('(Pendiente de completar)')]
      : items.map(
          (it, i) =>
            new Paragraph({
              children: [new TextRun({ text: `${i + 1}. ${it}`, font: FONT, size: SIZE })],
              alignment: AlignmentType.JUSTIFIED,
              spacing: LINE_SPACING,
              indent: { left: 360, hanging: 360 },
            }),
        );

  const chapterFinal: (Paragraph | Table)[] = [
    heading('Capítulo III: Resultados'),
    ...resultsBlocks,
    heading('Capítulo IV: Discusión'),
    ...proseParagraphs(content.discussion),
    heading('Conclusiones'),
    ...numberedList(content.conclusions),
    heading('Recomendaciones'),
    ...numberedList(content.recommendations),
  ];

  // ─── ANEXOS adicionales ────────────────────────────────────────────────
  const consistencyRows: string[][] = [
    ['Problema de Investigación', cm.problem || '(Pendiente de completar)'],
    ['Objetivo General', cm.objective || '(Pendiente de completar)'],
    ['Hipótesis', cm.hypothesis || '(Pendiente de completar)'],
    ['Variables', cm.variables || '(Pendiente de completar)'],
    ['Metodología', cm.methodology || '(Pendiente de completar)'],
  ];

  const instruments: any[] = content.instruments || [];
  const instrumentsBlocks: Paragraph[] = instruments.length === 0
    ? [body('(Pendiente de completar)')]
    : instruments.flatMap((ins) => [
        subHeading(ins?.name || 'Instrumento'),
        ...(ins?.description ? [body(ins.description)] : []),
        ...((ins?.items || []) as string[]).map((it, i) =>
          new Paragraph({
            children: [new TextRun({ text: `${i + 1}. ${it}`, font: FONT, size: SIZE })],
            alignment: AlignmentType.JUSTIFIED,
            spacing: LINE_SPACING,
            indent: { left: 360 },
          }),
        ),
      ]);

  const constanciaText =
    `Por medio del presente documento, la institución ________________________________, representada por ` +
    `________________________________, en su calidad de ________________________________, deja constancia de que ` +
    `${authors.join(' y ')}, ${authors.length > 1 ? 'autores' : 'autor'} ${docNoun} "${data.title}", ` +
    `aplicó(aron) los instrumentos de recolección de datos descritos en el Anexo 5 dentro de las instalaciones de la ` +
    `institución, con fines exclusivamente académicos y de investigación.`;

  const doc = new Document({
    sections: [
      // ─── SECTION 1: CARÁTULA (sin numeración) ───────────────────────
      {
        properties: {
          page: { margin: MARGINS },
          titlePage: true,
          type: SectionType.NEXT_PAGE,
        },
        headers: { default: new Header({ children: [new Paragraph('')] }) },
        footers: {
          default: new Footer({ children: [new Paragraph('')] }),
          first: new Footer({ children: [new Paragraph('')] }),
        },
        children: [
          coverCentered('UNIVERSIDAD NACIONAL DE TRUJILLO', true, 26),
          coverCentered('FACULTAD DE INGENIERÍA', true, 26),
          coverCentered('PROGRAMA DE ESTUDIOS DE INGENIERÍA DE SISTEMAS', true, 24),
          empty(),
          empty(),
          logoParagraph(),
          empty(),
          empty(),
          new Paragraph({
            children: [new TextRun({ text: coverType, font: FONT, size: 28, bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: LINE_SPACING,
            border: { top: { style: 'single', size: 6 }, bottom: { style: 'single', size: 6 } },
          }),
          empty(),
          coverCentered(data.title, true, 26),
          empty(),
          empty(),
          ...authors.map((a) => coverCentered(`Bach. ${a}`, false, 24)),
          empty(),
          coverCentered(`Asesor: ${data.advisorDegree || 'Dr.'} ${data.advisor}`, false, 24),
          empty(),
          coverCentered(`Línea de Investigación: ${data.researchLine}`, false, 24),
          empty(),
          empty(),
          empty(),
          coverCentered(`${data.city} – Perú`, false, 24),
          coverCentered(`${data.year}`, false, 24),
        ],
      },

      // ─── SECTION 2: JURADO + ÍNDICE + CUERPO (con numeración) ───────
      {
        properties: {
          page: { margin: MARGINS },
          type: SectionType.NEXT_PAGE,
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SIZE }),
                ],
              }),
            ],
          }),
        },
        children: [
          // JURADO
          new Paragraph({
            children: [new TextRun({ text: 'JURADO DICTAMINADOR', font: FONT, size: 28, bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 400 },
          }),
          empty(), empty(), empty(),
          coverCentered(`${data.juryPresidentDegree || 'Dr.'} ${data.juryPresident}`, true),
          coverCentered('_________________________________', false),
          coverCentered('Presidente', false),
          empty(), empty(), empty(),
          coverCentered(`${data.jurySecretaryDegree || 'Dr.'} ${data.jurySecretary}`, true),
          coverCentered('_________________________________', false),
          coverCentered('Secretario', false),
          empty(), empty(), empty(),
          coverCentered(`${data.juryVocalDegree || 'Dr.'} ${data.juryVocal}`, true),
          coverCentered('_________________________________', false),
          coverCentered('Vocal / Asesor', false),

          // ÍNDICE
          heading('Índice General'),
          body('Carátula ............................................................... i'),
          body('Jurado Dictaminador ................................................... ii'),
          body('Índice General ........................................................ iii'),
          body('Capítulo I: Introducción ................................................ 1'),
          body('Capítulo II: Método ..................................................... —'),
          ...(isThesis
            ? [
                body('Capítulo III: Resultados ............................................... —'),
                body('Capítulo IV: Discusión ................................................. —'),
                body('Conclusiones ........................................................... —'),
                body('Recomendaciones ........................................................ —'),
              ]
            : [body('Capítulo III: Aspectos Administrativos .................................. —')]),
          body('Referencias Bibliográficas .............................................. —'),
          body('Anexos .................................................................. —'),
          body('    Anexo 1: Matriz de Consistencia ...................................... —'),
          body('    Anexo 2: Árbol de Problemas .......................................... —'),
          body('    Anexo 3: Árbol de Objetivos .......................................... —'),
          body('    Anexo 4: Matriz de Operacionalización de Variables ................... —'),
          body('    Anexo 5: Instrumentos de Recolección de Datos ........................ —'),
          body('    Anexo 6: Constancia de Aplicación de Instrumentos .................... —'),
          body('Declaración Jurada ...................................................... —'),

          // CAPÍTULO I
          heading('Capítulo I: Introducción'),
          ...introParagraphs,

          // CAPÍTULO II: MÉTODO
          ...chapterII,

          // CAPÍTULO III en adelante (Administrativos para proyecto; Resultados/Discusión/etc. para tesis)
          ...(isThesis ? chapterFinal : chapterIII),

          // REFERENCIAS
          heading('Referencias Bibliográficas'),
          ...refParagraphs,

          // ANEXOS
          heading('Anexos'),
          new Paragraph({
            children: [new TextRun({ text: 'Anexo 1: Matriz de Consistencia', font: FONT, size: SIZE, bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 240 },
          }),
          dataTable(['Elemento', 'Descripción'], consistencyRows),

          // ANEXO 2: ÁRBOL DE PROBLEMAS
          new Paragraph({
            children: [new TextRun({ text: 'Anexo 2: Árbol de Problemas', font: FONT, size: SIZE, bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 240 },
            pageBreakBefore: true,
          }),
          body('Efectos:', true, AlignmentType.CENTER),
          ...(pt.effects || []).map((e) => body(`• ${e}`, false, AlignmentType.CENTER)),
          empty(),
          body('──────────────────────────────────────────────────', false, AlignmentType.CENTER),
          body(pt.centralProblem || '', true, AlignmentType.CENTER),
          body('──────────────────────────────────────────────────', false, AlignmentType.CENTER),
          empty(),
          body('Causas:', true, AlignmentType.CENTER),
          ...(pt.causes || []).map((c) => body(`• ${c}`, false, AlignmentType.CENTER)),

          // ANEXO 3: ÁRBOL DE OBJETIVOS
          new Paragraph({
            children: [new TextRun({ text: 'Anexo 3: Árbol de Objetivos', font: FONT, size: SIZE, bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 240 },
            pageBreakBefore: true,
          }),
          body('Fines:', true, AlignmentType.CENTER),
          ...(ot.ends || []).map((e) => body(`• ${e}`, false, AlignmentType.CENTER)),
          empty(),
          body('──────────────────────────────────────────────────', false, AlignmentType.CENTER),
          body(ot.mainObjective || '', true, AlignmentType.CENTER),
          body('──────────────────────────────────────────────────', false, AlignmentType.CENTER),
          empty(),
          body('Medios:', true, AlignmentType.CENTER),
          ...(ot.means || []).map((m) => body(`• ${m}`, false, AlignmentType.CENTER)),

          // ANEXO 4: MATRIZ DE OPERACIONALIZACIÓN
          new Paragraph({
            children: [new TextRun({ text: 'Anexo 4: Matriz de Operacionalización de Variables', font: FONT, size: SIZE, bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 240 },
            pageBreakBefore: true,
          }),
          ...tableOrFallback(['Variable', 'Dimensión', 'Indicadores', 'Instrumento'], opRows),

          // ANEXO 5: INSTRUMENTOS DE RECOLECCIÓN DE DATOS
          new Paragraph({
            children: [new TextRun({ text: 'Anexo 5: Instrumentos de Recolección de Datos', font: FONT, size: SIZE, bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 240 },
            pageBreakBefore: true,
          }),
          ...instrumentsBlocks,

          // ANEXO 6: CONSTANCIA DE APLICACIÓN DE INSTRUMENTOS
          new Paragraph({
            children: [new TextRun({ text: 'Anexo 6: Constancia de Aplicación de Instrumentos', font: FONT, size: SIZE, bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 240 },
            pageBreakBefore: true,
          }),
          body(constanciaText),
          empty(),
          body('Se expide la presente constancia para los fines que el(los) interesado(s) estime(n) conveniente.'),
          empty(),
          body(`${data.city}, ${data.year}`),
          empty(), empty(), empty(),
          coverCentered('_______________________________'),
          coverCentered('Firma y sello del representante de la institución'),

          // DECLARACIÓN JURADA
          heading('Declaración Jurada de Autoría'),
          body(
            `Yo/Nosotros, ${authors.join(' y ')}, identificado(s) con DNI (completar), egresado(s) del Programa de Estudios de Ingeniería de Sistemas de la Universidad Nacional de Trujillo, declaro/declaramos bajo juramento que:`,
          ),
          empty(),
          body('1. ' + docNounCap + ' titulado "' + data.title + '" es de mi/nuestra autoría y no ha sido presentado con anterioridad para la obtención de título o grado profesional alguno.'),
          empty(),
          body('2. La información y los datos presentados son verídicos y auténticos, y no han sido manipulados, falsificados ni copiados de otras investigaciones.'),
          empty(),
          body('3. Las citas y referencias utilizadas han sido debidamente identificadas de acuerdo con las normas internacionales de referencia bibliográfica APA V7.'),
          empty(),
          body('4. En caso de detectarse alguna falta a la ética académica, al honor o al plagio, asumo/asumimos las consecuencias y sanciones legales a que hubiere lugar, conforme a la normativa vigente.'),
          empty(),
          body(`${data.city}, ${data.year}`),
          empty(), empty(), empty(),
          ...authors.flatMap((a) => [
            coverCentered('_______________________________'),
            coverCentered(`Bach. ${a}`),
            coverCentered('DNI: ________________________'),
            empty(),
          ]),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

// ─── ARTÍCULO CIENTÍFICO (plantilla RCSI) ─────────────────────────────────────
const ART_FONT = 'Times New Roman';
const ART_TITLE_FONT = 'Book Antiqua';
// Tamaño Carta: 12240 x 15840 twips
const LETTER_PAGE = { width: 12240, height: 15840 };

function slugEmail(name: string): string {
  return (
    (name || 'autor')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 30) || 'autor'
  );
}

function artBody(text: string, opts: { bold?: boolean; align?: any; font?: string; size?: number; italic?: boolean } = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: opts.font || ART_FONT, size: opts.size || 24, bold: opts.bold, italics: opts.italic })],
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { line: 360, before: 0, after: 160 },
  });
}

function artProse(text?: string): Paragraph[] {
  const t = (text || '').trim();
  if (!t) return [artBody('(Pendiente de completar)')];
  return t.split(/\n+/).filter((p) => p.trim().length > 0).map((p) => artBody(p.trim()));
}

function artSection(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: ART_FONT, size: 24, bold: true })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 240, after: 100 },
  });
}

function artLabeled(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, font: ART_FONT, size: 24, bold: true }),
      new TextRun({ text: value, font: ART_FONT, size: 24 }),
    ],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 360, before: 0, after: 160 },
  });
}

export async function generateArticleDocxBlob(data: ThesisData, content: ThesisContent): Promise<Blob> {
  const authors = Array.isArray(data.authors) ? data.authors : [data.authors];
  const art = content.article || {};
  const refs = content.references || [];

  const creditRoles = [
    'Conceptualización',
    'Curación de datos',
    'Análisis formal',
    'Investigación',
    'Metodología',
    'Redacción - borrador original',
    'Redacción - revisión y edición',
  ];

  const children: Paragraph[] = [
    // Títulos
    new Paragraph({
      children: [new TextRun({ text: art.titleEn || data.title, font: ART_TITLE_FONT, size: 28, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.title, font: ART_TITLE_FONT, size: 26, bold: true, italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    // Autores
    ...authors.map(
      (a, i) =>
        new Paragraph({
          children: [new TextRun({ text: `${a}${i + 1} , ORCID iD: 0000-0000-0000-0000, ${slugEmail(a)}@unitru.edu.pe`, font: ART_FONT, size: 22 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 20 },
        }),
    ),
    // Afiliaciones
    ...authors.map(
      (_, i) =>
        new Paragraph({
          children: [new TextRun({ text: `${i + 1} Universidad Nacional de Trujillo, ${data.city}, Perú`, font: ART_FONT, size: 20, italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 20 },
        }),
    ),
    new Paragraph({
      children: [new TextRun({ text: `Autor de correspondencia: ${slugEmail(authors[0] || 'autor')}@unitru.edu.pe`, font: ART_FONT, size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    // Abstract / Resumen
    artLabeled('Abstract', art.abstract || '(Pendiente de completar)'),
    artLabeled('Keywords', art.keywords || ''),
    artLabeled('Resumen', art.resumen || '(Pendiente de completar)'),
    artLabeled('Palabras clave', art.palabrasClave || ''),
    // Cuerpo
    artSection('1. Introducción'),
    ...artProse(art.introduction),
    artSection('2. Materiales y métodos'),
    ...artProse(art.materialsAndMethods),
    artSection('3. Resultados y discusión'),
    ...artProse(art.resultsAndDiscussion),
    artSection('4. Conclusiones'),
    ...artProse(art.conclusions),
    artSection('Agradecimientos'),
    artBody('Los autores agradecen a la Universidad Nacional de Trujillo y a las personas e instituciones que asesoraron la presente investigación.'),
    artSection('Conflicto de intereses'),
    artBody('Los autores declaran no tener ningún conflicto de interés en relación con el presente trabajo.'),
    artSection('Fuente de financiamiento'),
    artBody('Los autores declaran que la investigación fue autofinanciada.'),
    artSection('Contribución de autoría'),
    ...creditRoles.map((r) => artLabeled(r, authors.join(', '))),
    artSection('Referencias bibliográficas'),
    ...(refs.length
      ? refs.map(
          (r) =>
            new Paragraph({
              children: [new TextRun({ text: r, font: ART_FONT, size: 24 })],
              alignment: AlignmentType.JUSTIFIED,
              spacing: { line: 360, after: 160 },
              indent: { left: 720, hanging: 720 },
            }),
        )
      : [artBody('(Pendiente de completar)')]),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: MARGINS, size: { width: LETTER_PAGE.width, height: LETTER_PAGE.height } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ children: [PageNumber.CURRENT], font: ART_FONT, size: 20 })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}
