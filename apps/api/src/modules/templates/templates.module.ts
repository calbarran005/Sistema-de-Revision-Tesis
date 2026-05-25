import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TemplatesController } from './templates.controller';
import { TemplatesService, TEMPLATE_QUEUE } from './templates.service';
import { TemplatesProcessor } from './templates.processor';
import { AiAnalysisModule } from '../ai-analysis/ai-analysis.module';

@Module({
  imports: [BullModule.registerQueue({ name: TEMPLATE_QUEUE }), AiAnalysisModule],
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplatesProcessor],
  exports: [TemplatesService],
})
export class TemplatesModule {}
