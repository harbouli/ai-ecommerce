/* eslint-disable @typescript-eslint/no-unused-vars */
// src/chat/infrastructure/persistence/weaviate/repositories/chat-vector.repository.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WeaviateService } from '../../../../../database/weaviate/weaviate.service';
import { WeaviateClient } from 'weaviate-ts-client';
import {
  Message,
  MessageContext,
  ExtractedEntity,
} from '../../../../domain/message';
import { ConversationContext } from '../../../../domain/conversation';
import { ChatMessageWeaviateMapper } from '../mappers/chat-message.mapper';
import { ConversationContextWeaviateMapper } from '../mappers/conversation-context.mapper';

@Injectable()
export class ChatVectorRepository implements OnModuleInit {
  private readonly logger = new Logger(ChatVectorRepository.name);
  private readonly messageClassName = 'ChatMessage';
  private readonly contextClassName = 'ConversationContext';
  private client: WeaviateClient;

  constructor(private readonly weaviateService: WeaviateService) {}

  async onModuleInit() {
    this.client = await this.weaviateService.getClient();
    await this.initializeSchemas();
  }

  private async initializeSchemas(): Promise<void> {
    try {
      const schema = await this.client.schema.getter().do();
      const existingClasses = schema.classes?.map((cls) => cls.class) || [];

      if (!existingClasses.includes(this.messageClassName)) {
        await this.createChatMessageSchema();
        this.logger.log(`${this.messageClassName} schema created in Weaviate`);
      }

      if (!existingClasses.includes(this.contextClassName)) {
        await this.createConversationContextSchema();
        this.logger.log(`${this.contextClassName} schema created in Weaviate`);
      }
    } catch (error) {
      this.logger.error('Error initializing Weaviate schemas:', error);
    }
  }

  private async createChatMessageSchema(): Promise<void> {
    const classDefinition = {
      class: this.messageClassName,
      description: 'Chat messages for semantic search and context retrieval',
      vectorizer: 'text2vec-transformers',
      properties: [
        {
          name: 'chatId',
          dataType: ['string'],
          description: 'Chat ID reference',
          tokenization: 'keyword',
        },
        {
          name: 'sessionId',
          dataType: ['string'],
          description: 'Session ID reference',
          tokenization: 'keyword',
        },
        {
          name: 'type',
          dataType: ['string'],
          description: 'Message type: USER, ASSISTANT, or SYSTEM',
          tokenization: 'keyword',
        },
        {
          name: 'content',
          dataType: ['text'],
          description: 'Message content',
          tokenization: 'word',
        },
        {
          name: 'intent',
          dataType: ['string'],
          description: 'Classified intent',
          tokenization: 'keyword',
        },
        {
          name: 'confidence',
          dataType: ['number'],
          description: 'Intent confidence score',
        },
        {
          name: 'timestamp',
          dataType: ['date'],
          description: 'Message timestamp',
        },
        {
          name: 'userId',
          dataType: ['string'],
          description: 'User ID',
          tokenization: 'keyword',
        },
        {
          name: 'tokensUsed',
          dataType: ['int'],
          description: 'Tokens used for AI processing',
        },
        {
          name: 'processingTime',
          dataType: ['number'],
          description: 'Processing time in milliseconds',
        },
        {
          name: 'model',
          dataType: ['string'],
          description: 'AI model used',
          tokenization: 'keyword',
        },
        {
          name: 'entityTexts',
          dataType: ['string[]'],
          description: 'Extracted entity texts',
          tokenization: 'word',
        },
        {
          name: 'entityTypes',
          dataType: ['string[]'],
          description: 'Extracted entity types',
          tokenization: 'keyword',
        },
        {
          name: 'entityConfidences',
          dataType: ['number[]'],
          description: 'Entity confidence scores',
        },
        {
          name: 'contextSources',
          dataType: ['string[]'],
          description: 'Context sources',
          tokenization: 'keyword',
        },
        {
          name: 'contextContents',
          dataType: ['text[]'],
          description: 'Context contents',
          tokenization: 'word',
        },
        {
          name: 'contextScores',
          dataType: ['number[]'],
          description: 'Context relevance scores',
        },
      ],
    };

    await this.client.schema.classCreator().withClass(classDefinition).do();
  }

  private async createConversationContextSchema(): Promise<void> {
    const classDefinition = {
      class: this.contextClassName,
      description: 'Conversation context for semantic search',
      vectorizer: 'text2vec-transformers',
      properties: [
        {
          name: 'sessionId',
          dataType: ['string'],
          description: 'Session ID reference',
          tokenization: 'keyword',
        },
        {
          name: 'userId',
          dataType: ['string'],
          description: 'User ID',
          tokenization: 'keyword',
        },
        {
          name: 'contextType',
          dataType: ['string'],
          description: 'Type of context: SUMMARY, INTENT_HISTORY, etc.',
          tokenization: 'keyword',
        },
        {
          name: 'content',
          dataType: ['text'],
          description: 'Context content',
          tokenization: 'word',
        },
        {
          name: 'timestamp',
          dataType: ['date'],
          description: 'Context timestamp',
        },
        {
          name: 'relevanceScore',
          dataType: ['number'],
          description: 'Context relevance score',
        },
      ],
    };

    await this.client.schema.classCreator().withClass(classDefinition).do();
  }

  private async ensureClientReady(): Promise<void> {
    if (!this.client) {
      this.client = await this.weaviateService.getClient();
    }
  }

  async storeMessageVector(message: Message): Promise<void> {
    await this.ensureClientReady();

    try {
      const persistenceModel = ChatMessageWeaviateMapper.toPersistence(message);
      const { vector, vectorizedText, id, ...weaviateProperties } =
        persistenceModel;

      const result = await this.client.data
        .creator()
        .withClassName(this.messageClassName)
        .withId(message.id)
        .withProperties(weaviateProperties)
        .do();

      this.logger.log(
        `Message vector stored in Weaviate with ID: ${result.id}`,
      );
    } catch (error) {
      this.logger.error('Error storing message vector:', error);
      throw error;
    }
  }

  async storeConversationContext(context: ConversationContext): Promise<void> {
    await this.ensureClientReady();

    try {
      const persistenceModel =
        ConversationContextWeaviateMapper.toPersistence(context);
      const { vector, vectorizedText, id, ...weaviateProperties } =
        persistenceModel;

      const result = await this.client.data
        .creator()
        .withClassName(this.contextClassName)
        .withProperties(weaviateProperties)
        .do();

      this.logger.log(
        `Conversation context stored in Weaviate with ID: ${result.id}`,
      );
    } catch (error) {
      this.logger.error('Error storing conversation context:', error);
      throw error;
    }
  }

  async semanticSearch(
    query: string,
    limit: number = 10,
    threshold: number = 0.7,
  ): Promise<MessageContext[]> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.messageClassName)
        .withFields(
          '_additional { id certainty } content type intent contextContents contextScores contextSources',
        )
        .withNearText({
          concepts: [query],
          certainty: threshold,
        })
        .withLimit(limit)
        .do();

      const messages = result.data?.Get?.[this.messageClassName] || [];

      return messages.map((msg: any) => ({
        source: 'VECTOR' as const,
        content: msg.content,
        score: msg._additional.certainty,
        metadata: {
          id: msg._additional.id,
          type: msg.type,
          intent: msg.intent,
          contextSources: msg.contextSources,
          contextContents: msg.contextContents,
          contextScores: msg.contextScores,
        },
      }));
    } catch (error) {
      this.logger.error('Error in semantic search:', error);
      return [];
    }
  }

  async findSimilarMessages(
    messageId: string,
    limit: number = 5,
  ): Promise<Message[]> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.messageClassName)
        .withFields(
          '_additional { id certainty } chatId sessionId type content intent confidence timestamp userId tokensUsed processingTime model entityTexts entityTypes entityConfidences contextSources contextContents contextScores',
        )
        .withNearObject({
          id: messageId,
        })
        .withLimit(limit + 1) // +1 to exclude the original message
        .do();

      const messages = result.data?.Get?.[this.messageClassName] || [];

      return messages
        .filter((msg: any) => msg._additional.id !== messageId)
        .slice(0, limit)
        .map((msg: any) =>
          ChatMessageWeaviateMapper.toDomain({
            ...msg,
            id: msg._additional.id,
          }),
        );
    } catch (error) {
      this.logger.error('Error finding similar messages:', error);
      return [];
    }
  }

  async findRelevantContext(
    entities: ExtractedEntity[],
    limit: number = 10,
  ): Promise<MessageContext[]> {
    await this.ensureClientReady();

    if (!entities || entities.length === 0) {
      return [];
    }

    try {
      const entityTexts = entities.map((e) => e.text);
      const searchQuery = entityTexts.join(' ');

      const result = await this.client.graphql
        .get()
        .withClassName(this.messageClassName)
        .withFields(
          '_additional { id certainty } content type intent entityTexts entityTypes',
        )
        .withNearText({
          concepts: [searchQuery],
        })
        .withWhere({
          operator: 'Or',
          operands: entityTexts.map((text) => ({
            path: ['entityTexts'],
            operator: 'ContainsAny',
            valueTextArray: [text],
          })),
        })
        .withLimit(limit)
        .do();

      const messages = result.data?.Get?.[this.messageClassName] || [];

      return messages.map((msg: any) => ({
        source: 'VECTOR' as const,
        content: msg.content,
        score: msg._additional.certainty,
        metadata: {
          id: msg._additional.id,
          type: msg.type,
          intent: msg.intent,
          entityTexts: msg.entityTexts,
          entityTypes: msg.entityTypes,
        },
      }));
    } catch (error) {
      this.logger.error('Error finding relevant context:', error);
      return [];
    }
  }

  async updateMessageVector(messageId: string): Promise<void> {
    await this.ensureClientReady();

    try {
      // Weaviate doesn't support direct vector updates, so we need to delete and recreate
      // For now, we'll just log this operation
      this.logger.warn(
        `Vector update requested for message ${messageId} - not implemented`,
      );
    } catch (error) {
      this.logger.error('Error updating message vector:', error);
      throw error;
    }
  }

  async deleteMessageVector(messageId: string): Promise<void> {
    await this.ensureClientReady();

    try {
      await this.client.data
        .deleter()
        .withClassName(this.messageClassName)
        .withId(messageId)
        .do();

      this.logger.log(
        `Message vector deleted from Weaviate with ID: ${messageId}`,
      );
    } catch (error) {
      this.logger.error(`Error deleting message vector ${messageId}:`, error);
      throw error;
    }
  }

  async findContextByIntent(
    intent: string,
    limit: number = 10,
  ): Promise<MessageContext[]> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.messageClassName)
        .withFields(
          '_additional { id certainty } content type intent confidence timestamp',
        )
        .withWhere({
          path: ['intent'],
          operator: 'Equal',
          valueString: intent,
        })
        .withLimit(limit)
        .do();

      const messages = result.data?.Get?.[this.messageClassName] || [];

      return messages.map((msg: any) => ({
        source: 'VECTOR' as const,
        content: msg.content,
        score: msg.confidence || 0.8,
        metadata: {
          id: msg._additional.id,
          type: msg.type,
          intent: msg.intent,
          timestamp: msg.timestamp,
        },
      }));
    } catch (error) {
      this.logger.error('Error finding context by intent:', error);
      return [];
    }
  }

  async hybridSearch(
    query: string,
    filters: Record<string, any>,
    limit: number = 10,
  ): Promise<MessageContext[]> {
    await this.ensureClientReady();

    try {
      let queryBuilder = this.client.graphql
        .get()
        .withClassName(this.messageClassName)
        .withFields(
          '_additional { id certainty } content type intent confidence timestamp userId',
        )
        .withNearText({
          concepts: [query],
        })
        .withLimit(limit);

      // Apply filters
      const whereConditions: any[] = [];

      if (filters.userId) {
        whereConditions.push({
          path: ['userId'],
          operator: 'Equal',
          valueString: filters.userId,
        });
      }

      if (filters.type) {
        whereConditions.push({
          path: ['type'],
          operator: 'Equal',
          valueString: filters.type,
        });
      }

      if (filters.intent) {
        whereConditions.push({
          path: ['intent'],
          operator: 'Equal',
          valueString: filters.intent,
        });
      }

      if (filters.startDate || filters.endDate) {
        const dateCondition: any = {
          path: ['timestamp'],
          operator: 'GreaterThanEqual',
          valueDate: filters.startDate || new Date(0),
        };
        whereConditions.push(dateCondition);

        if (filters.endDate) {
          whereConditions.push({
            path: ['timestamp'],
            operator: 'LessThanEqual',
            valueDate: filters.endDate,
          });
        }
      }

      if (whereConditions.length > 0) {
        queryBuilder = queryBuilder.withWhere({
          operator: 'And',
          operands: whereConditions,
        });
      }

      const result = await queryBuilder.do();
      const messages = result.data?.Get?.[this.messageClassName] || [];

      return messages.map((msg: any) => ({
        source: 'VECTOR' as const,
        content: msg.content,
        score: msg._additional.certainty,
        metadata: {
          id: msg._additional.id,
          type: msg.type,
          intent: msg.intent,
          confidence: msg.confidence,
          timestamp: msg.timestamp,
          userId: msg.userId,
          matchedFilters: filters,
        },
      }));
    } catch (error) {
      this.logger.error('Error in hybrid search:', error);
      return [];
    }
  }

  // Additional utility methods
  async getMessageById(messageId: string): Promise<Message | null> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.messageClassName)
        .withFields(
          '_additional { id } chatId sessionId type content intent confidence timestamp userId tokensUsed processingTime model entityTexts entityTypes entityConfidences contextSources contextContents contextScores',
        )
        .withWhere({
          path: ['id'],
          operator: 'Equal',
          valueString: messageId,
        })
        .withLimit(1)
        .do();

      const messages = result.data?.Get?.[this.messageClassName] || [];

      if (messages.length === 0) {
        return null;
      }

      return ChatMessageWeaviateMapper.toDomain({
        ...messages[0],
        id: messages[0]._additional.id,
      });
    } catch (error) {
      this.logger.error('Error getting message by ID:', error);
      return null;
    }
  }

  async searchByEntityType(
    entityType: string,
    limit: number = 10,
  ): Promise<MessageContext[]> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.messageClassName)
        .withFields(
          '_additional { id certainty } content type intent entityTexts entityTypes',
        )
        .withWhere({
          path: ['entityTypes'],
          operator: 'ContainsAny',
          valueTextArray: [entityType],
        })
        .withLimit(limit)
        .do();

      const messages = result.data?.Get?.[this.messageClassName] || [];

      return messages.map((msg: any) => ({
        source: 'VECTOR' as const,
        content: msg.content,
        score: 0.8, // Default score for exact matches
        metadata: {
          id: msg._additional.id,
          type: msg.type,
          intent: msg.intent,
          entityTexts: msg.entityTexts,
          entityTypes: msg.entityTypes,
          searchedEntityType: entityType,
        },
      }));
    } catch (error) {
      this.logger.error('Error searching by entity type:', error);
      return [];
    }
  }
}
