import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TemplatesService, TEMPLATE_QUEUE } from './templates.service';

@Processor(TEMPLATE_QUEUE)
export class TemplatesProcessor {
  private readonly logger = new Logger(TemplatesProcessor.name);

  constructor(private service: TemplatesService) {}

  @Process('process')
  async handleProcess(job: Job<{ templateId: string; filePath: string; mimeType: string; fileName: string }>) {
    const { templateId, filePath, mimeType, fileName } = job.data;
    this.logger.log(`Procesando template job: ${templateId}`);
    return this.service.processTemplate(templateId, filePath, mimeType, fileName);
  }
}
