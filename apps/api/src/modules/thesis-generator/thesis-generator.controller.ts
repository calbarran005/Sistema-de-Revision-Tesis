import { Controller, Post, Body, Res, HttpCode, HttpStatus, UsePipes, ValidationPipe } from '@nestjs/common';
import { Response } from 'express';
import { ThesisGeneratorService } from './thesis-generator.service';
import { GenerateThesisDto } from './dto/generate-thesis.dto';

@Controller('thesis-generator')
export class ThesisGeneratorController {
  constructor(private readonly service: ThesisGeneratorService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateContent(@Body() dto: GenerateThesisDto) {
    return this.service.generateContent(dto);
  }

  // Usa ValidationPipe permisivo porque el body contiene objetos anidados complejos
  // que no necesitan validación estricta (ya vienen del mismo sistema)
  @Post('export/pdf')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: true }))
  async exportPdf(@Body() body: any, @Res() res: Response) {
    const { formData, content } = body;
    const pdfBuffer = await this.service.generatePdf({ formData, content });
    const safeTitle = (formData?.title || 'proyecto-de-tesis')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 50);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
