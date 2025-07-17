import { Injectable, Logger } from '@nestjs/common';
import { Message } from '../../../domain/message';
import { MessageRepository } from '../message.repository';
import { MessageDocumentRepository } from '../document/repositories/message.repository';
import { ChatVectorRepository } from '../weaviate/repositories/chat-vector.repository';
import { ChatGraphRepository } from '../graph/repositories/chat-graph.repository';
import { NullableType } from '../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../utils/types/pagination-options';

@Injectable()
export class HybridMessageRepository implements MessageRepository {
  private readonly logger = new Logger(HybridMessageRepository.name);

  constructor(
    private mongoRepository: MessageDocumentRepository,
    private vectorRepository: ChatVectorRepository,
    private graphRepository: ChatGraphRepository,
  ) {}

  async create(data: Omit<Message, 'id'>): Promise<Message> {
    try {
      // 1. Create in MongoDB first (primary storage)
      const createdMessage = await this.mongoRepository.create(data);
      this.logger.log(`Message created in MongoDB: ${createdMessage.id}`);

      // 2. Store message vector in Weaviate
      try {
        await this.vectorRepository.storeMessageVector(createdMessage);
        this.logger.log(
          `Message vector stored in Weaviate: ${createdMessage.id}`,
        );
      } catch (vectorError) {
        this.logger.error(
          `Failed to store message vector: ${createdMessage.id}`,
          vectorError,
        );
      }

      // 3. Add message to chat in Neo4j
      try {
        await this.graphRepository.addMessageToChat(
          createdMessage.chatId,
          createdMessage.id,
          createdMessage.type,
          createdMessage.content,
          createdMessage.intent,
          createdMessage.confidence,
        );

        // Create entity mention relationships if entities exist
        if (createdMessage.entities && createdMessage.entities.length > 0) {
          for (const entity of createdMessage.entities) {
            await this.graphRepository.createEntityMentionRelationship(
              createdMessage.id,
              entity.text, // Using entity text as ID for now
            );
          }
        }

        this.logger.log(`Message added to graph: ${createdMessage.id}`);
      } catch (graphError) {
        this.logger.error(
          `Failed to add message to graph: ${createdMessage.id}`,
          graphError,
        );
      }

      return createdMessage;
    } catch (error) {
      this.logger.error('Failed to create message:', error);
      throw error;
    }
  }

  async findById(id: Message['id']): Promise<NullableType<Message>> {
    return await this.mongoRepository.findById(id);
  }

  async findByChatId(chatId: string): Promise<Message[]> {
    return await this.mongoRepository.findByChatId(chatId);
  }

  async findBySessionId(sessionId: string): Promise<Message[]> {
    return await this.mongoRepository.findBySessionId(sessionId);
  }

  async update(
    id: Message['id'],
    payload: Partial<Message>,
  ): Promise<Message | null> {
    try {
      const updatedMessage = await this.mongoRepository.update(id, payload);

      if (updatedMessage) {
        // Update vector if content changed
        if (payload.content) {
          try {
            await this.vectorRepository.storeMessageVector(updatedMessage);
          } catch (vectorError) {
            this.logger.error(
              `Failed to update message vector: ${id}`,
              vectorError,
            );
          }
        }
      }

      return updatedMessage;
    } catch (error) {
      this.logger.error(`Failed to update message: ${id}`, error);
      throw error;
    }
  }

  async remove(id: Message['id']): Promise<void> {
    try {
      await this.mongoRepository.remove(id);

      // Clean up vector
      try {
        await this.vectorRepository.deleteMessageVector(id);
      } catch (vectorError) {
        this.logger.error(
          `Failed to remove message vector: ${id}`,
          vectorError,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to remove message: ${id}`, error);
      throw error;
    }
  }

  async findRecentByUserId(userId: string, limit: number): Promise<Message[]> {
    return await this.mongoRepository.findRecentByUserId(userId, limit);
  }

  async findByEntityType(entityType: string): Promise<Message[]> {
    return await this.mongoRepository.findByEntityType(entityType);
  }

  async findByIntent(intent: string): Promise<Message[]> {
    return await this.mongoRepository.findByIntent(intent);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Message[]> {
    return await this.mongoRepository.findByDateRange(startDate, endDate);
  }

  async aggregateByIntent(): Promise<any[]> {
    return await this.mongoRepository.aggregateByIntent();
  }

  async findConversationHistory(
    sessionId: string,
    limit: number,
  ): Promise<Message[]> {
    return await this.mongoRepository.findConversationHistory(sessionId, limit);
  }

  async findByType(type: 'USER' | 'ASSISTANT' | 'SYSTEM'): Promise<Message[]> {
    return await this.mongoRepository.findByType(type);
  }

  async findWithPagination(options: IPaginationOptions): Promise<Message[]> {
    return await this.mongoRepository.findWithPagination(options);
  }

  async searchByContent(searchTerm: string): Promise<Message[]> {
    return await this.mongoRepository.searchByContent(searchTerm);
  }

  async findByContextSource(source: string): Promise<Message[]> {
    return await this.mongoRepository.findByContextSource(source);
  }

  async countByChatId(chatId: string): Promise<number> {
    return await this.mongoRepository.countByChatId(chatId);
  }

  // Hybrid-specific methods
  async semanticMessageSearch(
    query: string,
    limit: number = 10,
  ): Promise<Message[]> {
    try {
      const contextResults = await this.vectorRepository.semanticSearch(
        query,
        limit,
        0.7,
      );
      const messageIds = contextResults
        .map((ctx) => ctx.metadata.id)
        .filter(Boolean);

      const messages: Message[] = [];
      for (const messageId of messageIds) {
        const message = await this.mongoRepository.findById(messageId);
        if (message) {
          messages.push(message);
        }
      }

      return messages;
    } catch (error) {
      this.logger.error('Failed to perform semantic message search:', error);
      return [];
    }
  }

  async findContextualMessages(
    sessionId: string,
    query: string,
  ): Promise<Message[]> {
    try {
      // Get session messages first
      const sessionMessages =
        await this.mongoRepository.findBySessionId(sessionId);

      // Then get similar messages from other sessions
      const similarMessages = await this.semanticMessageSearch(query, 5);

      // Combine and deduplicate
      const allMessages = [...sessionMessages, ...similarMessages];
      const uniqueMessages = allMessages.filter(
        (message, index, self) =>
          index === self.findIndex((m) => m.id === message.id),
      );

      return uniqueMessages;
    } catch (error) {
      this.logger.error('Failed to find contextual messages:', error);
      return [];
    }
  }

  async getMessageWithContext(messageId: string): Promise<any> {
    try {
      const message = await this.mongoRepository.findById(messageId);
      if (!message) {
        return null;
      }

      // Get similar messages
      const similarMessages = await this.vectorRepository.findSimilarMessages(
        messageId,
        3,
      );

      return {
        ...message,
        context: message.context || [],
        similarMessages,
      };
    } catch (error) {
      this.logger.error('Failed to get message with context:', error);
      return null;
    }
  }

  async getConversationFlow(sessionId: string): Promise<any[]> {
    try {
      return await this.graphRepository.findConversationPath(sessionId);
    } catch (error) {
      this.logger.error('Failed to get conversation flow:', error);
      return [];
    }
  }
}
