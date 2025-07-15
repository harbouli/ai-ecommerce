import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { ProductRecommendationDto } from './dto/product-recommendation.dto';
import { KnowledgeGraphService } from './infrastructure/services/knowledge-graph.service';
import { Neo4jGraphService } from './infrastructure/services/neo4j-graph.service';
import { ChatSession } from './domain/chat-session';
import { Message } from './domain/message';
import { ChatRepository } from './infrastructure/persistence/chat.repository';

export interface PaginationOptions {
  page: number;
  limit: number;
}

@Injectable()
export class ChatBootService {
  private readonly logger = new Logger(ChatBootService.name);

  constructor(
    private readonly knowledgeGraphService: KnowledgeGraphService,
    private readonly neo4jGraphService: Neo4jGraphService,
    private readonly chatRepository: ChatRepository,
  ) {}

  async create(
    createChatDto: CreateChatDto & { userId: string },
  ): Promise<ChatResponseDto> {
    this.logger.log(
      `Creating new chat session for user: ${createChatDto.userId}`,
    );

    const chatSession = new ChatSession({
      title: createChatDto.title || 'New Chat',
      userId: createChatDto.userId,
      context: createChatDto.context,
      isActive: true,
    });

    const createdChat = await this.chatRepository.create(chatSession);

    this.logger.log(`Chat session created with ID: ${createdChat.id}`);
    return this.mapToResponseDto(createdChat);
  }

  async findAllByUser(
    userId: string,
    paginationOptions: PaginationOptions,
  ): Promise<ChatResponseDto[]> {
    this.logger.log(`Finding all chat sessions for user: ${userId}`);

    const chats = await this.chatRepository.findByUserId(
      userId,
      paginationOptions,
    );
    return chats.map((chat) => this.mapToResponseDto(chat));
  }

  async findOneByUser(id: string, userId: string): Promise<ChatResponseDto> {
    this.logger.log(`Finding chat session: ${id} for user: ${userId}`);

    const chat = await this.chatRepository.findById(id);

    if (!chat) {
      throw new NotFoundException(`Chat session with ID ${id} not found`);
    }

    if (chat.userId !== userId) {
      throw new ForbiddenException('Access denied to this chat session');
    }

    return this.mapToResponseDto(chat);
  }

  async update(
    id: string,
    updateChatDto: UpdateChatDto,
    userId: string,
  ): Promise<ChatResponseDto> {
    this.logger.log(`Updating chat session: ${id}`);

    const existingChat = await this.findOneByUser(id, userId);

    const updatedChat = await this.chatRepository.update(id, {
      title: updateChatDto.title ?? existingChat.title,
      context: updateChatDto.context ?? existingChat.context,
      updatedAt: new Date(),
    });

    return this.mapToResponseDto(updatedChat);
  }

  async remove(id: string, userId: string): Promise<void> {
    this.logger.log(`Removing chat session: ${id}`);

    await this.findOneByUser(id, userId); // Verify ownership
    await this.chatRepository.delete(id);

    this.logger.log(`Chat session ${id} deleted successfully`);
  }

  async sendMessage(
    chatId: string,
    sendMessageDto: SendMessageDto,
    userId: string,
  ): Promise<MessageResponseDto> {
    this.logger.log(`Sending message to chat: ${chatId}`);

    // Verify chat ownership
    await this.findOneByUser(chatId, userId);

    // Create user message
    const userMessage = new Message({
      chatId,
      content: sendMessageDto.message,
      role: 'user',
      metadata: sendMessageDto.metadata,
    });

    const savedUserMessage = await this.chatRepository.addMessage(userMessage);

    try {
      // Generate AI response using knowledge graph
      const aiResponse = await this.generateAiResponse(
        sendMessageDto.message,
        chatId,
        userId,
      );

      // Create AI message
      const aiMessage = new Message({
        chatId,
        content: aiResponse.content,
        role: 'assistant',
        metadata: {
          model: aiResponse.model,
          reasoning: aiResponse.reasoning,
          productRecommendations: aiResponse.productRecommendations,
          confidence: aiResponse.confidence,
        },
      });

      const savedAiMessage = await this.chatRepository.addMessage(aiMessage);

      // Update chat's last activity
      await this.chatRepository.updateLastActivity(chatId);

      return {
        userMessage: this.mapMessageToResponseDto(savedUserMessage),
        aiMessage: this.mapMessageToResponseDto(savedAiMessage),
        productRecommendations: aiResponse.productRecommendations || [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate AI response: ${error.message}`,
        error,
      );

      // Create error response
      const errorMessage = new Message({
        chatId,
        content:
          'I apologize, but I encountered an error processing your request. Please try again.',
        role: 'assistant',
        metadata: { error: true, errorMessage: error.message },
      });

      const savedErrorMessage =
        await this.chatRepository.addMessage(errorMessage);

      return {
        userMessage: this.mapMessageToResponseDto(savedUserMessage),
        aiMessage: this.mapMessageToResponseDto(savedErrorMessage),
        productRecommendations: [],
      };
    }
  }

  async getChatMessages(
    chatId: string,
    userId: string,
    paginationOptions: PaginationOptions,
  ): Promise<MessageResponseDto[]> {
    this.logger.log(`Getting messages for chat: ${chatId}`);

    // Verify chat ownership
    await this.findOneByUser(chatId, userId);

    const messages = await this.chatRepository.getMessages(
      chatId,
      paginationOptions,
    );
    return messages.map((message) => this.mapMessageToResponseDto(message));
  }

  async getPersonalizedRecommendations(
    userId: string,
    context?: string,
    limit: number = 10,
  ): Promise<ProductRecommendationDto[]> {
    this.logger.log(`Getting personalized recommendations for user: ${userId}`);

    try {
      // Get user's chat history to understand preferences
      const recentChats = await this.chatRepository.findByUserId(userId, {
        page: 1,
        limit: 5,
      });

      // Extract user preferences from chat history
      const userContext = await this.extractUserPreferences(
        recentChats,
        context,
      );

      // Get recommendations from knowledge graph
      const recommendations =
        await this.knowledgeGraphService.getCustomerRecommendations(
          userId,
          limit,
        );

      return recommendations.map((rec) => ({
        productId: rec.product.id,
        productName: rec.product.name,
        description: rec.product.description,
        price: rec.product.price,
        imageUrl: rec.product.imageUrl,
        categoryName: rec.product.categoryName,
        brandName: rec.product.brandName,
        confidence: rec.similarityScore,
        reasoning: `Recommended based on your preferences and browsing history`,
        features: rec.product.features || [],
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get recommendations: ${error.message}`,
        error,
      );
      return [];
    }
  }

  async semanticSearch(
    query: string,
    userId: string,
    limit: number = 10,
    threshold: number = 0.7,
  ): Promise<ProductRecommendationDto[]> {
    this.logger.log(`Performing semantic search for: "${query}"`);

    try {
      // Use knowledge graph for semantic search
      const searchResults =
        await this.knowledgeGraphService.semanticProductSearch(
          query,
          limit,
          threshold,
        );

      return searchResults.map((result) => ({
        productId: result.product.id,
        productName: result.product.name,
        description: result.product.description,
        price: result.product.price,
        imageUrl: result.product.imageUrl,
        categoryName: result.product.categoryName,
        brandName: result.product.brandName,
        confidence: result.relevanceScore,
        reasoning: `Found through AI semantic search for "${query}"`,
        features: result.product.features || [],
      }));
    } catch (error) {
      this.logger.error(`Semantic search failed: ${error.message}`, error);
      return [];
    }
  }

  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    services: {
      neo4j: boolean;
      mistralAi: boolean;
      vectorStore: boolean;
    };
  }> {
    this.logger.log('Performing health check');

    const healthStatus = await this.knowledgeGraphService.healthCheck();

    return {
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      services: healthStatus.services,
    };
  }

  private async generateAiResponse(
    userMessage: string,
    chatId: string,
    userId: string,
  ): Promise<{
    content: string;
    model: string;
    reasoning: string;
    productRecommendations?: ProductRecommendationDto[];
    confidence: number;
  }> {
    // Get chat history for context
    const chatHistory = await this.chatRepository.getMessages(chatId, {
      page: 1,
      limit: 10,
    });

    // Build context from chat history
    const conversationContext = chatHistory
      .slice(-10) // Last 10 messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Determine if user is asking for product recommendations
    const isProductQuery = this.isProductRelatedQuery(userMessage);

    let productRecommendations: ProductRecommendationDto[] = [];

    if (isProductQuery) {
      // Get product recommendations
      productRecommendations = await this.semanticSearch(
        userMessage,
        userId,
        5,
        0.6,
      );
    }

    // Generate AI response using knowledge graph and context
    const aiResponse =
      await this.knowledgeGraphService.generateConversationalResponse(
        userMessage,
        conversationContext,
        productRecommendations,
      );

    return {
      content: aiResponse.message,
      model: 'mistral-ai-knowledge-graph',
      reasoning: aiResponse.reasoning,
      productRecommendations,
      confidence: aiResponse.confidence,
    };
  }

  private isProductRelatedQuery(message: string): boolean {
    const productKeywords = [
      'recommend',
      'suggestion',
      'product',
      'buy',
      'purchase',
      'looking for',
      'need',
      'want',
      'shopping',
      'price',
      'compare',
      'best',
      'similar',
      'alternative',
      'brand',
      'category',
      'feature',
      'specification',
    ];

    const lowerMessage = message.toLowerCase();
    return productKeywords.some((keyword) => lowerMessage.includes(keyword));
  }

  private extractUserPreferences(
    recentChats: ChatSession[],
    additionalContext?: string,
  ): Promise<string> {
    // Extract preferences from chat history
    const chatContents = recentChats
      .flatMap((chat) => chat.messages || [])
      .filter((msg) => msg.role === 'user')
      .map((msg) => msg.content)
      .join(' ');

    const context = [chatContents, additionalContext].filter(Boolean).join(' ');

    return context || 'General user preferences';
  }

  private mapToResponseDto(chatSession: ChatSession): ChatResponseDto {
    return {
      id: chatSession.id,
      title: chatSession.title,
      userId: chatSession.userId,
      context: chatSession.context,
      isActive: chatSession.isActive,
      messageCount: chatSession.messages?.length || 0,
      createdAt: chatSession.createdAt,
      updatedAt: chatSession.updatedAt,
      lastActivity: chatSession.lastActivity,
    };
  }

  private mapMessageToResponseDto(message: Message): MessageResponseDto {
    return {
      id: message.id,
      chatId: message.chatId,
      content: message.content,
      role: message.role,
      metadata: message.metadata,
      createdAt: message.createdAt,
    };
  }
}
