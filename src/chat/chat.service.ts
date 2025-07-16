// src/chat/chat.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Chat } from './domain/chat';
import { Message } from './domain/message';
import { ChatRepository } from './infrastructure/persistence/chat.repository';
import { MessageRepository } from './infrastructure/persistence/message.repository';
import { UsersService } from '../users/users.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly chatRepository: ChatRepository,
    private readonly messageRepository: MessageRepository,
    private readonly usersService: UsersService,
  ) {}

  async createChat(userId: string, title?: string): Promise<Chat> {
    try {
      // Validate user exists
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new NotFoundException(`User not found: ${userId}`);
      }

      // Generate session ID and default title
      const sessionId = this.generateSessionId();
      const chatTitle = title || this.generateDefaultTitle(user);

      const chatData = {
        userId,
        sessionId,
        title: chatTitle,
        status: 'ACTIVE' as const,
        lastActivity: new Date(),
        metadata: {
          createdBy: {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            userEmail: user.email,
          },
          userRole: user.role?.name || 'user',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createdChat = await this.chatRepository.create(chatData);
      this.logger.log(`Chat created: ${createdChat.id} for user: ${userId}`);

      return createdChat;
    } catch (error) {
      this.logger.error(`Failed to create chat for user ${userId}:`, error);
      throw error;
    }
  }

  async sendMessage(chatId: string, content: string): Promise<Message> {
    try {
      // Validate chat exists and is active
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

      // Create message
      const messageData = {
        chatId,
        sessionId: chat.sessionId,
        type: 'USER' as const,
        content: content.trim(),
        timestamp: new Date(),
        metadata: {
          userAgent: 'web', // Could be extracted from request headers
          ipAddress: '127.0.0.1', // Could be extracted from request
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createdMessage = await this.messageRepository.create(messageData);

      // Update chat's last activity
      await this.chatRepository.update(chatId, { lastActivity: new Date() });

      this.logger.log(`Message sent in chat ${chatId}: ${createdMessage.id}`);

      return createdMessage;
    } catch (error) {
      this.logger.error(`Failed to send message in chat ${chatId}:`, error);
      throw error;
    }
  }

  async getChatHistory(chatId: string): Promise<Message[]> {
    try {
      // Validate chat exists
      const chat = await this.chatRepository.findById(chatId);
      if (!chat) {
        throw new NotFoundException(`Chat not found: ${chatId}`);
      }

      const messages = await this.messageRepository.findByChatId(chatId);
      this.logger.log(
        `Retrieved ${messages.length} messages for chat: ${chatId}`,
      );

      return messages;
    } catch (error) {
      this.logger.error(`Failed to get chat history for ${chatId}:`, error);
      throw error;
    }
  }

  async getActiveChats(userId: string): Promise<Chat[]> {
    try {
      // Validate user exists
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new NotFoundException(`User not found: ${userId}`);
      }

      const activeChats = await this.chatRepository.findActiveByUserId(userId);
      this.logger.log(
        `Retrieved ${activeChats.length} active chats for user: ${userId}`,
      );

      return activeChats;
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
      // Validate chat exists
      const chat = await this.chatRepository.findById(chatId);
      if (!chat) {
        throw new NotFoundException(`Chat not found: ${chatId}`);
      }

      if (chat.status === 'COMPLETED') {
        this.logger.warn(`Chat already completed: ${chatId}`);
        return chat;
      }

      const completedChat = await this.chatRepository.markAsCompleted(chatId);
      if (!completedChat) {
        throw new Error(`Failed to complete chat: ${chatId}`);
      }

      this.logger.log(`Chat completed: ${chatId}`);
      return completedChat;
    } catch (error) {
      this.logger.error(`Failed to end chat ${chatId}:`, error);
      throw error;
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    try {
      // Validate chat exists
      const chat = await this.chatRepository.findById(chatId);
      if (!chat) {
        throw new NotFoundException(`Chat not found: ${chatId}`);
      }

      // Delete the chat (this should cascade to messages in the hybrid repository)
      await this.chatRepository.remove(chatId);
      this.logger.log(`Chat deleted: ${chatId}`);
    } catch (error) {
      this.logger.error(`Failed to delete chat ${chatId}:`, error);
      throw error;
    }
  }

  async generateSuggestions(chatId: string): Promise<string[]> {
    try {
      // Validate chat exists
      const chat = await this.chatRepository.findById(chatId);
      if (!chat) {
        throw new NotFoundException(`Chat not found: ${chatId}`);
      }

      // Get recent messages for context
      const recentMessages = await this.messageRepository.findByChatId(chatId);
      const lastUserMessage = recentMessages
        .filter((msg) => msg.type === 'USER')
        .slice(-1)[0];

      // Generate contextual suggestions based on conversation
      const suggestions = await this.generateContextualSuggestions(
        chat,
        lastUserMessage,
        recentMessages,
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
      // Return fallback suggestions instead of throwing
      return this.getFallbackSuggestions();
    }
  }

  async getChatAnalytics(chatId: string): Promise<any> {
    try {
      // Validate chat exists
      const chat = await this.chatRepository.findById(chatId);
      if (!chat) {
        throw new NotFoundException(`Chat not found: ${chatId}`);
      }

      // Get all messages for analysis
      const messages = await this.messageRepository.findByChatId(chatId);

      // Calculate analytics
      const analytics = this.calculateChatAnalytics(chat, messages);

      this.logger.log(`Generated analytics for chat: ${chatId}`);
      return analytics;
    } catch (error) {
      this.logger.error(`Failed to get analytics for chat ${chatId}:`, error);
      throw error;
    }
  }

  // Helper methods
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `session_${timestamp}_${random}`;
  }

  private generateDefaultTitle(user: any): string {
    const firstName = user.firstName || 'User';
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `Chat with ${firstName} - ${timestamp}`;
  }

  private generateContextualSuggestions(
    chat: Chat,
    lastUserMessage?: Message,
    recentMessages: Message[] = [],
  ): string[] {
    const suggestions: string[] = [];

    // Analyze last user message for context
    if (lastUserMessage) {
      const content = lastUserMessage.content.toLowerCase();

      // Product-related suggestions
      if (
        content.includes('product') ||
        content.includes('item') ||
        content.includes('buy')
      ) {
        suggestions.push(
          'Can you tell me more about your budget range?',
          'What specific features are most important to you?',
          'Would you like to see our current promotions?',
        );
      }
      // Support-related suggestions
      else if (
        content.includes('help') ||
        content.includes('problem') ||
        content.includes('issue')
      ) {
        suggestions.push(
          'Can you describe the issue in more detail?',
          'Have you tried any troubleshooting steps?',
          'Would you like me to connect you with a specialist?',
        );
      }
      // General inquiry suggestions
      else {
        suggestions.push(
          'How can I help you today?',
          'Would you like product recommendations?',
          'Do you have any specific questions?',
        );
      }
    } else {
      // First message suggestions
      suggestions.push(
        'Welcome! How can I assist you today?',
        'Are you looking for something specific?',
        'Would you like to browse our categories?',
      );
    }

    // Add conversation flow suggestions based on message count
    const messageCount = recentMessages.length;
    if (messageCount > 5) {
      suggestions.push('Would you like a summary of our conversation?');
    }

    // Limit to 5 suggestions
    return suggestions.slice(0, 5);
  }

  private getFallbackSuggestions(): string[] {
    return [
      'How can I help you today?',
      'What are you looking for?',
      'Would you like some recommendations?',
      'Do you have any questions?',
      'Can I assist you with anything else?',
    ];
  }

  private calculateChatAnalytics(chat: Chat, messages: Message[]): any {
    const userMessages = messages.filter((msg) => msg.type === 'USER');
    const assistantMessages = messages.filter(
      (msg) => msg.type === 'ASSISTANT',
    );
    const systemMessages = messages.filter((msg) => msg.type === 'SYSTEM');

    // Calculate duration
    const startTime = chat.createdAt;
    const endTime =
      chat.status === 'COMPLETED'
        ? messages[messages.length - 1]?.timestamp || chat.updatedAt
        : new Date();
    const durationMinutes = Math.round(
      (endTime.getTime() - startTime.getTime()) / (1000 * 60),
    );

    // Calculate average message length
    const totalCharacters = userMessages.reduce(
      (sum, msg) => sum + msg.content.length,
      0,
    );
    const avgMessageLength =
      userMessages.length > 0
        ? Math.round(totalCharacters / userMessages.length)
        : 0;

    // Extract intents (if available)
    const intents = messages
      .map((msg) => msg.intent)
      .filter((intent): intent is string => Boolean(intent))
      .reduce(
        (acc, intent) => {
          acc[intent] = (acc[intent] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

    // Extract entities (if available)
    const entityTypes = messages
      .flatMap((msg) => msg.entities || [])
      .map((entity) => entity.type)
      .reduce(
        (acc, type) => {
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

    return {
      chatId: chat.id,
      chatInfo: {
        title: chat.title,
        status: chat.status,
        sessionId: chat.sessionId,
        userId: chat.userId,
        createdAt: chat.createdAt,
        lastActivity: chat.lastActivity,
        duration: {
          minutes: durationMinutes,
          formatted: `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`,
        },
      },
      messageStats: {
        total: messages.length,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        systemMessages: systemMessages.length,
        avgMessageLength,
        firstMessage: messages[0]?.timestamp || null,
        lastMessage: messages[messages.length - 1]?.timestamp || null,
      },
      conversationAnalysis: {
        intents: Object.keys(intents).length > 0 ? intents : null,
        entityTypes: Object.keys(entityTypes).length > 0 ? entityTypes : null,
        conversationHealth: this.assessConversationHealth(
          userMessages,
          assistantMessages,
        ),
      },
      generatedAt: new Date(),
    };
  }

  private assessConversationHealth(
    userMessages: Message[],
    assistantMessages: Message[],
  ): string {
    const userCount = userMessages.length;
    const assistantCount = assistantMessages.length;
    const ratio = assistantCount > 0 ? userCount / assistantCount : userCount;

    if (ratio < 0.5) {
      return 'assistant-heavy'; // Too many assistant messages
    } else if (ratio > 2) {
      return 'user-heavy'; // Too many user messages without responses
    } else {
      return 'balanced'; // Good conversation flow
    }
  }

  // Additional utility methods for extended functionality
  async getUserChatSummary(userId: string): Promise<any> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new NotFoundException(`User not found: ${userId}`);
      }

      const activeChats = await this.chatRepository.findActiveByUserId(userId);
      const userChats = await this.chatRepository.findByUserId(userId);
      const totalChats = userChats.length;
      const recentChats = userChats
        .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
        .slice(0, 5);

      return {
        userId,
        userName: `${user.firstName} ${user.lastName}`,
        userEmail: user.email,
        chatSummary: {
          totalChats,
          activeChats: activeChats.length,
          recentChats: recentChats.map((chat) => ({
            id: chat.id,
            title: chat.title,
            status: chat.status,
            lastActivity: chat.lastActivity,
            createdAt: chat.createdAt,
          })),
        },
        generatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user chat summary for ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async searchChats(userId: string, searchTerm: string): Promise<Chat[]> {
    try {
      // This would be enhanced with the hybrid repository's search capabilities
      const userChats = await this.chatRepository.findByUserId(userId);

      // Simple text search for now
      const filteredChats = userChats.filter((chat) =>
        chat.title.toLowerCase().includes(searchTerm.toLowerCase()),
      );

      this.logger.log(
        `Found ${filteredChats.length} chats matching "${searchTerm}" for user: ${userId}`,
      );
      return filteredChats;
    } catch (error) {
      this.logger.error(`Failed to search chats for user ${userId}:`, error);
      throw error;
    }
  }
}
