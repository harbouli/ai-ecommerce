import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatBootController } from './chat-boot.controller';
import { ChatBootService } from './chat-boot.service';
import { KnowledgeGraphService } from './infrastructure/services/knowledge-graph.service';
import { Neo4jGraphService } from './infrastructure/services/neo4j-graph.service';
import { ChatPersistenceModule } from './infrastructure/persistence/chat-persistence.module';

@Module({
  imports: [ConfigModule, ChatPersistenceModule],
  controllers: [ChatBootController],
  providers: [ChatBootService, KnowledgeGraphService, Neo4jGraphService],
  exports: [ChatBootService, KnowledgeGraphService, Neo4jGraphService],
})
export class ChatBootModule {}
