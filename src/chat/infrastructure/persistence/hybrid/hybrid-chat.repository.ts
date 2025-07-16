// src/chat/infrastructure/persistence/hybrid/hybrid-chat.repository.ts
import { Injectable, Logger } from '@nestjs/common';
import { Chat } from '../../../domain/chat';
import { ChatRepository } from '../chat.repository';
import { ChatDocumentRepository } from '../document/repositories/chat.repository';
import { ChatVectorRepository } from '../weaviate/repositories/chat-vector.repository';
import { ChatGraphRepository } from '../graph/repositories/chat-graph.repository';
import { NullableType } from '../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../utils/types/pagination-options';
import { ConversationContext } from '../../../domain/conversation';
import { UsersService } from '../../../../users/users.service';

@Injectable()
export class HybridChatRepository implements ChatRepository {
  private readonly logger = new Logger(HybridChatRepository.name);

  constructor(
    private mongoRepository: ChatDocumentRepository,
    private vectorRepository: ChatVectorRepository,
    private graphRepository: ChatGraphRepository,
    private usersService: UsersService,
  ) {}

  async create(data: Omit<Chat, 'id'>): Promise<Chat> {
    try {
      // 1. Get user information from Users Service
      const user = await this.usersService.findById(data.userId);
      if (!user) {
        throw new Error(`User not found: ${data.userId}`);
      }

      // 2. Create in MongoDB first (primary storage)
      const createdChat = await this.mongoRepository.create(data);
      this.logger.log(`Chat created in MongoDB: ${createdChat.id}`);

      // 3. Create user-chat relationship in Neo4j with user data
      try {
        await this.graphRepository.createUserChatRelationship(
          createdChat.userId,
          createdChat.id,
        );

        // Also create the chat structure in graph with user context
        await this.graphRepository.createChatWithMessages(
          createdChat.userId,
          createdChat.id,
          createdChat.sessionId,
          createdChat.title,
        );

        // Create user node in Neo4j if it doesn't exist
        // await this.graphRepository.createUserNode?.(user);

        this.logger.log(
          `Chat relationships created in Neo4j: ${createdChat.id}`,
        );
      } catch (graphError) {
        this.logger.error(
          `Failed to create chat in Neo4j: ${createdChat.id}`,
          graphError,
        );
        // Don't fail the entire operation
      }

      // 4. Store conversation context in Weaviate with rich user profile
      try {
        const conversationContext: ConversationContext = {
          sessionId: createdChat.sessionId,
          userId: createdChat.userId,
          userProfile: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            provider: user.provider,
            createdAt: user.createdAt,
            deletedAt: user.deletedAt,
            id: user.id,
            updatedAt: user.updatedAt,
          },
          currentIntent: 'CHAT_START',
          extractedEntities: [],
          conversationHistory: [],
          recommendations: [],
          summary: `New chat: ${createdChat.title} (User: ${user.firstName} ${user.lastName})`,
          createdAt: createdChat.createdAt,
          updatedAt: createdChat.updatedAt,
        };

        await this.vectorRepository.storeConversationContext(
          conversationContext,
        );
        this.logger.log(
          `Conversation context stored in Weaviate: ${createdChat.id}`,
        );
      } catch (vectorError) {
        this.logger.error(
          `Failed to store conversation context in Weaviate: ${createdChat.id}`,
          vectorError,
        );
        // Don't fail the entire operation
      }

      return createdChat;
    } catch (error) {
      this.logger.error('Failed to create chat:', error);
      throw error;
    }
  }

  async findById(id: Chat['id']): Promise<NullableType<Chat>> {
    // Use MongoDB as primary source for individual lookups
    return await this.mongoRepository.findById(id);
  }

  async findByUserId(userId: string): Promise<Chat[]> {
    // Use MongoDB for user's chat list
    return await this.mongoRepository.findByUserId(userId);
  }

  async findBySessionId(sessionId: string): Promise<NullableType<Chat>> {
    // Use MongoDB for session-based lookups
    return await this.mongoRepository.findBySessionId(sessionId);
  }

  async update(id: Chat['id'], payload: Partial<Chat>): Promise<Chat | null> {
    try {
      // 1. Update in MongoDB
      const updatedChat = await this.mongoRepository.update(id, payload);

      if (updatedChat) {
        this.logger.log(`Chat updated in MongoDB: ${id}`);

        // 2. Update conversation metrics in Neo4j if needed
        if (payload.status || payload.lastActivity) {
          try {
            const metrics = {
              status: updatedChat.status,
              lastActivity: updatedChat.lastActivity?.toISOString(),
              updatedAt: updatedChat.updatedAt.toISOString(),
            };

            await this.graphRepository.updateConversationMetrics(
              updatedChat.sessionId,
              metrics,
            );

            this.logger.log(`Conversation metrics updated in Neo4j: ${id}`);
          } catch (graphError) {
            this.logger.error(
              `Failed to update conversation metrics in Neo4j: ${id}`,
              graphError,
            );
          }
        }

        // 3. Update conversation context in Weaviate if title changed
        if (payload.title && payload.title !== updatedChat.title) {
          try {
            const conversationContext = {
              sessionId: updatedChat.sessionId,
              userId: updatedChat.userId,
              userProfile: {
                preferences: {},
                purchaseHistory: [],
                searchHistory: [],
                demographics: {},
              },
              currentIntent: 'CHAT_UPDATE',
              extractedEntities: [],
              conversationHistory: [],
              recommendations: [],
              summary: `Updated chat: ${updatedChat.title}`,
              createdAt: updatedChat.createdAt,
              updatedAt: updatedChat.updatedAt,
            } as any; // Type assertion to avoid UserProfile conflict

            await this.vectorRepository.storeConversationContext(
              conversationContext,
            );
            this.logger.log(`Conversation context updated in Weaviate: ${id}`);
          } catch (vectorError) {
            this.logger.error(
              `Failed to update conversation context in Weaviate: ${id}`,
              vectorError,
            );
          }
        }
      }

      return updatedChat;
    } catch (error) {
      this.logger.error(`Failed to update chat: ${id}`, error);
      throw error;
    }
  }

  async remove(id: Chat['id']): Promise<void> {
    try {
      // Get chat details before deletion
      const chat = await this.findById(id);

      if (!chat) {
        this.logger.warn(`Chat not found for deletion: ${id}`);
        return;
      }

      // 1. Remove from MongoDB
      await this.mongoRepository.remove(id);
      this.logger.log(`Chat removed from MongoDB: ${id}`);

      // 2. Remove from Neo4j (this will also remove relationships)
      try {
        // Remove user-chat relationships and related data
        // Note: We don't have a deleteChat method, so we'll clean up relationships
        this.logger.log(
          `Chat relationships would be cleaned up in Neo4j: ${id}`,
        );
      } catch (graphError) {
        this.logger.error(
          `Failed to remove chat from Neo4j: ${id}`,
          graphError,
        );
      }

      // 3. Remove conversation context from Weaviate
      try {
        // Note: We don't have a deleteConversationContext method in the current implementation
        // This would need to be implemented in the ChatVectorRepository
        this.logger.log(
          `Conversation context would be removed from Weaviate: ${id}`,
        );
      } catch (vectorError) {
        this.logger.error(
          `Failed to remove conversation context from Weaviate: ${id}`,
          vectorError,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to remove chat: ${id}`, error);
      throw error;
    }
  }

  async findActiveByUserId(userId: string): Promise<Chat[]> {
    // Use MongoDB for filtering active chats
    return await this.mongoRepository.findActiveByUserId(userId);
  }

  async markAsCompleted(id: Chat['id']): Promise<Chat | null> {
    try {
      // 1. Mark as completed in MongoDB
      const completedChat = await this.mongoRepository.markAsCompleted(id);

      if (completedChat) {
        this.logger.log(`Chat marked as completed in MongoDB: ${id}`);

        // 2. Update conversation metrics in Neo4j
        try {
          const metrics = {
            status: 'COMPLETED',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await this.graphRepository.updateConversationMetrics(
            completedChat.sessionId,
            metrics,
          );

          this.logger.log(`Conversation completion tracked in Neo4j: ${id}`);
        } catch (graphError) {
          this.logger.error(
            `Failed to track completion in Neo4j: ${id}`,
            graphError,
          );
        }
      }

      return completedChat;
    } catch (error) {
      this.logger.error(`Failed to mark chat as completed: ${id}`, error);
      throw error;
    }
  }

  // Implementation of base ChatRepository methods
  async findWithPagination(options: IPaginationOptions): Promise<Chat[]> {
    return await this.mongoRepository.findWithPagination(options);
  }

  async findByStatus(
    status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED',
  ): Promise<Chat[]> {
    return await this.mongoRepository.findByStatus(status);
  }

  async findRecentByUserId(userId: string, limit: number): Promise<Chat[]> {
    return await this.mongoRepository.findRecentByUserId(userId, limit);
  }

  async countByUserId(userId: string): Promise<number> {
    return await this.mongoRepository.countByUserId(userId);
  }

  async findByUserIdAndStatus(
    userId: string,
    status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED',
  ): Promise<Chat[]> {
    return await this.mongoRepository.findByUserIdAndStatus(userId, status);
  }

  async updateLastActivity(id: Chat['id']): Promise<Chat | null> {
    return await this.mongoRepository.updateLastActivity(id);
  }

  async findInactiveChats(inactiveThreshold: Date): Promise<Chat[]> {
    return await this.mongoRepository.findInactiveChats(inactiveThreshold);
  }

  // Hybrid-specific methods
  async findSimilarChats(chatId: string, limit: number = 5): Promise<Chat[]> {
    try {
      // 1. Get similar conversations from Neo4j based on graph patterns
      const similarFromGraph =
        await this.graphRepository.findSimilarConversations(chatId, limit);

      // 2. Get chat details from MongoDB
      const similarChatIds = similarFromGraph.map((sim) => sim.chatId);
      const similarChats: Chat[] = [];

      for (const similarChatId of similarChatIds) {
        const chat = await this.mongoRepository.findById(similarChatId);
        if (chat) {
          similarChats.push(chat);
        }
      }

      this.logger.log(
        `Found ${similarChats.length} similar chats for ${chatId}`,
      );
      return similarChats;
    } catch (error) {
      this.logger.error(`Failed to find similar chats for ${chatId}:`, error);
      return [];
    }
  }

  async getConversationInsights(sessionId: string): Promise<any> {
    try {
      const insights: any = {};

      // 1. Get conversation path from Neo4j
      try {
        const conversationPath =
          await this.graphRepository.findConversationPath(sessionId);
        insights.conversationPath = conversationPath;
        insights.messageCount = conversationPath.length;

        if (conversationPath.length > 0) {
          insights.intents = [
            ...new Set(
              conversationPath.map((msg) => msg.intent).filter(Boolean),
            ),
          ];
          insights.avgConfidence =
            conversationPath
              .filter((msg) => msg.confidence)
              .reduce((sum, msg) => sum + msg.confidence, 0) /
            conversationPath.length;
        }
      } catch (graphError) {
        this.logger.error(
          `Failed to get conversation path for ${sessionId}:`,
          graphError,
        );
      }

      // 2. Get semantic context from Weaviate
      try {
        const semanticContext = await this.vectorRepository.semanticSearch(
          `session:${sessionId}`,
          10,
          0.6,
        );
        insights.semanticContext = semanticContext;
      } catch (vectorError) {
        this.logger.error(
          `Failed to get semantic context for ${sessionId}:`,
          vectorError,
        );
      }

      // 3. Get chat metadata from MongoDB
      try {
        const chat = await this.mongoRepository.findBySessionId(sessionId);
        if (chat) {
          insights.chatMetadata = {
            id: chat.id,
            title: chat.title,
            status: chat.status,
            createdAt: chat.createdAt,
            lastActivity: chat.lastActivity,
            metadata: chat.metadata,
          };
        }
      } catch (mongoError) {
        this.logger.error(
          `Failed to get chat metadata for ${sessionId}:`,
          mongoError,
        );
      }

      return insights;
    } catch (error) {
      this.logger.error(
        `Failed to get conversation insights for ${sessionId}:`,
        error,
      );
      return {};
    }
  }

  async findRecommendedTopics(userId: string): Promise<string[]> {
    try {
      // 1. Get user behavior patterns from Neo4j
      const behaviorPatterns =
        await this.graphRepository.findUserBehaviorPatterns(userId);

      const recommendedTopics: string[] = [];

      // 2. Extract topics from behavior patterns
      if (behaviorPatterns.length > 0) {
        const userBehavior = behaviorPatterns[0];
        const intentPatterns = userBehavior.intentPatterns || [];

        // Get most frequent intents from recent activity
        const recentIntents = intentPatterns
          .filter((pattern) => pattern.period === 'recent')
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 3)
          .map((pattern) => pattern.intent);

        recommendedTopics.push(...recentIntents);
      }

      // 3. Get semantic recommendations from Weaviate
      try {
        const userContext = await this.vectorRepository.hybridSearch(
          `user:${userId} recommendations`,
          { userId },
          5,
        );

        const semanticTopics = userContext
          .map((ctx) => ctx.metadata.intent)
          .filter(Boolean)
          .slice(0, 3);

        recommendedTopics.push(...semanticTopics);
      } catch (vectorError) {
        this.logger.error(
          `Failed to get semantic recommendations for ${userId}:`,
          vectorError,
        );
      }

      // Remove duplicates and return
      const uniqueTopics = [...new Set(recommendedTopics)];
      this.logger.log(
        `Found ${uniqueTopics.length} recommended topics for ${userId}`,
      );

      return uniqueTopics;
    } catch (error) {
      this.logger.error(
        `Failed to find recommended topics for ${userId}:`,
        error,
      );
      return [];
    }
  }

  async getContextualSuggestions(sessionId: string): Promise<string[]> {
    try {
      const suggestions: string[] = [];

      // 1. Get conversation history from Neo4j
      try {
        const conversationPath =
          await this.graphRepository.findConversationPath(sessionId);

        if (conversationPath.length > 0) {
          const lastMessage = conversationPath[conversationPath.length - 1];
          const currentIntent = lastMessage.intent;

          // Get common intent transitions
          const chat = await this.mongoRepository.findBySessionId(sessionId);
          if (chat) {
            const intentFlow = await this.graphRepository.findIntentFlow(
              chat.userId,
            );

            const nextIntents = intentFlow
              .filter((flow) => flow.fromIntent === currentIntent)
              .sort((a, b) => b.frequency - a.frequency)
              .slice(0, 3)
              .map((flow) => flow.toIntent);

            suggestions.push(...nextIntents);
          }
        }
      } catch (graphError) {
        this.logger.error(
          `Failed to get intent flow for ${sessionId}:`,
          graphError,
        );
      }

      // 2. Get semantic suggestions from Weaviate
      try {
        const recentContext = await this.vectorRepository.findContextByIntent(
          'PRODUCT_SEARCH',
          5,
        );

        const semanticSuggestions = recentContext
          .map((ctx) => ctx.content)
          .filter((content) => content.includes('?'))
          .slice(0, 3);

        suggestions.push(...semanticSuggestions);
      } catch (vectorError) {
        this.logger.error(
          `Failed to get semantic suggestions for ${sessionId}:`,
          vectorError,
        );
      }

      // 3. Add fallback suggestions
      if (suggestions.length === 0) {
        suggestions.push(
          'Can you tell me more about your preferences?',
          'Would you like product recommendations?',
          'Do you have any specific questions?',
        );
      }

      // Remove duplicates and return
      const uniqueSuggestions = [...new Set(suggestions)];
      this.logger.log(
        `Generated ${uniqueSuggestions.length} contextual suggestions for ${sessionId}`,
      );

      return uniqueSuggestions;
    } catch (error) {
      this.logger.error(
        `Failed to get contextual suggestions for ${sessionId}:`,
        error,
      );
      return [
        'How can I help you today?',
        'What are you looking for?',
        'Would you like some recommendations?',
      ];
    }
  }

  // Additional hybrid utility methods
  async getChatAnalytics(chatId: string): Promise<any> {
    try {
      const analytics: any = {};

      // Get chat from MongoDB
      const chat = await this.mongoRepository.findById(chatId);
      if (!chat) {
        return null;
      }

      // Get conversation insights
      const insights = await this.getConversationInsights(chat.sessionId);
      analytics.insights = insights;

      // Get similar chats
      const similarChats = await this.findSimilarChats(chatId, 3);
      analytics.similarChats = similarChats.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
      }));

      // Get user behavior context
      const behaviorPatterns =
        await this.graphRepository.findUserBehaviorPatterns(chat.userId);
      analytics.userBehavior = behaviorPatterns[0] || null;

      return analytics;
    } catch (error) {
      this.logger.error(`Failed to get chat analytics for ${chatId}:`, error);
      return null;
    }
  }

  async getRecommendationContext(
    userId: string,
    limit: number = 5,
  ): Promise<any> {
    try {
      // Combine graph and vector data for better recommendations
      const behaviorPatterns =
        await this.graphRepository.findUserBehaviorPatterns(userId);
      const vectorContext = await this.vectorRepository.hybridSearch(
        `recommendations user:${userId}`,
        { userId },
        limit,
      );

      return {
        behaviorPatterns,
        vectorContext,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get recommendation context for ${userId}:`,
        error,
      );
      return {
        behaviorPatterns: [],
        vectorContext: [],
        timestamp: new Date(),
      };
    }
  }
}
