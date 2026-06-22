import { IsString, IsArray, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateThesisDto {
  @IsString()
  title: string;

  @IsArray()
  @IsString({ each: true })
  authors: string[];

  @IsString()
  advisor: string;

  @IsOptional()
  @IsString()
  advisorDegree?: string;

  @IsString()
  researchLine: string;

  @IsString()
  city: string;

  @IsNumber()
  @Min(2020)
  @Max(2035)
  @Type(() => Number)
  year: number;

  @IsString()
  juryPresident: string;

  @IsOptional()
  @IsString()
  juryPresidentDegree?: string;

  @IsString()
  jurySecretary: string;

  @IsOptional()
  @IsString()
  jurySecretaryDegree?: string;

  @IsString()
  juryVocal: string;

  @IsOptional()
  @IsString()
  juryVocalDegree?: string;
}

export interface ThesisVariable {
  name: string;
  type: string;
  definition: string;
}

export interface OperationalizationRow {
  variable: string;
  dimension: string;
  indicators: string;
  instrument: string;
}

export interface BudgetRow {
  item: string;
  quantity: string;
  unitCost: string;
  total: string;
}

export interface BudgetSummaryRow {
  concept: string;
  amount: string;
}

export interface ScheduleRow {
  activity: string;
  months: boolean[];
}

export interface ThesisMethod {
  researchTypeOrientation?: string;
  researchTypeContrast?: string;
  researchLevel?: string;
  researchDesign?: string;
  population?: string;
  sample?: string;
  sampling?: string;
  variables?: ThesisVariable[];
  operationalization?: OperationalizationRow[];
  techniques?: string;
  validation?: string;
  dataAnalysis?: string;
  procedure?: string;
  ethics?: string;
}

export interface ThesisAdministrative {
  personnel?: BudgetRow[];
  goods?: BudgetRow[];
  travel?: BudgetRow[];
  services?: BudgetRow[];
  technological?: BudgetRow[];
  budgetSummary?: BudgetSummaryRow[];
  budgetTotal?: string;
  financingExternal?: string;
  financingSelf?: string;
  period?: string;
  schedule?: ScheduleRow[];
}

export interface ThesisConsistencyMatrix {
  problem?: string;
  objective?: string;
  hypothesis?: string;
  variables?: string;
  methodology?: string;
}

export interface ThesisInstrument {
  name?: string;
  description?: string;
  items?: string[];
}

export interface ThesisResultBlock {
  title?: string;
  content?: string;
}

// Capítulos finales exclusivos del Informe Final de Tesis (Resultados, Discusión, etc.)
export interface ThesisFinal {
  results?: ThesisResultBlock[];
  discussion?: string;
  conclusions?: string[];
  recommendations?: string[];
}

// Artículo científico con la plantilla RCSI (Submission Template)
export interface ThesisArticle {
  titleEn?: string;
  abstract?: string; // en inglés (150-200 palabras)
  keywords?: string; // en inglés, separadas por coma
  resumen?: string; // español
  palabrasClave?: string; // español
  introduction?: string;
  materialsAndMethods?: string;
  resultsAndDiscussion?: string;
  conclusions?: string;
}

export type ThesisDocumentType = 'proyecto' | 'tesis' | 'articulo';

export class ExportThesisPdfDto {
  formData: GenerateThesisDto;
  // 'proyecto' (Informe de Proyecto de Tesis) o 'tesis' (Informe Final de Tesis)
  documentType?: ThesisDocumentType;
  content: {
    introduction: string;
    references: string[];
    problemTree: {
      centralProblem: string;
      causes: string[];
      effects: string[];
    };
    objectiveTree: {
      mainObjective: string;
      means: string[];
      ends: string[];
    };
    method?: ThesisMethod;
    administrative?: ThesisAdministrative;
    consistencyMatrix?: ThesisConsistencyMatrix;
    instruments?: ThesisInstrument[];
    // Sólo se usan cuando documentType === 'tesis'
    results?: ThesisResultBlock[];
    discussion?: string;
    conclusions?: string[];
    recommendations?: string[];
    // Sólo se usa cuando documentType === 'articulo'
    article?: ThesisArticle;
  };
}
