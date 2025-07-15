import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ChatSessionSchema,
  ChatSessionSchemaFactory,
} from './entities/chat-session.schema';
import { ChatRepository } from '../chat.repository';
import { ChatDocumentRepository } from './repositories/chat-document.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: ChatSessionSchema.name,
        schema: ChatSessionSchemaFactory,
      },
    ]),
  ],
  providers: [
    {
      provide: ChatRepository,
      useClass: ChatDocumentRepository,
    },
  ],
  exports: [ChatRepository],
})
export class DocumentPersistenceModule {}
