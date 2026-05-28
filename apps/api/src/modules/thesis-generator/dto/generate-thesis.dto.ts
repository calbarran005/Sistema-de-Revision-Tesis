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

export class ExportThesisPdfDto {
  formData: GenerateThesisDto;
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
  };
}
