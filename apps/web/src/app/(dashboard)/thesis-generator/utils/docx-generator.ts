import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  PageNumber, Footer, Header, SectionType,
} from 'docx';

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
}

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

// 2.5cm = ~1418 twips, 3cm = ~1701 twips
const MARGINS = { top: 1418, right: 1418, bottom: 1418, left: 1701 };

export async function generateDocxBlob(data: ThesisData, content: ThesisContent): Promise<Blob> {
  const authors = Array.isArray(data.authors) ? data.authors : [data.authors];
  const introParagraphs = (content.introduction || '')
    .split(/\n+/)
    .filter((p) => p.trim().length > 0)
    .map((p) => body(p.trim()));

  const refParagraphs = (content.references || []).map((r) => refItem(r));

  const pt = content.problemTree || { centralProblem: '', causes: [], effects: [] };
  const ot = content.objectiveTree || { mainObjective: '', means: [], ends: [] };

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
          coverCentered('[ LOGOTIPO INSTITUCIONAL ]', false, 20),
          empty(),
          empty(),
          new Paragraph({
            children: [new TextRun({ text: 'INFORME DE PROYECTO DE TESIS', font: FONT, size: 28, bold: true })],
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
          body('Referencias Bibliográficas .............................................. —'),
          body('Anexos .................................................................. —'),
          body('    Anexo 1: Árbol de Problemas .......................................... —'),
          body('    Anexo 2: Árbol de Objetivos ........................................... —'),
          body('Declaración Jurada ...................................................... —'),

          // CAPÍTULO I
          heading('Capítulo I: Introducción'),
          ...introParagraphs,

          // REFERENCIAS
          heading('Referencias Bibliográficas'),
          ...refParagraphs,

          // ANEXO 1
          heading('Anexos'),
          new Paragraph({
            children: [new TextRun({ text: 'Anexo 1: Árbol de Problemas', font: FONT, size: SIZE, bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 240 },
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

          // ANEXO 2
          new Paragraph({
            children: [new TextRun({ text: 'Anexo 2: Árbol de Objetivos', font: FONT, size: SIZE, bold: true })],
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

          // DECLARACIÓN JURADA
          heading('Declaración Jurada de Autoría'),
          body(
            `Yo/Nosotros, ${authors.join(' y ')}, identificado(s) con DNI (completar), egresado(s) del Programa de Estudios de Ingeniería de Sistemas de la Universidad Nacional de Trujillo, declaro/declaramos bajo juramento que:`,
          ),
          empty(),
          body('1. El Informe de Proyecto de Tesis titulado "' + data.title + '" es de mi/nuestra autoría y no ha sido presentado con anterioridad para la obtención de título o grado profesional alguno.'),
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
