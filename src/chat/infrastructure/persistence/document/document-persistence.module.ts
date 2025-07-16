import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatSchema, ChatSchemaClass } from './entities/chat.schema';
import { MessageSchema, MessageSchemaClass } from './entities/message.schema';
import {
  KnowledgeSchema,
  KnowledgeSchemaClass,
} from './entities/knowledge.schema';

import { ChatDocumentRepository } from './repositories/chat.repository';
import { MessageDocumentRepository } from './repositories/message.repository';
import { KnowledgeDocumentRepository } from './repositories/knowledge.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSchemaClass.name, schema: ChatSchema },
      { name: MessageSchemaClass.name, schema: MessageSchema },
      { name: KnowledgeSchemaClass.name, schema: KnowledgeSchema },
    ]),
  ],
  providers: [
    ChatDocumentRepository,
    MessageDocumentRepository,
    KnowledgeDocumentRepository,
    {
      provide: 'DocumentChatRepository',
      useClass: ChatDocumentRepository,
    },
    {
      provide: 'DocumentMessageRepository',
      useClass: MessageDocumentRepository,
    },
    {
      provide: 'DocumentKnowledgeRepository',
      useClass: KnowledgeDocumentRepository,
    },
  ],
  exports: [
    ChatDocumentRepository,
    MessageDocumentRepository,
    KnowledgeDocumentRepository,
    'DocumentChatRepository',
    'DocumentMessageRepository',
    'DocumentKnowledgeRepository',
  ],
})
export class DocumentChatPersistenceModule {}
