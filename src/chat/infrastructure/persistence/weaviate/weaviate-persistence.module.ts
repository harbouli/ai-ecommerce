import { Module } from '@nestjs/common';
import { WeaviateModule } from '../../../../database/weaviate/weaviate.module';
import { ChatVectorRepository } from './repositories/chat-vector.repository';
import { KnowledgeVectorRepository } from './repositories/knowledge-vector.repository';

@Module({
  imports: [WeaviateModule],
  providers: [
    ChatVectorRepository,
    KnowledgeVectorRepository,
    {
      provide: 'VectorChatRepository',
      useClass: ChatVectorRepository,
    },
  ],
  exports: [
    ChatVectorRepository,
    KnowledgeVectorRepository,
    'VectorChatRepository',
  ],
})
export class WeaviateChatPersistenceModule {}
