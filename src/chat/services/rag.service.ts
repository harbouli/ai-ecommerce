import { Injectable, Logger } from '@nestjs/common';
import { MessageRepository } from '../infrastructure/persistence/message.repository';
import { MessageContext } from '../domain/message';
import { Message } from '../domain/message';
import { AIService } from '../../ai/ai.service';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly aiService: AIService,
  ) {}

  async retrieveRelevantContext(
    query: string,
    limit: number = 10,
    threshold: number = 0.7,
    sources?: string[],
  ): Promise<MessageContext[]> {
    try {
      this.logger.log(
        `Retrieving relevant context for query: ${query.substring(0, 100)}...`,
      );

      // Generate embedding for the query
      const embeddingVector = await this.aiService.generateEmbedding(query);

      // Find messages with similar intents first
      const intentMatches = await this.messageRepository.findByIntent(query);

      // Find messages by content search
      const contentMatches =
        await this.messageRepository.searchByContent(query);

      // Combine and deduplicate messages
      const allMessages = [...intentMatches, ...contentMatches];
      const uniqueMessages = allMessages.filter(
        (message, index, self) =>
          index === self.findIndex((m) => m.id === message.id),
      );

      // Convert messages to MessageContext format
      let contexts: MessageContext[] = uniqueMessages.map((message) => ({
        source: 'DOCUMENT',
        content: message.content,
        score: message.confidence || 0.8,
        metadata: {
          id: message.id,
          relatedMessageId: message.id,
          vectorEmbedding: embeddingVector,
          messageType: message.type,
          intent: message.intent,
          sessionId: message.sessionId,
          chatId: message.chatId,
          userId: message.metadata?.userId,
          timestamp: message.timestamp,
          processingTime: message.metadata?.processingTime,
          model: message.metadata?.model,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        },
      }));

      // Filter by sources if specified
      if (sources && sources.length > 0) {
        contexts = contexts.filter((context) =>
          sources.includes(context.source),
        );
      }

      // Sort by relevance score and filter by threshold
      contexts = contexts
        .filter((context) => context.score >= threshold)
        .sort((a, b) => b.score - a.score);

      this.logger.log(`Retrieved ${contexts.length} relevant contexts`);
      return contexts.slice(0, limit);
    } catch (error) {
      this.logger.error('Error retrieving relevant context:', error);
      throw new Error(`Failed to retrieve relevant context: ${error.message}`);
    }
  }

  augmentQueryWithContext(query: string, context: MessageContext[]): string {
    try {
      this.logger.log(`Augmenting query with ${context.length} contexts`);

      if (!context || context.length === 0) {
        return query;
      }

      // Sort contexts by relevance
      const sortedContexts = context.sort((a, b) => b.score - a.score);

      // Build context string
      const contextString = sortedContexts
        .map((ctx, index) => {
          const sourceInfo = ctx.metadata?.title || ctx.source;
          return `Context ${index + 1} (${sourceInfo}, relevance: ${ctx.score.toFixed(2)}):\n${ctx.content}`;
        })
        .join('\n\n');

      // Create augmented query
      const augmentedQuery = `
Based on the following context information, please provide a comprehensive and accurate response to the user's question.

CONTEXT INFORMATION:
${contextString}

USER QUESTION:
${query}

Please provide a helpful response that incorporates relevant information from the context while directly addressing the user's question. If the context doesn't contain sufficient information to fully answer the question, please indicate what additional information might be needed.
`;

      this.logger.log('Query successfully augmented with context');
      return augmentedQuery;
    } catch (error) {
      this.logger.error('Error augmenting query with context:', error);
      throw new Error(`Failed to augment query with context: ${error.message}`);
    }
  }

  async storeConversationContext(message: Message): Promise<void> {
    try {
      this.logger.log(
        `Storing conversation context for message: ${message.id}`,
      );

      // Generate embedding for the message content
      const embeddingVector = await this.aiService.generateEmbedding(
        message.content,
      );

      // Add vector embedding to message context
      const vectorContext: MessageContext = {
        source: 'VECTOR',
        content: `Vector embedding stored for: "${message.content.substring(0, 50)}..."`,
        score: 1.0,
        metadata: {
          vectorEmbedding: embeddingVector,
          stored: true,
          storedAt: new Date(),
          embeddingDimensions: embeddingVector.length,
        },
      };

      // Update message with vector context
      const updatedMessage = {
        ...message,
        context: [...(message.context || []), vectorContext],
      };

      // Update the message with the embedding context
      await this.messageRepository.update(message.id, updatedMessage);

      // Store extracted entities as additional context if available
      if (message.entities && message.entities.length > 0) {
        for (const entity of message.entities) {
          if (entity.confidence > 0.7) {
            // Create a separate message entry for high-confidence entities
            const entityMessage: Omit<Message, 'id'> = {
              chatId: message.chatId,
              sessionId: message.sessionId,
              type: 'SYSTEM',
              content: `Entity: ${entity.text} (${entity.type})`,
              timestamp: new Date(),
              intent: `ENTITY_${entity.type}`,
              confidence: entity.confidence,
              metadata: {
                userId: message.metadata?.userId,
                model: message.metadata?.model,
              },
              context: [
                {
                  source: entity.type as any,
                  content: entity.text,
                  score: entity.confidence,
                  metadata: {
                    entityType: entity.type,
                    originalMessageId: message.id,
                    originalContent: message.content,
                    vectorEmbedding: embeddingVector,
                    ...entity.metadata,
                  },
                },
              ],
              entities: [entity],
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            await this.messageRepository.create(entityMessage);
          }
        }
      }

      this.logger.log('Conversation context stored successfully');
    } catch (error) {
      this.logger.error('Error storing conversation context:', error);
      throw new Error(`Failed to store conversation context: ${error.message}`);
    }
  }

  async semanticSearch(query: string): Promise<MessageContext[]> {
    try {
      this.logger.log(
        `Performing semantic search for: ${query.substring(0, 100)}...`,
      );

      const limit = 10;
      const threshold = 0.7;

      // Generate embedding for the query
      const embeddingVector = await this.aiService.generateEmbedding(query);

      // Search messages by content
      const contentMatches =
        await this.messageRepository.searchByContent(query);

      // Search messages by intent
      const intentMatches = await this.messageRepository.findByIntent(query);

      // Combine and deduplicate
      const allMessages = [...contentMatches, ...intentMatches];
      const uniqueMessages = allMessages.filter(
        (message, index, self) =>
          index === self.findIndex((m) => m.id === message.id),
      );

      // Convert to MessageContext and apply semantic scoring
      const contexts: MessageContext[] = uniqueMessages.map((message) => {
        // Simple semantic scoring based on query match
        const queryWords = query.toLowerCase().split(' ');
        const contentWords = message.content.toLowerCase().split(' ');
        const matchCount = queryWords.filter((word) =>
          contentWords.some((contentWord) => contentWord.includes(word)),
        ).length;
        const semanticScore = Math.max(
          matchCount / queryWords.length,
          message.confidence || 0.5,
        );

        return {
          source: 'VECTOR',
          content: message.content,
          score: semanticScore,
          metadata: {
            id: message.id,
            relatedMessageId: message.id,
            vectorEmbedding: embeddingVector,
            messageType: message.type,
            intent: message.intent,
            sessionId: message.sessionId,
            chatId: message.chatId,
            userId: message.metadata?.userId,
            timestamp: message.timestamp,
            semanticScore,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
          },
        };
      });

      // Filter by threshold and sort by score
      const filteredContexts = contexts
        .filter((context) => context.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      this.logger.log(
        `Found ${filteredContexts.length} contexts via semantic search`,
      );
      return filteredContexts;
    } catch (error) {
      this.logger.error('Error performing semantic search:', error);
      throw new Error(`Failed to perform semantic search: ${error.message}`);
    }
  }

  async getPersonalizedContext(
    userId: string,
    query: string,
  ): Promise<MessageContext[]> {
    try {
      this.logger.log(`Getting personalized context for user: ${userId}`);

      const limit = 10;

      // Get user-specific messages
      const userMessages = await this.messageRepository.findRecentByUserId(
        userId,
        limit * 2,
      );

      // Generate embedding for the query
      const embeddingVector = await this.aiService.generateEmbedding(query);

      // Filter messages based on query relevance
      const relevantContexts: MessageContext[] = [];

      for (const message of userMessages) {
        // Simple keyword matching for relevance scoring
        const queryWords = query.toLowerCase().split(' ');
        const contentWords = message.content.toLowerCase().split(' ');

        const matchCount = queryWords.filter((word) =>
          contentWords.some((contentWord) => contentWord.includes(word)),
        ).length;

        const relevanceScore = matchCount / queryWords.length;

        if (relevanceScore > 0.2) {
          // Minimum relevance threshold
          const context: MessageContext = {
            source: 'DOCUMENT',
            content: message.content,
            score: relevanceScore,
            metadata: {
              id: message.id,
              relatedMessageId: message.id,
              vectorEmbedding: embeddingVector,
              messageType: message.type,
              intent: message.intent,
              sessionId: message.sessionId,
              chatId: message.chatId,
              userId: userId,
              timestamp: message.timestamp,
              personalized: true,
              relevanceScore,
              createdAt: message.createdAt,
              updatedAt: message.updatedAt,
            },
          };

          relevantContexts.push(context);
        }
      }

      // Sort by relevance and return top results
      relevantContexts.sort((a, b) => b.score - a.score);

      this.logger.log(`Found ${relevantContexts.length} personalized contexts`);
      return relevantContexts.slice(0, limit);
    } catch (error) {
      this.logger.error('Error getting personalized context:', error);
      throw new Error(`Failed to get personalized context: ${error.message}`);
    }
  }

  // Additional utility methods for RAG functionality

  async findSimilarConversations(
    query: string,
    limit: number = 5,
  ): Promise<Message[]> {
    try {
      this.logger.log(
        `Finding similar conversations for: ${query.substring(0, 100)}...`,
      );

      // Search messages by content and intent
      const contentMatches =
        await this.messageRepository.searchByContent(query);
      const intentMatches = await this.messageRepository.findByIntent(query);

      // Combine and deduplicate
      const allMessages = [...contentMatches, ...intentMatches];
      const uniqueMessages = allMessages.filter(
        (message, index, self) =>
          index === self.findIndex((m) => m.id === message.id),
      );

      // Sort by confidence and relevance
      const sortedMessages = uniqueMessages.sort(
        (a, b) => (b.confidence || 0) - (a.confidence || 0),
      );

      this.logger.log(
        `Found ${sortedMessages.length} similar conversation references`,
      );
      return sortedMessages.slice(0, limit);
    } catch (error) {
      this.logger.error('Error finding similar conversations:', error);
      throw new Error(`Failed to find similar conversations: ${error.message}`);
    }
  }

  async getRecentContextsBySource(
    source: string,
    limit: number = 10,
  ): Promise<MessageContext[]> {
    try {
      // Find messages by entity type or context source
      const messages = await this.messageRepository.findByEntityType(source);

      // Convert to MessageContext format
      const contexts: MessageContext[] = messages.map((message) => ({
        source: source as any,
        content: message.content,
        score: message.confidence || 0.8,
        metadata: {
          id: message.id,
          relatedMessageId: message.id,
          messageType: message.type,
          intent: message.intent,
          sessionId: message.sessionId,
          chatId: message.chatId,
          userId: message.metadata?.userId,
          timestamp: message.timestamp,
          source: source,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        },
      }));

      // Sort by creation date (most recent first) and limit
      return contexts
        .sort((a, b) => {
          const aDate = a.metadata.createdAt as Date;
          const bDate = b.metadata.createdAt as Date;
          return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
        })
        .slice(0, limit);
    } catch (error) {
      this.logger.error(
        `Error getting recent contexts by source ${source}:`,
        error,
      );
      throw new Error(
        `Failed to get recent contexts by source: ${error.message}`,
      );
    }
  }

  async getSessionContext(
    sessionId: string,
    limit: number = 20,
  ): Promise<MessageContext[]> {
    try {
      // Get messages from the session
      const sessionMessages =
        await this.messageRepository.findBySessionId(sessionId);

      // Convert to MessageContext format
      const contexts: MessageContext[] = sessionMessages.map((message) => ({
        source: 'DOCUMENT',
        content: message.content,
        score: message.confidence || 0.8,
        metadata: {
          id: message.id,
          relatedMessageId: message.id,
          messageType: message.type,
          intent: message.intent,
          sessionId: message.sessionId,
          chatId: message.chatId,
          userId: message.metadata?.userId,
          timestamp: message.timestamp,
          sessionContext: true,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        },
      }));

      // Sort by timestamp (conversation order) and limit
      return contexts
        .sort(
          (a, b) =>
            (a.metadata.timestamp as Date).getTime() -
            (b.metadata.timestamp as Date).getTime(),
        )
        .slice(0, limit);
    } catch (error) {
      this.logger.error(
        `Error getting session context for ${sessionId}:`,
        error,
      );
      throw new Error(`Failed to get session context: ${error.message}`);
    }
  }
}
