import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiRepository } from '../ai.repository';
import { AiDocumentRepository } from './repositories/ai-document.repository';
import {
  AiSessionSchema,
  AiSessionSchemaFactory,
} from './entities/ai-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AiSessionSchema.name,
        schema: AiSessionSchemaFactory,
      },
    ]),
  ],
  providers: [
    {
      provide: AiRepository,
      useClass: AiDocumentRepository,
    },
  ],
  exports: [AiRepository],
})
export class DocumentPersistenceModule {}
