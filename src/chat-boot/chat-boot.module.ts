import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatBootController } from './chat-boot.controller';
import { ChatBootService } from './chat-boot.service';
import { KnowledgeGraphService } from './infrastructure/services/knowledge-graph.service';
import { Neo4jGraphService } from './infrastructure/services/neo4j-graph.service';
import { DocumentPersistenceModule } from './infrastructure/persistence/document/document-persistence.module';
import { ChatRepository } from './infrastructure/persistence/chat.repository';

@Module({
  imports: [ConfigModule, DocumentPersistenceModule],
  controllers: [ChatBootController],
  providers: [ChatBootService, KnowledgeGraphService, Neo4jGraphService],
  exports: [
    ChatBootService,
    KnowledgeGraphService,
    Neo4jGraphService,
    ChatRepository,
  ],
})
export class ChatBootModule {}
