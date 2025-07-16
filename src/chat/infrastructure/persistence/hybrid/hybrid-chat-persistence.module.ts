import { Module } from '@nestjs/common';
import { DocumentChatPersistenceModule } from '../document/document-persistence.module';
import { WeaviateChatPersistenceModule } from '../weaviate/weaviate-persistence.module';
import { GraphChatPersistenceModule } from '../graph/graph-persistence.module';
import { UsersModule } from '../../../../users/users.module';
import { ChatRepository } from '../chat.repository';
import { MessageRepository } from '../message.repository';
import { KnowledgeRepository } from '../knowledge.repository';
import { HybridChatRepository } from './hybrid-chat.repository';
import { HybridMessageRepository } from './hybrid-message.repository';
import { HybridKnowledgeRepository } from './hybrid-knowledge.repository';

@Module({
  imports: [
    DocumentChatPersistenceModule,
    WeaviateChatPersistenceModule,
    GraphChatPersistenceModule,
    UsersModule,
  ],
  providers: [
    HybridChatRepository,
    HybridMessageRepository,
    HybridKnowledgeRepository,
    {
      provide: ChatRepository,
      useClass: HybridChatRepository,
    },
    {
      provide: MessageRepository,
      useClass: HybridMessageRepository,
    },
    {
      provide: KnowledgeRepository,
      useClass: HybridKnowledgeRepository,
    },
  ],
  exports: [
    ChatRepository,
    MessageRepository,
    KnowledgeRepository,
    HybridChatRepository,
    HybridMessageRepository,
    HybridKnowledgeRepository,
  ],
})
export class HybridChatPersistenceModule {}
