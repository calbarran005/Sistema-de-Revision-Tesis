import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AiAnalysisController } from './ai-analysis.controller';
import { AiAnalysisService } from './ai-analysis.service';
import { AiAnalysisProcessor, AI_ANALYSIS_QUEUE } from './processors/ai-analysis.processor';
import { DocumentExtractorService } from './services/document-extractor.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: AI_ANALYSIS_QUEUE }),
    NotificationsModule,
    StorageModule,
  ],
  controllers: [AiAnalysisController],
  providers: [AiAnalysisService, AiAnalysisProcessor, DocumentExtractorService],
  exports: [AiAnalysisService, DocumentExtractorService],
})
export class AiAnalysisModule {}
