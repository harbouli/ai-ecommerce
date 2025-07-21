import { Message, MessageContext } from '../domain/message';

/**
 * RAG (Retrieval-Augmented Generation) Service Interface
 *
 * This service handles context retrieval, semantic search, and conversation enhancement
 * for the shopping assistant chatbot using vector embeddings and similarity matching.
 */
export interface IRagService {
  // ===== CORE RAG METHODS =====

  /**
   * Find similar conversations/products based on semantic similarity
   * @param query - User query or search term
   * @param limit - Maximum number of results to return (default: 10)
   * @param threshold - Minimum similarity score (0-1, default: 0.7)
   * @returns Array of relevant message contexts
   */
  retrieveRelevantContext(
    query: string,
    limit?: number,
    threshold?: number,
  ): Promise<MessageContext[]>;

  /**
   * Enhance query with contextual information from retrieved data
   * @param query - Original user query
   * @param context - Retrieved contextual information
   * @returns Enhanced query with additional context
   */
  augmentQueryWithContext(
    query: string,
    context: MessageContext[],
  ): Promise<string>;

  /**
   * Store conversation context for future retrieval
   * @param message - Message to store in vector database
   * @returns Promise that resolves when storage is complete
   */
  storeConversationContext(message: Message): Promise<void>;

  /**
   * Vector-based product search using semantic similarity
   * @param query - Search query for products
   * @param limit - Maximum number of results (default: 20)
   * @param filters - Optional filters (category, brand, price range, etc.)
   * @returns Array of relevant product contexts
   */
  semanticSearch(
    query: string,
    limit?: number,
    filters?: ProductSearchFilters,
  ): Promise<MessageContext[]>;

  /**
   * Get user-specific context based on history and preferences
   * @param userId - User identifier
   * @param query - Current query
   * @param limit - Maximum number of personalized results (default: 15)
   * @returns User-specific contextual information
   */
  getPersonalizedContext(
    userId: string,
    query: string,
    limit?: number,
  ): Promise<MessageContext[]>;

  // ===== CONVERSATION ANALYSIS =====

  /**
   * Find similar conversations based on intent and content
   * @param query - Search query
   * @param limit - Maximum number of similar conversations
   * @param userId - Optional user filter
   * @returns Array of similar conversation messages
   */
  findSimilarConversations(
    query: string,
    limit?: number,
    userId?: string,
  ): Promise<Message[]>;

  /**
   * Analyze conversation patterns for insights
   * @param chatId - Chat identifier
   * @returns Conversation analysis with patterns and insights
   */
  analyzeConversationPatterns(chatId: string): Promise<ConversationInsights>;

  /**
   * Get conversation summary using RAG context
   * @param messages - Array of messages to summarize
   * @param maxLength - Maximum summary length
   * @returns Contextual summary of the conversation
   */
  generateConversationSummary(
    messages: Message[],
    maxLength?: number,
  ): Promise<string>;

  // ===== PRODUCT & SHOPPING CONTEXT =====

  /**
   * Retrieve product information context
   * @param productQuery - Product search or mention
   * @param context - Additional context (user preferences, chat history)
   * @returns Product-related contextual information
   */
  getProductContext(
    productQuery: string,
    context?: UserShoppingContext,
  ): Promise<MessageContext[]>;

  /**
   * Find products mentioned in conversation history
   * @param chatId - Chat identifier
   * @returns Array of product mentions with context
   */
  extractProductMentions(chatId: string): Promise<ProductMention[]>;

  /**
   * Get price comparison context for products
   * @param productName - Product to compare
   * @param limit - Maximum number of comparisons
   * @returns Price comparison data
   */
  getPriceComparisonContext(
    productName: string,
    limit?: number,
  ): Promise<MessageContext[]>;

  // ===== CONTEXTUAL RECOMMENDATIONS =====

  /**
   * Generate recommendations based on conversation context
   * @param userId - User identifier
   * @param conversationContext - Current conversation context
   * @param limit - Maximum number of recommendations
   * @returns Contextual product recommendations
   */
  getContextualRecommendations(
    userId: string,
    conversationContext: ConversationContext,
    limit?: number,
  ): Promise<ProductRecommendation[]>;

  /**
   * Find trending products based on recent conversations
   * @param timeframe - Time period to analyze (e.g., 'week', 'month')
   * @param category - Optional category filter
   * @param limit - Maximum number of trending items
   * @returns Trending product contexts
   */
  getTrendingProducts(
    timeframe: string,
    category?: string,
    limit?: number,
  ): Promise<MessageContext[]>;

  // ===== VECTOR OPERATIONS =====

  /**
   * Generate embeddings for text content
   * @param text - Text to embed
   * @param textType - Type of content ('query', 'product', 'conversation')
   * @returns Vector embedding
   */
  generateEmbedding(text: string, textType?: EmbeddingType): Promise<number[]>;

  /**
   * Calculate similarity between two text pieces
   * @param text1 - First text
   * @param text2 - Second text
   * @returns Similarity score (0-1)
   */
  calculateSimilarity(text1: string, text2: string): Promise<number>;

  /**
   * Update stored embeddings for a message
   * @param messageId - Message identifier
   * @param newContent - Updated content
   * @returns Promise that resolves when update is complete
   */
  updateMessageEmbedding(messageId: string, newContent: string): Promise<void>;

  // ===== CONTEXT MANAGEMENT =====

  /**
   * Clear outdated context data
   * @param olderThan - Date threshold for cleanup
   * @param userId - Optional user filter
   * @returns Number of cleaned up records
   */
  cleanupOldContext(olderThan: Date, userId?: string): Promise<number>;

  /**
   * Get context statistics for monitoring
   * @param userId - Optional user filter
   * @returns Context usage and performance metrics
   */
  getContextStats(userId?: string): Promise<ContextStatistics>;

  /**
   * Rebuild vector index for improved performance
   * @param batchSize - Number of records to process at once
   * @returns Promise that resolves when rebuild is complete
   */
  rebuildVectorIndex(batchSize?: number): Promise<void>;
}

// ===== SUPPORTING INTERFACES =====

export interface ProductSearchFilters {
  category?: string;
  brand?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  features?: string[];
  rating?: number;
  availability?: boolean;
}

export interface ConversationInsights {
  totalMessages: number;
  averageSentiment: number;
  topTopics: TopicScore[];
  userIntent: string;
  conversionLikelihood: number;
  recommendedActions: string[];
  keyEntities: EntityMention[];
}

export interface TopicScore {
  topic: string;
  score: number;
  mentions: number;
}

export interface EntityMention {
  text: string;
  type: string;
  confidence: number;
  context: string;
}

export interface UserShoppingContext {
  userId: string;
  preferences?: UserPreferences;
  shoppingHistory?: PurchaseHistory[];
  currentSession?: ConversationContext;
  demographics?: UserDemographics;
}

export interface UserPreferences {
  categories: string[];
  brands: string[];
  priceRange: {
    min: number;
    max: number;
  };
  features: string[];
  style: string;
}

export interface PurchaseHistory {
  productId: string;
  productName: string;
  category: string;
  brand: string;
  price: number;
  purchaseDate: Date;
  rating?: number;
}

export interface ConversationContext {
  chatId: string;
  sessionId: string;
  currentIntent: string;
  extractedEntities: EntityMention[];
  messageHistory: Message[];
  userProfile?: UserShoppingContext;
}

export interface ProductMention {
  productId?: string;
  productName: string;
  category?: string;
  brand?: string;
  mentionCount: number;
  context: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export interface ProductRecommendation {
  productId: string;
  productName: string;
  category: string;
  brand: string;
  price: number;
  rating: number;
  reason: string;
  confidence: number;
  similarityScore: number;
  contextRelevance: number;
}

export interface ContextStatistics {
  totalDocuments: number;
  totalVectors: number;
  averageQueryTime: number;
  storageSize: number;
  lastUpdated: Date;
  userQueries: number;
  successRate: number;
}

export type EmbeddingType =
  | 'query'
  | 'product'
  | 'conversation'
  | 'knowledge'
  | 'review';

export interface UserDemographics {
  ageRange?: string;
  location?: string;
  gender?: string;
  occupation?: string;
  interests?: string[];
}
