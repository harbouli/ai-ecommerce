import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { TextGenerationService } from './infrastructure/services/text-generation.service';
import { ImageAnalysisService } from './infrastructure/services/image-analysis.service';
import { EmbeddingService } from './infrastructure/services/embedding.service';
import { DocumentPersistenceModule } from './infrastructure/persistence/document/document-persistence.module';

@Module({
  imports: [ConfigModule, DocumentPersistenceModule],
  controllers: [AiController],
  providers: [
    AiService,
    TextGenerationService,
    ImageAnalysisService,
    EmbeddingService,
  ],
  exports: [
    AiService,
    TextGenerationService,
    ImageAnalysisService,
    EmbeddingService,
  ],
})
export class AiModule {}
