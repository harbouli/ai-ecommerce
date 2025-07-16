import { Module } from '@nestjs/common';
import { Neo4jModule } from '../../../../database/neo4j/neo4j.module';
import { ChatGraphRepository } from './repositories/chat-graph.repository';
import { KnowledgeGraphRepository } from './repositories/knowledge-graph.repository';

@Module({
  imports: [Neo4jModule],
  providers: [
    ChatGraphRepository,
    KnowledgeGraphRepository,
    {
      provide: 'GraphChatRepository',
      useClass: ChatGraphRepository,
    },
  ],
  exports: [
    ChatGraphRepository,
    KnowledgeGraphRepository,
    'GraphChatRepository',
  ],
})
export class GraphChatPersistenceModule {}
