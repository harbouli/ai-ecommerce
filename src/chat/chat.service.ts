// src/chat/chat.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Chat } from './domain/chat';
import { Message, MessageMetadata, MessageContext } from './domain/message';
import { ChatRepository } from './infrastructure/persistence/chat.repository';
import { MessageRepository } from './infrastructure/persistence/message.repository';
import { AIService, ChatMessage } from '../ai/ai.service';
import { KagService } from './services/kag.service';
import { RagService } from './services/rag.service';
import { ShoppingService } from './services/shopping.service';
import { v4 as uuidv4 } from 'uuid';

export interface ChatAnalytics {
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  averageResponseTime: number;
  topIntents: Array<{ intent: string; count: number }>;
  topEntities: Array<{ entity: string; type: string; count: number }>;
  conversationLength: number;
  lastActivity: Date;
  sessionDuration: number;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly chatRepository: ChatRepository,
    private readonly messageRepository: MessageRepository,
    private readonly aiService: AIService,
    private readonly kagService: KagService,
    private readonly ragService: RagService,
    private readonly shoppingService: ShoppingService,
  ) {}

  // ===== CHAT MANAGEMENT =====
  async createChat(userId: string, title?: string): Promise<Chat> {
    try {
      const sessionId = this.generateSessionId();
      const chatTitle =
        title || `Shopping Chat ${new Date().toLocaleDateString()}`;

      const chatData = {
        userId,
        sessionId,
        title: chatTitle,
        status: 'ACTIVE' as const,
        lastActivity: new Date(),
        metadata: {
          createdBy: userId,
          platform: 'web',
          version: '1.0',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const chat = await this.chatRepository.create(chatData);
      this.logger.log(`Chat created: ${chat.id} for user: ${userId}`);

      // Create welcome message
      await this.createSystemMessage(
        chat.id,
        chat.sessionId,
        "Welcome! I'm your shopping assistant. How can I help you find the perfect products today?",
      );

      return chat;
    } catch (error) {
      this.logger.error(`Failed to create chat for user ${userId}:`, error);
      throw error;
    }
  }

  async sendMessage(
    chatId: string,
    content: string,
    userId?: string,
  ): Promise<Message> {
    const processingStartTime = Date.now();

    try {
      // Validate chat and content
      const chat = await this.validateChatAndContent(chatId, content);

      // Create user message
      const userMessage = await this.createUserMessage(chat, content, userId);

      // Process the message and generate response
      const assistantMessage = await this.processMessageAndRespond(
        chat,
        userMessage,
      );

      // Update chat activity
      await this.updateChatActivity(chatId);

      this.logger.log(
        `Message processed in ${Date.now() - processingStartTime}ms`,
      );
      return assistantMessage;
    } catch (error) {
      this.logger.error(`Failed to send message to chat ${chatId}:`, error);
      throw error;
    }
  }

  async getChatHistory(chatId: string): Promise<Message[]> {
    try {
      const chat = await this.chatRepository.findById(chatId);
      if (!chat) {
        throw new NotFoundException(`Chat not found: ${chatId}`);
      }

      const messages = await this.messageRepository.findByChatId(chatId);
      this.logger.log(
        `Retrieved ${messages.length} messages for chat: ${chatId}`,
      );

      return messages.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );
    } catch (error) {
      this.logger.error(`Failed to get chat history for ${chatId}:`, error);
      throw error;
    }
  }

  async getActiveChats(userId: string): Promise<Chat[]> {
    try {
      const chats = await this.chatRepository.findActiveByUserId(userId);
      this.logger.log(`Found ${chats.length} active chats for user: ${userId}`);
      return chats;
    } catch (error) {
      this.logger.error(
        `Failed to get active chats for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async endChat(chatId: string): Promise<Chat> {
    try {
      const chat = await this.chatRepository.findById(chatId);
      if (!chat) {
        throw new NotFoundException(`Chat not found: ${chatId}`);
      }

      const updatedChat = await this.chatRepository.update(chatId, {
        status: 'COMPLETED',
        updatedAt: new Date(),
      });

      if (updatedChat) {
        // Create closing message
        await this.createSystemMessage(
          chatId,
          chat.sessionId,
          'Thank you for shopping with us! Feel free to start a new conversation anytime.',
        );

        this.logger.log(`Chat ended: ${chatId}`);
      }

      return updatedChat || chat;
    } catch (error) {
      this.logger.error(`Failed to end chat ${chatId}:`, error);
      throw error;
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    try {
      const chat = await this.chatRepository.findById(chatId);
      if (!chat) {
        throw new NotFoundException(`Chat not found: ${chatId}`);
      }

      // Soft delete approach - mark as deleted
      await this.chatRepository.update(chatId, {
        status: 'ABANDONED',
        deletedAt: new Date(),
        updatedAt: new Date(),
      });

      this.logger.log(`Chat deleted: ${chatId}`);
    } catch (error) {
      this.logger.error(`Failed to delete chat ${chatId}:`, error);
      throw error;
    }
  }

  // ===== INTELLIGENT FEATURES =====
  async generateSuggestions(chatId: string): Promise<string[]> {
    try {
      const chat = await this.chatRepository.findById(chatId);
      if (!chat) {
        throw new NotFoundException(`Chat not found: ${chatId}`);
      }

      // Get recent messages for context
      const recentMessages = await this.messageRepository.findByChatId(chatId);
      const lastMessages = recentMessages
        .slice(-5)
        .map((msg) => `${msg.type}: ${msg.content}`)
        .join('\n');

      // Generate contextual suggestions
      const suggestions = await this.aiService.generateSuggestions(
        lastMessages,
        4,
      );

      this.logger.log(
        `Generated ${suggestions.length} suggestions for chat: ${chatId}`,
      );
      return suggestions;
    } catch (error) {
      this.logger.error(
        `Failed to generate suggestions for chat ${chatId}:`,
        error,
      );
      return [
        'Show me popular products',
        'I need help finding something specific',
        "What's trending today?",
        'Help me compare products',
      ];
    }
  }

  async getChatAnalytics(chatId: string): Promise<ChatAnalytics> {
    try {
      const chat = await this.chatRepository.findById(chatId);
      if (!chat) {
        throw new NotFoundException(`Chat not found: ${chatId}`);
      }

      const messages = await this.messageRepository.findByChatId(chatId);

      const userMessages = messages.filter((m) => m.type === 'USER');
      const assistantMessages = messages.filter((m) => m.type === 'ASSISTANT');

      // Calculate average response time
      const responseTimes = assistantMessages
        .map((msg) => msg.metadata?.processingTime || 0)
        .filter((time) => time > 0);
      const averageResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;

      // Analyze intents
      const intents = messages
        .filter((m) => m.intent)
        .reduce(
          (acc, msg) => {
            const intent = msg.intent!;
            acc[intent] = (acc[intent] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

      const topIntents = Object.entries(intents)
        .map(([intent, count]) => ({ intent, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Analyze entities
      const entities = messages
        .flatMap((m) => m.entities || [])
        .reduce(
          (acc, entity) => {
            const key = `${entity.text}-${entity.type}`;
            acc[key] = acc[key] || {
              entity: entity.text,
              type: entity.type,
              count: 0,
            };
            acc[key].count++;
            return acc;
          },
          {} as Record<string, { entity: string; type: string; count: number }>,
        );

      const topEntities = Object.values(entities)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate session duration
      const sessionDuration =
        chat.updatedAt.getTime() - chat.createdAt.getTime();

      const analytics: ChatAnalytics = {
        totalMessages: messages.length,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        averageResponseTime,
        topIntents,
        topEntities,
        conversationLength: messages.length,
        lastActivity: chat.updatedAt,
        sessionDuration,
      };

      this.logger.log(`Generated analytics for chat: ${chatId}`);
      return analytics;
    } catch (error) {
      this.logger.error(`Failed to get analytics for chat ${chatId}:`, error);
      throw error;
    }
  }

  // ===== PRIVATE HELPER METHODS =====
  private async validateChatAndContent(
    chatId: string,
    content: string,
  ): Promise<Chat> {
    const chat = await this.chatRepository.findById(chatId);
    if (!chat) {
      throw new NotFoundException(`Chat not found: ${chatId}`);
    }

    if (chat.status !== 'ACTIVE') {
      throw new BadRequestException(`Chat is not active: ${chatId}`);
    }

    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Message content cannot be empty');
    }

    return chat;
  }

  private async createUserMessage(
    chat: Chat,
    content: string,
    userId?: string,
  ): Promise<Message> {
    const messageData = {
      chatId: chat.id,
      sessionId: chat.sessionId,
      type: 'USER' as const,
      content: content.trim(),
      timestamp: new Date(),
      metadata: {
        userId: userId || chat.userId,
        userAgent: 'web-app',
        processingTime: 0,
      } as MessageMetadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await this.messageRepository.create(messageData);
  }

  private async createSystemMessage(
    chatId: string,
    sessionId: string,
    content: string,
  ): Promise<Message> {
    const messageData = {
      chatId,
      sessionId,
      type: 'SYSTEM' as const,
      content,
      timestamp: new Date(),
      metadata: {
        model: 'system',
        processingTime: 0,
      } as MessageMetadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await this.messageRepository.create(messageData);
  }

  private async processMessageAndRespond(
    chat: Chat,
    userMessage: Message,
  ): Promise<Message> {
    const processingStartTime = Date.now();

    try {
      // 1. Analyze the user's message
      const analysis = await this.aiService.analyzeQuery(userMessage.content);
      console.log('🚀 ~ ChatService ~ analysis:', analysis);

      // 2. Extract entities and update user message
      await this.messageRepository.update(userMessage.id, {
        intent: analysis.intent.intent,
        confidence: analysis.intent.confidence,
        entities: analysis.entities,
      });

      // 3. Get RAG context (relevant conversation history)
      const ragContext = await this.ragService.retrieveRelevantContext(
        userMessage.content,
        5,
      );

      // 4. Get KAG context (knowledge graph relationships)
      const kagContext = await this.kagService.getContextualKnowledge(
        chat.sessionId,
        userMessage.content,
      );

      // 5. Get personalized context
      const personalizedContext = await this.ragService.getPersonalizedContext(
        chat.userId,
        userMessage.content,
      );

      // 6. Process shopping query if relevant
      let shoppingResults;
      if (this.isShoppingIntent(analysis.intent.intent)) {
        shoppingResults = await this.shoppingService.processShoppingQuery(
          userMessage.content,
          chat.userId,
        );
      }

      // 7. Build comprehensive context
      const contextArray = [
        ...ragContext.map((ctx) => ctx.content),
        ...kagContext.map((entity) => `${entity.name}: ${entity.description}`),
        ...personalizedContext.map((ctx) => ctx.content),
      ];

      if (shoppingResults?.products?.length) {
        contextArray.push(
          `Found ${shoppingResults.products.length} relevant products: ` +
            shoppingResults.products
              .slice(0, 3)
              .map((p) => p.name)
              .join(', '),
        );
      }

      // 8. Get conversation history for AI context
      const recentMessages = await this.messageRepository.findByChatId(chat.id);
      const conversationHistory: ChatMessage[] = recentMessages
        .slice(-6) // Last 6 messages for context
        .map((msg) => ({
          role: msg.type === 'USER' ? 'user' : 'assistant',
          content: msg.content,
        }));

      // 9. Generate AI response
      const aiResponse = await this.aiService.generateContextualResponse(
        userMessage.content,
        contextArray,
        conversationHistory,
      );

      // 10. Create assistant message
      const assistantMessage = await this.createAssistantMessage(
        chat,
        aiResponse,
        ragContext,
        analysis,
        processingStartTime,
      );

      // 11. Update knowledge graph and conversation context (async)
      void this.updateContextAsync(userMessage, assistantMessage);

      return assistantMessage;
    } catch (error) {
      this.logger.error(
        'Error processing message and generating response:',
        error,
      );

      // Create fallback response
      return await this.createFallbackResponse(chat, processingStartTime);
    }
  }

  private async createAssistantMessage(
    chat: Chat,
    aiResponse: any,
    ragContext: MessageContext[],
    analysis: any,
    processingStartTime: number,
  ): Promise<Message> {
    const processingTime = Date.now() - processingStartTime;

    const messageData = {
      chatId: chat.id,
      sessionId: chat.sessionId,
      type: 'ASSISTANT' as const,
      content: aiResponse.content,
      timestamp: new Date(),
      context: ragContext,
      metadata: {
        model: aiResponse.model,
        tokensUsed: aiResponse.tokensUsed,
        processingTime,
        temperature: 0.7,
        aiProcessingTime: aiResponse.processingTime,
      } as MessageMetadata,
      intent: 'RESPONSE',
      confidence: aiResponse.confidence || 0.8,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await this.messageRepository.create(messageData);
  }

  private async createFallbackResponse(
    chat: Chat,
    processingStartTime: number,
  ): Promise<Message> {
    const processingTime = Date.now() - processingStartTime;

    const messageData = {
      chatId: chat.id,
      sessionId: chat.sessionId,
      type: 'ASSISTANT' as const,
      content:
        "I apologize, but I'm having trouble processing your request right now. Could you please rephrase your question or try asking about specific products you're looking for?",
      timestamp: new Date(),
      metadata: {
        model: 'fallback',
        processingTime,
        error: true,
      } as MessageMetadata,
      intent: 'ERROR_RESPONSE',
      confidence: 1.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await this.messageRepository.create(messageData);
  }

  private async updateContextAsync(
    userMessage: Message,
    assistantMessage: Message,
  ): Promise<void> {
    try {
      // Update knowledge graph
      await this.kagService.updateKnowledgeGraph(userMessage);

      // Store conversation context for RAG
      await this.ragService.storeConversationContext(userMessage);
      await this.ragService.storeConversationContext(assistantMessage);
    } catch (error) {
      this.logger.warn('Failed to update context asynchronously:', error);
    }
  }

  private async updateChatActivity(chatId: string): Promise<void> {
    try {
      await this.chatRepository.update(chatId, {
        lastActivity: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      this.logger.warn(`Failed to update chat activity for ${chatId}:`, error);
    }
  }

  private isShoppingIntent(intent: string): boolean {
    const shoppingIntents = [
      'PRODUCT_SEARCH',
      'PRODUCT_INQUIRY',
      'RECOMMENDATION',
      'COMPARISON',
      'PRICE_CHECK',
      'BROWSE_CATEGORY',
      'BROWSE_BRAND',
    ];
    return shoppingIntents.includes(intent);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${uuidv4().slice(0, 8)}`;
  }
}
