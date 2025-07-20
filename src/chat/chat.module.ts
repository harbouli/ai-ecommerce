import { Module } from '@nestjs/common';

import { ChatController } from './chat.controller';

import { DocumentChatPersistenceModule } from './infrastructure/persistence/document/document-persistence.module';

import { AIModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';

import { ChatRepository } from './infrastructure/persistence/chat.repository';
import { MessageRepository } from './infrastructure/persistence/message.repository';
import { KnowledgeRepository } from './infrastructure/persistence/knowledge.repository';

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
  ],
  exports: [],
})
export class ChatModule {}
