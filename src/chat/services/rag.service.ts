import { Injectable, Logger } from '@nestjs/common';
import { MessageRepository } from '../infrastructure/persistence/message.repository';
import { Message, MessageContext, MessageMetadata } from '../domain/message';
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
    limit: number = 5,
  ): Promise<MessageContext[]> {
    try {
      this.logger.log(
        `Retrieving relevant context for query: ${query.substring(0, 50)}...`,
      );

      // Find similar messages using semantic search
      const similarMessages = await this.findSimilarConversations(
        query,
        limit * 2,
      );

      // Convert messages to context objects
      const contexts: MessageContext[] = [];

      for (const message of similarMessages) {
        // Calculate relevance score (simplified - in real implementation, use vector similarity)
        const score = this.calculateRelevanceScore(query, message.content);

        if (score > 0.3) {
          // Threshold for relevance
          contexts.push({
            source: 'DOCUMENT',
            content: message.content,
            score,
            metadata: {
              messageId: message.id,
              chatId: message.chatId,
              sessionId: message.sessionId,
              timestamp: message.timestamp,
              type: message.type,
              intent: message.intent,
              confidence: message.confidence,
            },
          });
        }
      }

      // Sort by relevance score and limit results
      const sortedContexts = contexts
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      this.logger.log(`Retrieved ${sortedContexts.length} relevant contexts`);
      return sortedContexts;
    } catch (error) {
      this.logger.error('Failed to retrieve relevant context:', error);
      return [];
    }
  }

  augmentQueryWithContext(query: string, context: MessageContext[]): string {
    try {
      if (context.length === 0) {
        return query; // Return original query if no context
      }

      this.logger.log(`Augmenting query with ${context.length} context items`);

      // Build context section
      const contextSection = context
        .map(
          (ctx, index) =>
            `[Context ${index + 1}] (Score: ${ctx.score.toFixed(2)}): ${ctx.content}`,
        )
        .join('\n');

      // Create augmented query
      const augmentedQuery = `
User Query: ${query}

Relevant Conversation History:
${contextSection}

Instructions: Use the above conversation history to provide context for answering the user's query. Reference previous discussions when relevant, but focus primarily on the current query.
      `.trim();

      this.logger.log('Query successfully augmented with context');
      return augmentedQuery;
    } catch (error) {
      this.logger.error('Failed to augment query with context:', error);
      return query; // Return original query on error
    }
  }

  async storeConversationContext(message: Message): Promise<void> {
    try {
      // The message is already stored by the message repository
      // This method can be used for additional context processing

      this.logger.debug(
        `Storing conversation context for message: ${message.id}`,
      );

      // Generate and store embedding if not already present
      const currentMetadata = message.metadata || {};

      if (!this.hasEmbedding(currentMetadata)) {
        try {
          const embedding = await this.aiService.generateEmbedding(
            message.content,
          );

          // Create enhanced metadata with embedding
          const enhancedMetadata: MessageMetadata & {
            embedding?: number[];
            embeddingModel?: string;
            embeddingDimensions?: number;
          } = {
            ...currentMetadata,
            embedding: embedding.vector,
            embeddingModel: embedding.model,
            embeddingDimensions: embedding.dimensions,
          };

          // Update message with embedding
          await this.messageRepository.update(message.id, {
            metadata: enhancedMetadata,
          });

          this.logger.debug(
            `Generated and stored embedding for message: ${message.id}`,
          );
        } catch (embeddingError) {
          this.logger.warn(
            `Failed to generate embedding for message ${message.id}:`,
            embeddingError,
          );
        }
      }

      // Extract and store additional context metadata
      await this.extractAndStoreMetadata(message);
    } catch (error) {
      this.logger.error(
        `Failed to store conversation context for message ${message.id}:`,
        error,
      );
      // Don't throw error to avoid breaking the main flow
    }
  }

  async findSimilarConversations(
    query: string,
    limit: number = 10,
  ): Promise<Message[]> {
    try {
      this.logger.log(
        `Finding similar conversations for query: ${query.substring(0, 50)}...`,
      );

      // Method 1: Text-based similarity search
      const textMatches = await this.findTextSimilarMessages(query, limit);

      // Method 2: Intent-based search
      const intentMatches = await this.findIntentSimilarMessages(query, limit);

      // Method 3: Entity-based search
      const entityMatches = await this.findEntitySimilarMessages(query, limit);

      // Combine and deduplicate results
      const allMatches = [...textMatches, ...intentMatches, ...entityMatches];
      const uniqueMatches = allMatches.filter(
        (message, index, self) =>
          index === self.findIndex((m) => m.id === message.id),
      );

      // Score and sort messages
      const scoredMessages = uniqueMatches.map((message) => ({
        message,
        score: this.calculateRelevanceScore(query, message.content),
      }));

      const sortedMessages = scoredMessages
        .filter((item) => item.score > 0.2) // Minimum relevance threshold
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item) => item.message);

      this.logger.log(`Found ${sortedMessages.length} similar conversations`);
      return sortedMessages;
    } catch (error) {
      this.logger.error('Failed to find similar conversations:', error);
      return [];
    }
  }

  async getPersonalizedContext(
    userId: string,
    query: string,
  ): Promise<MessageContext[]> {
    try {
      this.logger.log(`Getting personalized context for user: ${userId}`);

      // Get user's recent messages
      const userMessages = await this.messageRepository.findRecentByUserId(
        userId,
        20,
      );

      // Filter for relevant messages
      const relevantMessages = userMessages.filter(
        (message) => this.calculateRelevanceScore(query, message.content) > 0.3,
      );

      // Convert to context objects
      const personalizedContexts: MessageContext[] = relevantMessages.map(
        (message) => ({
          source: 'DOCUMENT',
          content: message.content,
          score: this.calculateRelevanceScore(query, message.content),
          metadata: {
            messageId: message.id,
            chatId: message.chatId,
            sessionId: message.sessionId,
            timestamp: message.timestamp,
            type: message.type,
            userId: userId,
            personalized: true,
          },
        }),
      );

      // Sort by relevance and limit
      const sortedContexts = personalizedContexts
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      this.logger.log(
        `Retrieved ${sortedContexts.length} personalized contexts`,
      );
      return sortedContexts;
    } catch (error) {
      this.logger.error(
        `Failed to get personalized context for user ${userId}:`,
        error,
      );
      return [];
    }
  }

  // ===== VECTOR SIMILARITY METHODS =====

  async findSimilarMessagesByVector(
    queryVector: number[],
    limit: number = 10,
  ): Promise<Message[]> {
    try {
      this.logger.log('Finding similar messages using vector similarity');

      // Get recent messages that have embeddings
      const recentMessages = await this.messageRepository.findRecentByUserId(
        '',
        500,
      );

      // Filter messages that have embeddings
      const messagesWithEmbeddings = recentMessages.filter((message) =>
        this.hasEmbedding(message.metadata || {}),
      );

      // Calculate similarity scores
      const scoredMessages = messagesWithEmbeddings
        .map((message) => {
          const embedding = this.getEmbedding(message.metadata || {});
          const similarity = embedding
            ? this.calculateCosineSimilarity(queryVector, embedding)
            : 0;

          return {
            message,
            similarity,
          };
        })
        .filter((item) => item.similarity > 0.5) // Minimum similarity threshold
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map((item) => item.message);

      this.logger.log(
        `Found ${scoredMessages.length} similar messages by vector`,
      );
      return scoredMessages;
    } catch (error) {
      this.logger.error('Failed to find similar messages by vector:', error);
      return [];
    }
  }

  async retrieveRelevantContextWithVectors(
    query: string,
    limit: number = 5,
  ): Promise<MessageContext[]> {
    try {
      this.logger.log('Retrieving context using vector similarity');

      // Generate query embedding
      const queryEmbedding = await this.aiService.generateEmbedding(query);

      // Find similar messages using vector similarity
      const similarMessages = await this.findSimilarMessagesByVector(
        queryEmbedding.vector,
        limit * 2,
      );

      // Convert to context objects with vector scores
      const contexts: MessageContext[] = similarMessages.map((message) => {
        const embedding = this.getEmbedding(message.metadata || {});
        const vectorScore = embedding
          ? this.calculateCosineSimilarity(queryEmbedding.vector, embedding)
          : 0;

        const textScore = this.calculateRelevanceScore(query, message.content);

        // Combine vector and text scores
        const combinedScore = vectorScore * 0.7 + textScore * 0.3;

        return {
          source: 'VECTOR' as const,
          content: message.content,
          score: combinedScore,
          metadata: {
            messageId: message.id,
            chatId: message.chatId,
            sessionId: message.sessionId,
            timestamp: message.timestamp,
            type: message.type,
            vectorScore,
            textScore,
            combinedScore,
          },
        };
      });

      // Sort by combined score and limit
      const sortedContexts = contexts
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      this.logger.log(
        `Retrieved ${sortedContexts.length} vector-based contexts`,
      );
      return sortedContexts;
    } catch (error) {
      this.logger.error('Failed to retrieve vector-based context:', error);
      return [];
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private hasEmbedding(metadata: MessageMetadata | any): boolean {
    return (
      !!(metadata as any).embedding &&
      Array.isArray((metadata as any).embedding)
    );
  }

  private getEmbedding(metadata: MessageMetadata | any): number[] | null {
    const embedding = (metadata as any).embedding;
    return Array.isArray(embedding) ? embedding : null;
  }

  private calculateCosineSimilarity(
    vectorA: number[],
    vectorB: number[],
  ): number {
    if (vectorA.length !== vectorB.length) {
      return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  private async findTextSimilarMessages(
    query: string,
    limit: number,
  ): Promise<Message[]> {
    try {
      // Simple text-based search (in production, use full-text search or vector similarity)
      const queryTerms = query
        .toLowerCase()
        .split(' ')
        .filter((term) => term.length > 2);

      if (queryTerms.length === 0) {
        return [];
      }

      // This is a simplified implementation
      // In production, you would use a proper search engine or vector database
      const recentMessages = await this.messageRepository.findRecentByUserId(
        '',
        100,
      ); // Get recent messages across all users

      const matchedMessages = recentMessages.filter((message) => {
        const content = message.content.toLowerCase();
        return queryTerms.some((term) => content.includes(term));
      });

      return matchedMessages.slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to find text similar messages:', error);
      return [];
    }
  }

  private async findIntentSimilarMessages(
    query: string,
    limit: number,
  ): Promise<Message[]> {
    try {
      // Classify the query intent
      const queryIntent = await this.aiService.classifyIntent(query);

      if (!queryIntent.intent || queryIntent.intent === 'OTHER') {
        return [];
      }

      // Find messages with similar intent
      const intentMessages = await this.messageRepository.findByIntent(
        queryIntent.intent,
      );

      return intentMessages.slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to find intent similar messages:', error);
      return [];
    }
  }

  private async findEntitySimilarMessages(
    query: string,
    limit: number,
  ): Promise<Message[]> {
    try {
      // Extract entities from the query
      const queryEntities = await this.aiService.extractEntities(query);

      if (queryEntities.length === 0) {
        return [];
      }

      const entityMatches: Message[] = [];

      // Find messages that mention similar entities
      for (const entity of queryEntities) {
        const entityMessages = await this.messageRepository.findByEntityType(
          entity.type,
        );

        // Filter messages that contain the entity text
        const relevantMessages = entityMessages.filter(
          (message) =>
            message.content.toLowerCase().includes(entity.text.toLowerCase()) ||
            (message.entities &&
              message.entities.some((e) =>
                e.text.toLowerCase().includes(entity.text.toLowerCase()),
              )),
        );

        entityMatches.push(...relevantMessages);
      }

      // Remove duplicates
      const uniqueMatches = entityMatches.filter(
        (message, index, self) =>
          index === self.findIndex((m) => m.id === message.id),
      );

      return uniqueMatches.slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to find entity similar messages:', error);
      return [];
    }
  }

  private calculateRelevanceScore(query: string, content: string): number {
    try {
      // Simple relevance scoring algorithm
      // In production, use more sophisticated methods like TF-IDF or neural similarity

      const queryTerms = query
        .toLowerCase()
        .split(' ')
        .filter((term) => term.length > 2);
      const contentLower = content.toLowerCase();

      if (queryTerms.length === 0) {
        return 0;
      }

      // Calculate term frequency
      let matchCount = 0;
      const totalTerms = queryTerms.length;

      for (const term of queryTerms) {
        if (contentLower.includes(term)) {
          matchCount++;
        }
      }

      // Basic score calculation
      let score = matchCount / totalTerms;

      // Boost score for exact phrase matches
      if (contentLower.includes(query.toLowerCase())) {
        score += 0.3;
      }

      // Boost score for shorter content (more focused)
      if (content.length < 200) {
        score += 0.1;
      }

      // Normalize score to 0-1 range
      return Math.min(score, 1.0);
    } catch (error) {
      this.logger.error('Failed to calculate relevance score:', error);
      return 0;
    }
  }

  private async extractAndStoreMetadata(message: Message): Promise<void> {
    try {
      // Extract additional metadata that might be useful for RAG
      const currentMetadata = message.metadata || {};

      const enhancedMetadata: MessageMetadata & Record<string, any> = {
        ...currentMetadata,
        wordCount: message.content.split(' ').length,
        characterCount: message.content.length,
        containsQuestion: message.content.includes('?'),
        containsNumbers: /\d/.test(message.content),
        extractedAt: new Date(),
      };

      // Update message with enhanced metadata
      await this.messageRepository.update(message.id, {
        metadata: enhancedMetadata,
      });

      this.logger.debug(`Enhanced metadata for message: ${message.id}`);
    } catch (error) {
      this.logger.warn(
        `Failed to extract metadata for message ${message.id}:`,
        error,
      );
    }
  }
}
