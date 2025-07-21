import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

// Import existing domain entities
import { Chat } from './domain/chat';
import { Message } from './domain/message';

// Import existing repository ports
import { ChatRepository } from './infrastructure/persistence/chat.repository';
import { MessageRepository } from './infrastructure/persistence/message.repository';
import { IRagService } from './interfaces/rag.service.interface';
import { IKagService } from './interfaces/kag.service.interface';

// Analytics domain for getChatAnalytics method
export class ChatAnalytics {
  chatId: string;
  totalMessages: number;
  averageResponseTime: number;
  userSatisfaction?: number;
  topIntents: { intent: string; count: number }[];
  lastActivity: Date;
}

// TODO: Implement MessageProcessingService when ready
// export interface IMessageProcessingService {
//   processIncomingMessage(message: string, userId: string): Promise<any>;
//   determineResponseStrategy(intent: any): Promise<string>;
//   generateContextualResponse(query: string, context: any, strategy: string): Promise<string>;
//   trackUserInteraction(userId: string, interaction: any): Promise<void>;
// }

// TODO: Implement ContextService when ready
// export interface IContextService {
//   buildConversationContext(chatId: string): Promise<any>;
//   extractShoppingContext(messages: Message[]): Promise<any>;
//   updateUserPreferences(userId: string, preferences: any): Promise<void>;
//   getRelevantKnowledge(query: string): Promise<any>;
// }

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly chatRepository: ChatRepository,
    private readonly messageRepository: MessageRepository,
    @Inject('RAG_SERVICE') private readonly ragService: IRagService,
    @Inject('KAG_SERVICE') private readonly kagService?: IKagService,
    // @Optional() @Inject('MESSAGE_PROCESSING_SERVICE') private readonly messageProcessingService?: IMessageProcessingService,
    // @Optional() @Inject('CONTEXT_SERVICE') private readonly contextService?: IContextService,
  ) {}

  /**
   * Initialize new chat session
   */
  async createChat(userId: string): Promise<Chat> {
    try {
      const sessionId = uuidv4();
      const title = `Watch Shopping ${new Date().toLocaleDateString()}`;

      const chatData = {
        userId,
        sessionId,
        title,
        status: 'ACTIVE' as const,
        lastActivity: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const chat = await this.chatRepository.create(chatData);

      // Create welcome message
      await this.createSystemMessage(
        chat.id,
        "Welcome! I'm your watch shopping assistant. How can I help you find the perfect watch today?",
      );

      this.logger.log(`Chat created: ${chat.id} for user: ${userId}`);
      return chat;
    } catch (error) {
      this.logger.error('Failed to create chat', error);
      throw error;
    }
  }

  /**
   * Process user messages and generate responses
   */
  async sendMessage(
    chatId: string,
    message: string,
    userId: string,
  ): Promise<{
    userMessage: Message;
    assistantMessage: Message;
  }> {
    try {
      // Verify chat exists and user has access
      const chat = await this.chatRepository.findById(chatId);
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }
      if (chat.userId !== userId) {
        throw new NotFoundException('Unauthorized access to chat');
      }

      // Store user message
      const userMessage = await this.createUserMessage(chatId, message);

      // Process message and generate response
      const response = await this.processMessage(message, chatId, userId);

      // Store assistant response
      const assistantMessage = await this.createAssistantMessage(
        chatId,
        response.content,
        response.metadata,
      );

      // Update chat timestamp and last activity
      await this.chatRepository.update(chatId, {
        updatedAt: new Date(),
        lastActivity: new Date(),
      });

      await this.ragService.storeConversationContext(userMessage);
      await this.ragService.storeConversationContext(assistantMessage);

      this.logger.log(`Message processed: ${userMessage.id}`);

      return { userMessage, assistantMessage };
    } catch (error) {
      this.logger.error('Failed to send message', error);
      throw error;
    }
  }

  /**
   * Retrieve conversation history
   */
  async getChatHistory(chatId: string): Promise<{
    messages: Message[];
    total: number;
  }> {
    try {
      const chat = await this.chatRepository.findById(chatId);
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      // Using your existing repository method that returns Message[] directly
      const messages = await this.messageRepository.findByChatId(chatId);
      const total = messages.length;

      return {
        messages: messages.reverse(), // Most recent first
        total,
      };
    } catch (error) {
      this.logger.error('Failed to get chat history', error);
      throw error;
    }
  }

  /**
   * Get chat insights and analytics
   */
  async getChatAnalytics(chatId: string): Promise<ChatAnalytics> {
    try {
      const chat = await this.chatRepository.findById(chatId);
      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      const messages = await this.messageRepository.findByChatId(chatId);
      const totalMessages = messages.length;

      // Calculate basic analytics
      const averageResponseTime = this.calculateAverageResponseTime(messages);
      const topIntents = this.extractTopIntents(messages);
      const lastActivity =
        messages.length > 0
          ? messages[messages.length - 1].timestamp
          : chat.lastActivity;

      return {
        chatId,
        totalMessages,
        averageResponseTime,
        topIntents,
        lastActivity,
      };
    } catch (error) {
      this.logger.error('Failed to get chat analytics', error);
      throw error;
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private async processMessage(
    message: string,
    chatId: string,
    userId: string,
  ): Promise<{
    content: string;
    metadata: any;
  }> {
    const startTime = Date.now();

    try {
      // TODO: Use MessageProcessingService when implemented
      // if (this.messageProcessingService) {
      //   const result = await this.messageProcessingService.processIncomingMessage(message, userId);
      //   const strategy = await this.messageProcessingService.determineResponseStrategy(result.intent);
      //   const context = await this.buildMessageContext(message, chatId, userId);
      //   const response = await this.messageProcessingService.generateContextualResponse(message, context, strategy);
      //
      //   await this.messageProcessingService.trackUserInteraction(userId, {
      //     message,
      //     response,
      //     intent: result.intent,
      //     timestamp: new Date()
      //   });
      //
      //   return {
      //     content: response,
      //     metadata: {
      //       processingTime: Date.now() - startTime,
      //       intent: result.intent,
      //       confidence: result.confidence,
      //       model: 'hybrid-rag-kag-v1',
      //     },
      //   };
      // }

      // Current simple implementation - will be replaced by advanced processing
      const response = await this.generateSimpleWatchResponse(message);

      return {
        content: response.content,
        metadata: {
          processingTime: Date.now() - startTime,
          tokensUsed: Math.floor(Math.random() * 100) + 50, // Mock token usage
          model: 'simple-fallback-v1',
          temperature: 0.7,
        },
      };
    } catch (error) {
      this.logger.error('Failed to process message', error);
      return {
        content:
          "I apologize, but I'm having trouble right now. Please try asking about watches again!",
        metadata: {
          processingTime: Date.now() - startTime,
          tokensUsed: 0,
          model: 'error-handler',
          temperature: 0,
        },
      };
    }
  }

  // TODO: This method will be enhanced when RAG, KAG, and Context services are added
  private async buildMessageContext(
    message: string,
    chatId: string,
    userId: string,
  ): Promise<any> {
    const context: any = { currentMessage: message, timestamp: new Date() };

    // Get conversation context
    // if (this.contextService) {
    //   context.conversationContext =
    //     await this.contextService.buildConversationContext(chatId);
    //   context.shoppingContext =
    //     await this.contextService.extractShoppingContext(
    //       context.conversationContext,
    //     );
    //   context.relevantKnowledge =
    //     await this.contextService.getRelevantKnowledge(message);
    // }

    // Get RAG context
    context.ragContext = await this.ragService.retrieveRelevantContext(message);
    context.personalizedContext = await this.ragService.getPersonalizedContext(
      userId,
      message,
    );
    context.semanticResults = await this.ragService.semanticSearch(message);

    // Get KAG recommendations
    // if (this.kagService) {
    //   // Extract product mentions from message, then get recommendations
    //   const productMentions = this.extractProductMentions(message);
    //   if (productMentions.length > 0) {
    //     context.relatedProducts = await this.kagService.findRelatedProducts(
    //       productMentions[0],
    //     );
    //     context.recommendations =
    //       await this.kagService.getProductRecommendations(productMentions[0]);
    //   }
    // }

    return context;
  }

  private generateSimpleWatchResponse(message: string): {
    content: string;
    intent: string;
  } {
    const lowerMessage = message.toLowerCase();

    // Price-related queries
    if (
      lowerMessage.includes('price') ||
      lowerMessage.includes('cost') ||
      lowerMessage.includes('budget')
    ) {
      return {
        content:
          "I'd be happy to help you find watches within your budget! What's your preferred price range? We have options from $50 to $10,000+.",
        intent: 'price_inquiry',
      };
    }

    // Sports/fitness watches
    if (
      lowerMessage.includes('sport') ||
      lowerMessage.includes('fitness') ||
      lowerMessage.includes('running')
    ) {
      return {
        content:
          'Great choice! Sports watches are perfect for active lifestyles. Are you looking for heart rate monitoring, GPS tracking, or water resistance?',
        intent: 'sports_watch_search',
      };
    }

    // Luxury watches
    if (
      lowerMessage.includes('luxury') ||
      lowerMessage.includes('expensive') ||
      lowerMessage.includes('rolex')
    ) {
      return {
        content:
          'For luxury watches, we have amazing premium collections! Are you interested in Swiss brands, classic designs, or modern luxury?',
        intent: 'luxury_watch_search',
      };
    }

    // Smart watches
    if (
      lowerMessage.includes('smart') ||
      lowerMessage.includes('apple') ||
      lowerMessage.includes('digital')
    ) {
      return {
        content:
          'Smart watches are incredibly popular! Are you looking for health tracking, notifications, or specific apps?',
        intent: 'smart_watch_search',
      };
    }

    // Greeting/general
    if (
      lowerMessage.includes('hello') ||
      lowerMessage.includes('hi') ||
      lowerMessage.includes('help')
    ) {
      return {
        content:
          "Hello! I'm here to help you find the perfect watch! What type of watch interests you - sporty, elegant, smart, or casual?",
        intent: 'greeting',
      };
    }

    // Default response
    return {
      content:
        "I'm here to help you find the perfect watch! Could you tell me more about what you're looking for? Style, features, or price range?",
      intent: 'general_inquiry',
    };
  }

  private async createUserMessage(
    chatId: string,
    content: string,
  ): Promise<Message> {
    const chat = await this.chatRepository.findById(chatId);

    const messageData = {
      chatId,
      sessionId: chat!.sessionId,
      type: 'USER' as const,
      content,
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.messageRepository.create(messageData);
  }

  private async createAssistantMessage(
    chatId: string,
    content: string,
    metadata?: any,
  ): Promise<Message> {
    const chat = await this.chatRepository.findById(chatId);

    const messageData = {
      chatId,
      sessionId: chat!.sessionId,
      type: 'ASSISTANT' as const,
      content,
      metadata,
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.messageRepository.create(messageData);
  }

  private async createSystemMessage(
    chatId: string,
    content: string,
  ): Promise<Message> {
    const chat = await this.chatRepository.findById(chatId);

    const messageData = {
      chatId,
      sessionId: chat!.sessionId,
      type: 'SYSTEM' as const,
      content,
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.messageRepository.create(messageData);
  }

  private calculateAverageResponseTime(messages: Message[]): number {
    const responseTimes: number[] = [];

    for (let i = 0; i < messages.length - 1; i++) {
      const current = messages[i];
      const next = messages[i + 1];

      if (current.type === 'USER' && next.type === 'ASSISTANT') {
        const responseTime =
          next.timestamp.getTime() - current.timestamp.getTime();
        responseTimes.push(responseTime);
      }
    }

    return responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
      : 0;
  }

  private extractTopIntents(
    messages: Message[],
  ): { intent: string; count: number }[] {
    const intentCounts = new Map<string, number>();

    messages
      .filter((message) => message.intent)
      .forEach((message) => {
        const intent = message.intent!;
        intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
      });

    return Array.from(intentCounts.entries())
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
}
