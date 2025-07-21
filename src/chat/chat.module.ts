import { Module } from '@nestjs/common';

import { DocumentChatPersistenceModule } from './infrastructure/persistence/document/document-persistence.module';

import { AIModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';

import { ChatRepository } from './infrastructure/persistence/chat.repository';
import { MessageRepository } from './infrastructure/persistence/message.repository';
import { KnowledgeRepository } from './infrastructure/persistence/knowledge.repository';
import { RagService } from './services/rag.service';

@Module({
  imports: [DocumentChatPersistenceModule, AIModule, UsersModule],
  controllers: [
    // ChatController
  ],
  providers: [
    {
      provide: ChatRepository,
      useExisting: 'DocumentChatRepository',
    },
    {
      provide: MessageRepository,
      useExisting: 'DocumentMessageRepository',
    },
    {
      provide: KnowledgeRepository,
      useExisting: 'DocumentKnowledgeRepository',
    },
    {
      provide: 'RagService',
      useClass: RagService,
    },
  ],
  exports: [],
})
export class ChatModule {}
