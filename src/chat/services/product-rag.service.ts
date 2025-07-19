import { Injectable, Logger } from '@nestjs/common';
import { MessageRepository } from '../infrastructure/persistence/message.repository';
import { Message, MessageContext, MessageMetadata } from '../domain/message';
import { AIService } from '../../ai/ai.service';

// Product-specific interfaces
export interface ProductContext extends MessageContext {
  productData?: {
    name?: string;
    brand?: string;
    category?: string;
    price?: number;
    features?: string[];
    specifications?: Record<string, any>;
  };
  metadata: MessageMetadata & {
    // Fixed: changed from MessageContextMetadata to MessageMetadata
    productId?: string;
    productEntities?: any[];
    userAction?:
      | 'viewed'
      | 'searched'
      | 'purchased'
      | 'compared'
      | 'recommended';
    priceRange?: { min: number; max: number };
    brandMentions?: string[];
    categoryMentions?: string[];
    featureMentions?: string[];
    productSimilarity?: number;
    userPreferenceMatch?: number;
    commercialIntent?: number;
    messageId: string;
    searchType?: string;
  };
}

export interface ProductSearchOptions {
  userId?: string;
  category?: string;
  brand?: string;
  priceRange?: { min: number; max: number };
  features?: string[];
  includeRecommendations?: boolean;
  includeSimilarProducts?: boolean;
  includeComparisons?: boolean;
  maxContexts?: number;
  minRelevanceScore?: number;
  searchStrategy?:
    | 'comprehensive'
    | 'focused'
    | 'recommendations'
    | 'comparisons';
}

export interface ProductSearchResult {
  query: string;
  contexts: ProductContext[];
  totalFound: number;
  processingTime: number;
  productInsights: {
    detectedProducts: string[];
    detectedBrands: string[];
    detectedCategories: string[];
    detectedPriceRange?: { min: number; max: number };
    commercialIntent: number;
    searchType:
      | 'product_search'
      | 'comparison'
      | 'recommendation'
      | 'price_inquiry'
      | 'general';
  };
  userPreferences?: {
    favoritebrands: string[];
    preferredCategories: string[];
    priceRange: { min?: number; max?: number };
    frequentFeatures: string[];
    purchaseHistory: string[];
  };
}

@Injectable()
export class ProductRagService {
  private readonly logger = new Logger(ProductRagService.name);

  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly aiService: AIService,
  ) {}

  // ===== MAIN PRODUCT RAG METHODS =====

  /**
   * Main product search method - comprehensive product context retrieval
   */
  async searchProductContext(
    query: string,
    options: ProductSearchOptions = {},
  ): Promise<ProductSearchResult> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Starting product search for: "${query.substring(0, 50)}..."`,
      );

      const {
        userId,
        maxContexts = 10,
        minRelevanceScore = 0.4,
        searchStrategy = 'comprehensive',
      } = options;
      console.log('🚀 ~ ProductRagService ~ options:', options);

      // 1. Analyze query for product intent and entities
      const productInsights = await this.analyzeProductQuery(query);
      console.log('🚀 ~ ProductRagService ~ productInsights:', productInsights);

      // 2. Get user preferences if available
      const userPreferences = userId
        ? await this.getUserProductPreferences(userId)
        : undefined;

      let allContexts: ProductContext[] = [];

      // 3. Execute search strategy
      switch (searchStrategy) {
        case 'comprehensive':
          allContexts = await this.executeComprehensiveSearch(
            query,
            productInsights,
            options,
          );
          break;
        case 'focused':
          allContexts = await this.executeFocusedSearch(
            query,
            productInsights,
            options,
          );
          break;
        case 'recommendations':
          allContexts = await this.executeRecommendationSearch(
            query,
            productInsights,
            options,
          );
          break;
        case 'comparisons':
          allContexts = await this.executeComparisonSearch(
            query,
            productInsights,
          );
          break;
      }

      // 4. Filter, deduplicate, and rank contexts
      const finalContexts = this.rankAndFilterContexts(
        allContexts,
        query,
        productInsights,
        userPreferences,
        maxContexts,
        minRelevanceScore,
      );

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Product search completed: ${finalContexts.length}/${allContexts.length} contexts in ${processingTime}ms`,
      );

      return {
        query,
        contexts: finalContexts,
        totalFound: allContexts.length,
        processingTime,
        productInsights,
        userPreferences,
      };
    } catch (error) {
      this.logger.error('Failed to search product context:', error);
      return this.getEmptySearchResult(query, Date.now() - startTime);
    }
  }

  /**
   * Generate product-focused augmented query
   */
  async generateProductAugmentedQuery(
    query: string,
    options: ProductSearchOptions = {},
  ): Promise<{
    augmentedQuery: string;
    contexts: ProductContext[];
    searchResult: ProductSearchResult;
  }> {
    try {
      this.logger.log(`Generating product-augmented query for: "${query}"`);

      // 1. Get product contexts
      const searchResult = await this.searchProductContext(query, options);

      // 2. Build product-specific augmented query
      const augmentedQuery = this.buildProductAugmentedQuery(
        query,
        searchResult,
      );

      return {
        augmentedQuery,
        contexts: searchResult.contexts,
        searchResult,
      };
    } catch (error) {
      this.logger.error('Failed to generate product-augmented query:', error);
      return {
        augmentedQuery: query,
        contexts: [],
        searchResult: this.getEmptySearchResult(query, 0),
      };
    }
  }

  /**
   * Store product interaction for future RAG
   */
  async storeProductInteraction(
    message: Message,
    userAction:
      | 'viewed'
      | 'searched'
      | 'purchased'
      | 'compared'
      | 'recommended' = 'searched',
  ): Promise<void> {
    try {
      this.logger.log(`Storing product interaction: ${message.id}`);

      // Extract product entities
      const entities = await this.aiService.extractEntities(message.content);
      const productEntities = entities.filter((e) =>
        ['PRODUCT', 'BRAND', 'CATEGORY', 'PRICE', 'FEATURE'].includes(e.type),
      );

      // Analyze commercial intent
      const commercialIntent = this.calculateCommercialIntent(message.content);

      // Create enhanced product metadata
      const productMetadata: MessageMetadata & any = {
        ...message.metadata,
        productInteraction: true,
        userAction,
        productEntities,
        commercialIntent,
        extractedProducts: productEntities.filter((e) => e.type === 'PRODUCT'),
        extractedBrands: productEntities.filter((e) => e.type === 'BRAND'),
        extractedCategories: productEntities.filter(
          (e) => e.type === 'CATEGORY',
        ),
        extractedPrices: productEntities.filter((e) => e.type === 'PRICE'),
        extractedFeatures: productEntities.filter((e) => e.type === 'FEATURE'),
        interactionTimestamp: new Date(),
        productScore: this.calculateProductRelevanceScore(message.content),
      };

      // Generate and store embedding
      if (!this.hasEmbedding(message.metadata || {})) {
        try {
          const embedding = await this.aiService.generateEmbedding(
            message.content,
          );
          productMetadata.embedding = embedding.vector;
          productMetadata.embeddingModel = embedding.model;
          productMetadata.embeddingDimensions = embedding.dimensions;
        } catch (embeddingError) {
          this.logger.warn(
            `Failed to generate embedding for message ${message.id}:`,
            embeddingError,
          );
        }
      }

      // Update message with product metadata
      await this.messageRepository.update(message.id, {
        metadata: productMetadata,
        entities: productEntities,
      });

      this.logger.log(`Product interaction stored successfully`);
    } catch (error) {
      this.logger.error(`Failed to store product interaction:`, error);
    }
  }

  // ===== PRODUCT SEARCH STRATEGIES =====

  private async executeComprehensiveSearch(
    query: string,
    insights: any,
    options: ProductSearchOptions,
  ): Promise<ProductContext[]> {
    const allContexts: ProductContext[] = [];

    try {
      // 1. Entity-based search
      const entityContexts = await this.searchByProductEntities(
        query,
        insights.detectedProducts,
        insights.detectedBrands,
        insights.detectedCategories,
      );
      allContexts.push(...entityContexts);

      // 2. Semantic similarity search
      const semanticContexts = await this.searchBySemanticSimilarity(
        query,
        options.maxContexts || 5,
      );
      allContexts.push(...semanticContexts);

      // 3. Product comparisons
      if (options.includeComparisons) {
        const comparisonContexts = await this.searchProductComparisons(
          query,
          insights,
        );
        allContexts.push(...comparisonContexts);
      }

      // 4. Product recommendations
      if (options.includeRecommendations && options.userId) {
        const recommendationContexts = await this.searchProductRecommendations(
          options.userId,
        );
        allContexts.push(...recommendationContexts);
      }

      // 5. Category-based search
      if (insights.detectedCategories.length > 0) {
        const categoryContexts = await this.searchByCategory(
          insights.detectedCategories,
        );
        allContexts.push(...categoryContexts);
      }
    } catch (error) {
      this.logger.error('Error in comprehensive search:', error);
    }

    return allContexts;
  }

  private async executeFocusedSearch(
    query: string,
    insights: any,
    options: ProductSearchOptions,
  ): Promise<ProductContext[]> {
    try {
      // Focus on the most relevant search method based on query type
      switch (insights.searchType) {
        case 'product_search':
          return await this.searchByProductEntities(
            query,
            insights.detectedProducts,
            insights.detectedBrands,
            insights.detectedCategories,
          );

        case 'comparison':
          return await this.searchProductComparisons(query, insights);

        case 'recommendation':
          if (options.userId) {
            return await this.searchProductRecommendations(options.userId);
          }
          return await this.searchBySemanticSimilarity(
            query,
            options.maxContexts || 5,
          );

        case 'price_inquiry':
          return await this.searchByPriceRange(
            query,
            insights.detectedPriceRange,
          );

        default:
          return await this.searchBySemanticSimilarity(
            query,
            options.maxContexts || 5,
          );
      }
    } catch (error) {
      this.logger.error('Error in focused search:', error);
      return [];
    }
  }

  private async executeRecommendationSearch(
    query: string,
    insights: any,
    options: ProductSearchOptions,
  ): Promise<ProductContext[]> {
    try {
      if (!options.userId) {
        return await this.searchBySemanticSimilarity(
          query,
          options.maxContexts || 5,
        );
      }

      const recommendationContexts = await this.searchProductRecommendations(
        options.userId,
      );
      const similarContexts = await this.searchSimilarProducts(query, insights);

      return [...recommendationContexts, ...similarContexts];
    } catch (error) {
      this.logger.error('Error in recommendation search:', error);
      return [];
    }
  }

  private async executeComparisonSearch(
    query: string,
    insights: any,
  ): Promise<ProductContext[]> {
    try {
      const comparisonContexts = await this.searchProductComparisons(
        query,
        insights,
      );
      console.log(comparisonContexts);
      const entityContexts = await this.searchByProductEntities(
        query,
        insights.detectedProducts,
        insights.detectedBrands,
        insights.detectedCategories,
      );

      return [...comparisonContexts, ...entityContexts];
    } catch (error) {
      this.logger.error('Error in comparison search:', error);
      return [];
    }
  }

  // ===== SPECIFIC SEARCH METHODS =====

  private async searchByProductEntities(
    query: string,
    products: string[],
    brands: string[],
    categories: string[],
  ): Promise<ProductContext[]> {
    try {
      const contexts: ProductContext[] = [];

      // Search by products
      for (const product of products) {
        const productMessages = await this.findMessagesByProductName(product);
        contexts.push(
          ...this.convertToProductContexts(productMessages, 'PRODUCT', {
            productName: product,
          }),
        );
      }

      // Search by brands
      for (const brand of brands) {
        const brandMessages = await this.findMessagesByBrand(brand);
        contexts.push(
          ...this.convertToProductContexts(brandMessages, 'BRAND', { brand }),
        );
      }

      // Search by categories
      for (const category of categories) {
        const categoryMessages = await this.findMessagesByCategory(category);
        contexts.push(
          ...this.convertToProductContexts(categoryMessages, 'CATEGORY', {
            category,
          }),
        );
      }

      return contexts;
    } catch (error) {
      this.logger.error('Failed to search by product entities:', error);
      return [];
    }
  }

  private async searchBySemanticSimilarity(
    query: string,
    limit: number,
  ): Promise<ProductContext[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.aiService.generateEmbedding(query);

      // Find similar product messages using vector similarity
      const similarMessages = await this.findSimilarProductMessagesByVector(
        queryEmbedding.vector,
        limit * 2,
      );

      return this.convertToProductContexts(similarMessages, 'PRODUCT', {
        searchMethod: 'semantic_similarity',
        embeddingModel: queryEmbedding.model,
      });
    } catch (error) {
      this.logger.error('Failed to search by semantic similarity:', error);
      return [];
    }
  }

  private async searchProductComparisons(
    query: string,
    insights: any,
  ): Promise<ProductContext[]> {
    try {
      // Look for comparison keywords
      const comparisonKeywords = [
        'vs',
        'versus',
        'compare',
        'comparison',
        'better',
        'difference',
        'which',
      ];
      const hasComparison = comparisonKeywords.some((keyword) =>
        query.toLowerCase().includes(keyword),
      );

      if (!hasComparison && insights.detectedProducts.length < 2) {
        return [];
      }

      // Find messages about product comparisons
      const comparisonMessages = await this.findComparisonMessages(
        insights.detectedProducts,
        insights.detectedBrands,
      );

      return this.convertToProductContexts(
        comparisonMessages,
        'PRICE_COMPARISON',
        {
          comparisonType: 'product_comparison',
          comparedProducts: insights.detectedProducts,
        },
      );
    } catch (error) {
      this.logger.error('Failed to search product comparisons:', error);
      return [];
    }
  }

  private async searchProductRecommendations(
    userId: string,
  ): Promise<ProductContext[]> {
    try {
      // Get user's product preferences
      const userPreferences = await this.getUserProductPreferences(userId);

      // Find recommendation-based messages
      const recommendationMessages =
        await this.findRecommendationMessages(userPreferences);

      return this.convertToProductContexts(
        recommendationMessages,
        'RECOMMENDATION',
        {
          recommendationType: 'personalized',
          basedOnPreferences: userPreferences,
        },
      );
    } catch (error) {
      this.logger.error('Failed to search product recommendations:', error);
      return [];
    }
  }

  private async searchSimilarProducts(
    query: string,
    insights: any,
  ): Promise<ProductContext[]> {
    try {
      const similarMessages = await this.findSimilarProductMessages(
        insights.detectedProducts,
        insights.detectedBrands,
        insights.detectedCategories,
      );

      return this.convertToProductContexts(similarMessages, 'SIMILAR_PRODUCT', {
        similarityBasis: 'product_features',
      });
    } catch (error) {
      this.logger.error('Failed to search similar products:', error);
      return [];
    }
  }

  private async searchByCategory(
    categories: string[],
  ): Promise<ProductContext[]> {
    try {
      const categoryMessages: Message[] = [];

      for (const category of categories) {
        const messages = await this.findMessagesByCategory(category);
        categoryMessages.push(...messages);
      }

      return this.convertToProductContexts(categoryMessages, 'CATEGORY', {
        categories,
        searchMethod: 'category_based',
      });
    } catch (error) {
      this.logger.error('Failed to search by category:', error);
      return [];
    }
  }

  private async searchByPriceRange(
    query: string,
    priceRange?: { min: number; max: number },
  ): Promise<ProductContext[]> {
    try {
      if (!priceRange) {
        return [];
      }

      const priceMessages = await this.findMessagesByPriceRange(priceRange);

      return this.convertToProductContexts(priceMessages, 'PRICE_COMPARISON', {
        priceRange,
        searchMethod: 'price_based',
      });
    } catch (error) {
      this.logger.error('Failed to search by price range:', error);
      return [];
    }
  }

  // ===== HELPER METHODS FOR FINDING MESSAGES =====

  private async findMessagesByProductName(
    productName: string,
  ): Promise<Message[]> {
    try {
      // Find by entity type first
      const entityMessages =
        await this.messageRepository.findByEntityType('PRODUCT');

      // Filter for specific product name
      return entityMessages.filter((message) => {
        const content = message.content.toLowerCase();
        const product = productName.toLowerCase();

        return (
          content.includes(product) ||
          (message.entities &&
            message.entities.some(
              (e) =>
                e.type === 'PRODUCT' && e.text.toLowerCase().includes(product),
            ))
        );
      });
    } catch (error) {
      this.logger.error(
        `Failed to find messages by product name ${productName}:`,
        error,
      );
      return [];
    }
  }

  private async findMessagesByBrand(brand: string): Promise<Message[]> {
    try {
      const entityMessages =
        await this.messageRepository.findByEntityType('BRAND');

      return entityMessages.filter((message) => {
        const content = message.content.toLowerCase();
        const brandLower = brand.toLowerCase();

        return (
          content.includes(brandLower) ||
          (message.entities &&
            message.entities.some(
              (e) =>
                e.type === 'BRAND' && e.text.toLowerCase().includes(brandLower),
            ))
        );
      });
    } catch (error) {
      this.logger.error(`Failed to find messages by brand ${brand}:`, error);
      return [];
    }
  }

  private async findMessagesByCategory(category: string): Promise<Message[]> {
    try {
      const entityMessages =
        await this.messageRepository.findByEntityType('CATEGORY');

      return entityMessages.filter((message) => {
        const content = message.content.toLowerCase();
        const categoryLower = category.toLowerCase();

        return (
          content.includes(categoryLower) ||
          (message.entities &&
            message.entities.some(
              (e) =>
                e.type === 'CATEGORY' &&
                e.text.toLowerCase().includes(categoryLower),
            ))
        );
      });
    } catch (error) {
      this.logger.error(
        `Failed to find messages by category ${category}:`,
        error,
      );
      return [];
    }
  }

  private async findComparisonMessages(
    products: string[],
    brands: string[],
  ): Promise<Message[]> {
    try {
      const comparisonIntentMessages =
        await this.messageRepository.findByIntent('COMPARISON');
      const allTerms = [...products, ...brands].map((term) =>
        term.toLowerCase(),
      );

      return comparisonIntentMessages.filter((message) => {
        const content = message.content.toLowerCase();
        const matchedTerms = allTerms.filter((term) => content.includes(term));
        return matchedTerms.length >= 2; // At least 2 terms for comparison
      });
    } catch (error) {
      this.logger.error('Failed to find comparison messages:', error);
      return [];
    }
  }

  private async findRecommendationMessages(
    userPreferences: any,
  ): Promise<Message[]> {
    try {
      const recommendationMessages =
        await this.messageRepository.findByIntent('RECOMMENDATION');

      return recommendationMessages.filter((message) => {
        const content = message.content.toLowerCase();

        // Check if message matches user preferences
        const matchesBrand = userPreferences.favoritebrands?.some((brand) =>
          content.includes(brand.toLowerCase()),
        );
        const matchesCategory = userPreferences.preferredCategories?.some(
          (cat) => content.includes(cat.toLowerCase()),
        );

        return (
          matchesBrand || matchesCategory || this.isProductRelated(content)
        );
      });
    } catch (error) {
      this.logger.error('Failed to find recommendation messages:', error);
      return [];
    }
  }

  private async findSimilarProductMessages(
    products: string[],
    brands: string[],
    categories: string[],
  ): Promise<Message[]> {
    try {
      const allTerms = [...products, ...brands, ...categories];
      const recentMessages = await this.messageRepository.findRecentByUserId(
        '',
        200,
      );

      return recentMessages.filter((message) => {
        const content = message.content.toLowerCase();
        return (
          allTerms.some((term) => content.includes(term.toLowerCase())) &&
          this.isProductRelated(content)
        );
      });
    } catch (error) {
      this.logger.error('Failed to find similar product messages:', error);
      return [];
    }
  }

  private async findMessagesByPriceRange(priceRange: {
    min: number;
    max: number;
  }): Promise<Message[]> {
    try {
      const priceMessages =
        await this.messageRepository.findByEntityType('PRICE');

      return priceMessages.filter((message) => {
        if (!message.entities) return false;

        return message.entities.some((entity) => {
          if (entity.type !== 'PRICE') return false;

          const priceText = entity.text.replace(/[$,]/g, '');
          const price = parseFloat(priceText);

          return (
            !isNaN(price) && price >= priceRange.min && price <= priceRange.max
          );
        });
      });
    } catch (error) {
      this.logger.error('Failed to find messages by price range:', error);
      return [];
    }
  }

  private async findSimilarProductMessagesByVector(
    queryVector: number[],
    limit: number,
  ): Promise<Message[]> {
    try {
      const recentMessages = await this.messageRepository.findRecentByUserId(
        '',
        500,
      );

      // Filter for product-related messages with embeddings
      const productMessagesWithEmbeddings = recentMessages.filter(
        (message) =>
          this.isProductRelated(message.content) &&
          this.hasEmbedding(message.metadata || {}),
      );

      // Calculate similarity scores
      const scoredMessages = productMessagesWithEmbeddings
        .map((message) => {
          const embedding = this.getEmbedding(message.metadata || {});
          const similarity = embedding
            ? this.calculateCosineSimilarity(queryVector, embedding)
            : 0;

          return { message, similarity };
        })
        .filter((item) => item.similarity > 0.6) // Higher threshold for product similarity
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map((item) => item.message);

      return scoredMessages;
    } catch (error) {
      this.logger.error(
        'Failed to find similar product messages by vector:',
        error,
      );
      return [];
    }
  }

  // ===== ANALYSIS AND UTILITY METHODS =====

  private async analyzeProductQuery(query: string): Promise<any> {
    try {
      // Extract entities
      const entities = this.aiService.extractEntities(query);

      // Classify intent
      const intentResult = await this.aiService.classifyIntent(query);

      // Extract product-specific information
      const detectedProducts = entities
        .filter((e) => e.type === 'PRODUCT')
        .map((e) => e.text);
      const detectedBrands = entities
        .filter((e) => e.type === 'BRAND')
        .map((e) => e.text);
      const detectedCategories = entities
        .filter((e) => e.type === 'CATEGORY')
        .map((e) => e.text);
      const detectedPrices = entities.filter((e) => e.type === 'PRICE');

      // Determine price range
      let detectedPriceRange;
      if (detectedPrices.length > 0) {
        const prices = detectedPrices
          .map((p) => parseFloat(p.text.replace(/[$,]/g, '')))
          .filter((p) => !isNaN(p));

        if (prices.length > 0) {
          detectedPriceRange = {
            min: Math.min(...prices),
            max: Math.max(...prices),
          };
        }
      }

      // Calculate commercial intent
      const commercialIntent = this.calculateCommercialIntent(query);

      // Determine search type
      const searchType = this.determineSearchType(
        query,
        intentResult.intent,
        entities,
      );

      return {
        detectedProducts,
        detectedBrands,
        detectedCategories,
        detectedPriceRange,
        commercialIntent,
        searchType,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
      };
    } catch (error) {
      this.logger.error('Failed to analyze product query:', error);
      return {
        detectedProducts: [],
        detectedBrands: [],
        detectedCategories: [],
        commercialIntent: 0,
        searchType: 'general',
        intent: 'OTHER',
        confidence: 0,
      };
    }
  }

  private determineSearchType(
    query: string,
    intent: string,
    entities: any[],
  ): string {
    const lowerQuery = query.toLowerCase();

    // Check for comparison keywords
    if (
      lowerQuery.includes('vs') ||
      lowerQuery.includes('compare') ||
      intent === 'COMPARISON'
    ) {
      return 'comparison';
    }

    // Check for recommendation keywords
    if (
      lowerQuery.includes('recommend') ||
      lowerQuery.includes('suggest') ||
      intent === 'RECOMMENDATION'
    ) {
      return 'recommendation';
    }

    // Check for price inquiry
    if (
      lowerQuery.includes('price') ||
      lowerQuery.includes('cost') ||
      intent === 'PRICE_INQUIRY'
    ) {
      return 'price_inquiry';
    }

    // Check for product search
    if (
      entities.some((e) => ['PRODUCT', 'BRAND', 'CATEGORY'].includes(e.type)) ||
      intent === 'PRODUCT_SEARCH'
    ) {
      return 'product_search';
    }

    return 'general';
  }

  private calculateCommercialIntent(content: string): number {
    const commercialKeywords = [
      'buy',
      'purchase',
      'order',
      'cart',
      'checkout',
      'payment',
      'price',
      'cost',
      'discount',
      'deal',
      'sale',
      'offer',
      'shipping',
      'delivery',
      'warranty',
      'return',
      'best',
      'top',
      'recommend',
      'review',
      'rating',
    ];

    const lowerContent = content.toLowerCase();
    const matches = commercialKeywords.filter((keyword) =>
      lowerContent.includes(keyword),
    );

    return Math.min(matches.length / commercialKeywords.length, 1.0);
  }

  private async getUserProductPreferences(userId: string): Promise<any> {
    try {
      const userMessages = await this.messageRepository.findRecentByUserId(
        userId,
        100,
      );
      const productMessages = userMessages.filter((m) =>
        this.isProductRelated(m.content),
      );

      const brands = new Set<string>();
      const categories = new Set<string>();
      const features = new Set<string>();
      const purchaseHistory = new Set<string>();

      for (const message of productMessages) {
        if (message.entities) {
          for (const entity of message.entities) {
            switch (entity.type) {
              case 'BRAND':
                brands.add(entity.text);
                break;
              case 'CATEGORY':
                categories.add(entity.text);
                break;
              case 'FEATURE':
                features.add(entity.text);
                break;
              case 'PRODUCT':
                if (message.metadata?.userAction === 'purchased') {
                  purchaseHistory.add(entity.text);
                }
                break;
            }
          }
        }
      }

      return {
        favoritebrands: Array.from(brands),
        preferredCategories: Array.from(categories),
        frequentFeatures: Array.from(features),
        purchaseHistory: Array.from(purchaseHistory),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user product preferences for ${userId}:`,
        error,
      );
      return {
        favoritebrands: [],
        preferredCategories: [],
        frequentFeatures: [],
        purchaseHistory: [],
      };
    }
  }

  private convertToProductContexts(
    messages: Message[],
    source: ProductContext['source'],
    additionalMetadata: any = {},
  ): ProductContext[] {
    return messages.map((message) => {
      const score = this.calculateProductRelevanceScore(message.content);

      return {
        source,
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
          productEntities:
            message.entities?.filter((e) =>
              ['PRODUCT', 'BRAND', 'CATEGORY', 'PRICE', 'FEATURE'].includes(
                e.type,
              ),
            ) || [],
          ...additionalMetadata,
        },
      };
    });
  }

  private rankAndFilterContexts(
    contexts: ProductContext[],
    query: string,
    insights: any,
    userPreferences?: any,
    maxContexts: number = 10,
    minScore: number = 0.4,
  ): ProductContext[] {
    try {
      // Remove duplicates
      const uniqueContexts = this.deduplicateProductContexts(contexts);

      // Calculate enhanced scores
      const scoredContexts = uniqueContexts.map((context) => {
        let enhancedScore = context.score;

        // Boost score based on user preferences
        if (userPreferences) {
          enhancedScore +=
            this.calculateUserPreferenceMatch(context, userPreferences) * 0.2;
        }

        // Boost score based on query insights
        if (insights.detectedProducts.length > 0) {
          const hasMatchingProduct = context.metadata.productEntities?.some(
            (entity) =>
              entity.type === 'PRODUCT' &&
              insights.detectedProducts.some((product) =>
                entity.text.toLowerCase().includes(product.toLowerCase()),
              ),
          );
          if (hasMatchingProduct) enhancedScore += 0.15;
        }

        // Boost for matching brands
        if (insights.detectedBrands.length > 0) {
          const hasMatchingBrand = context.metadata.productEntities?.some(
            (entity) =>
              entity.type === 'BRAND' &&
              insights.detectedBrands.some((brand) =>
                entity.text.toLowerCase().includes(brand.toLowerCase()),
              ),
          );
          if (hasMatchingBrand) enhancedScore += 0.1;
        }

        // Boost for commercial intent match
        enhancedScore +=
          (context.metadata.commercialIntent || 0) *
          insights.commercialIntent *
          0.1;

        return {
          ...context,
          score: Math.min(enhancedScore, 1.0),
        };
      });

      // Filter and sort
      return scoredContexts
        .filter((context) => context.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxContexts);
    } catch (error) {
      this.logger.error('Failed to rank and filter contexts:', error);
      return contexts.slice(0, maxContexts);
    }
  }

  private buildProductAugmentedQuery(
    query: string,
    searchResult: ProductSearchResult,
  ): string {
    try {
      if (searchResult.contexts.length === 0) {
        return query;
      }

      const { contexts, productInsights, userPreferences } = searchResult;

      // Build context sections
      const productContexts = contexts
        .filter(
          (ctx) => ctx.source === 'PRODUCT' || ctx.source === 'SIMILAR_PRODUCT',
        )
        .slice(0, 3);

      const recommendationContexts = contexts
        .filter((ctx) => ctx.source === 'RECOMMENDATION')
        .slice(0, 2);

      const comparisonContexts = contexts
        .filter((ctx) => ctx.source === 'PRICE_COMPARISON')
        .slice(0, 2);

      let augmentedQuery = `User Product Query: ${query}\n\n`;

      // Add product insights
      if (productInsights.detectedProducts.length > 0) {
        augmentedQuery += `Detected Products: ${productInsights.detectedProducts.join(', ')}\n`;
      }
      if (productInsights.detectedBrands.length > 0) {
        augmentedQuery += `Detected Brands: ${productInsights.detectedBrands.join(', ')}\n`;
      }
      if (productInsights.detectedCategories.length > 0) {
        augmentedQuery += `Detected Categories: ${productInsights.detectedCategories.join(', ')}\n`;
      }
      if (productInsights.detectedPriceRange) {
        augmentedQuery += `Price Range: ${productInsights.detectedPriceRange.min} - ${productInsights.detectedPriceRange.max}\n`;
      }
      augmentedQuery += `Search Type: ${productInsights.searchType}\n`;
      augmentedQuery += `Commercial Intent: ${(productInsights.commercialIntent * 100).toFixed(0)}%\n\n`;

      // Add user preferences if available
      if (userPreferences) {
        augmentedQuery += `User Preferences:\n`;
        if (userPreferences.favoritebrands?.length > 0) {
          augmentedQuery += `- Favorite Brands: ${userPreferences.favoritebrands.join(', ')}\n`;
        }
        if (userPreferences.preferredCategories?.length > 0) {
          augmentedQuery += `- Preferred Categories: ${userPreferences.preferredCategories.join(', ')}\n`;
        }
        if (userPreferences.purchaseHistory?.length > 0) {
          augmentedQuery += `- Previous Purchases: ${userPreferences.purchaseHistory.slice(0, 3).join(', ')}\n`;
        }
        augmentedQuery += '\n';
      }

      // Add product contexts
      if (productContexts.length > 0) {
        augmentedQuery += `Relevant Product Information:\n`;
        productContexts.forEach((ctx, index) => {
          const entities = ctx.metadata.productEntities || [];
          const entityInfo = entities
            .map((e) => `${e.type}: ${e.text}`)
            .join(', ');

          augmentedQuery += `[Product Context ${index + 1}] (Relevance: ${ctx.score.toFixed(2)})\n`;
          augmentedQuery += `Content: ${ctx.content}\n`;
          if (entityInfo) {
            augmentedQuery += `Entities: ${entityInfo}\n`;
          }
          augmentedQuery += '\n';
        });
      }

      // Add recommendations
      if (recommendationContexts.length > 0) {
        augmentedQuery += `Product Recommendations:\n`;
        recommendationContexts.forEach((ctx, index) => {
          augmentedQuery += `[Recommendation ${index + 1}] (Score: ${ctx.score.toFixed(2)})\n`;
          augmentedQuery += `${ctx.content}\n\n`;
        });
      }

      // Add comparisons
      if (comparisonContexts.length > 0) {
        augmentedQuery += `Product Comparisons:\n`;
        comparisonContexts.forEach((ctx, index) => {
          augmentedQuery += `[Comparison ${index + 1}] (Score: ${ctx.score.toFixed(2)})\n`;
          augmentedQuery += `${ctx.content}\n\n`;
        });
      }

      // Add instructions
      augmentedQuery += `Instructions for AI Assistant:
1. Use the product information above to provide contextual, relevant responses
2. Reference specific products, brands, and features mentioned in the context
3. Consider user preferences when making recommendations
4. Focus on the detected search type: ${productInsights.searchType}
5. Provide specific product details, comparisons, or recommendations as appropriate
6. If discussing prices, reference the detected price range when relevant
7. Maintain a helpful, sales-oriented tone while being informative

Please provide a comprehensive response based on this product context.`;

      return augmentedQuery;
    } catch (error) {
      this.logger.error('Failed to build product augmented query:', error);
      return query;
    }
  }

  // ===== UTILITY METHODS =====

  private calculateProductRelevanceScore(content: string): number {
    try {
      const productKeywords = [
        'product',
        'item',
        'buy',
        'purchase',
        'shop',
        'shopping',
        'price',
        'cost',
        'expensive',
        'cheap',
        'affordable',
        'budget',
        'feature',
        'specification',
        'specs',
        'quality',
        'brand',
        'recommend',
        'suggestion',
        'compare',
        'comparison',
        'vs',
        'available',
        'stock',
        'delivery',
        'shipping',
        'order',
        'review',
        'rating',
        'best',
        'top',
        'popular',
        'trending',
      ];

      const lowerContent = content.toLowerCase();
      const matches = productKeywords.filter((keyword) =>
        lowerContent.includes(keyword),
      );

      let score = matches.length / productKeywords.length;

      // Boost for price mentions - fixed regex pattern
      if (
        /\$\d+/i.test(content) ||
        /\d+\s*(dollar|usd|price|cost)/i.test(content)
      ) {
        score += 0.15;
      }

      // Boost for specific product mentions
      if (
        /\b(watch|phone|laptop|shoes|shirt|book|tablet|headphones|camera|speaker)\b/i.test(
          content,
        )
      ) {
        score += 0.1;
      }

      // Boost for comparison language
      if (
        /\b(vs|versus|compare|better|best|worse|prefer|alternative)\b/i.test(
          content,
        )
      ) {
        score += 0.1;
      }

      // Additional boost for shopping intent
      if (/\b(need|want|looking for|search|find|get|obtain)\b/i.test(content)) {
        score += 0.05;
      }

      // Boost for e-commerce specific terms
      if (/\b(discount|sale|offer|deal|coupon|promo)\b/i.test(content)) {
        score += 0.1;
      }

      return Math.min(score, 1.0);
    } catch (error) {
      this.logger.error('Failed to calculate product relevance score:', error);
      return 0;
    }
  }

  private calculateUserPreferenceMatch(
    context: ProductContext,
    userPreferences: any,
  ): number {
    let match = 0;
    const entities = context.metadata.productEntities || [];

    // Check brand preferences
    const brandEntities = entities.filter((e) => e.type === 'BRAND');
    const brandMatch = brandEntities.some((entity) =>
      userPreferences.favoritebrands?.some((brand) =>
        entity.text.toLowerCase().includes(brand.toLowerCase()),
      ),
    );
    if (brandMatch) match += 0.3;

    // Check category preferences
    const categoryEntities = entities.filter((e) => e.type === 'CATEGORY');
    const categoryMatch = categoryEntities.some((entity) =>
      userPreferences.preferredCategories?.some((category) =>
        entity.text.toLowerCase().includes(category.toLowerCase()),
      ),
    );
    if (categoryMatch) match += 0.2;

    // Check feature preferences
    const featureEntities = entities.filter((e) => e.type === 'FEATURE');
    const featureMatch = featureEntities.some((entity) =>
      userPreferences.frequentFeatures?.some((feature) =>
        entity.text.toLowerCase().includes(feature.toLowerCase()),
      ),
    );
    if (featureMatch) match += 0.1;

    return match;
  }

  private deduplicateProductContexts(
    contexts: ProductContext[],
  ): ProductContext[] {
    const seen = new Map<string, ProductContext>();

    for (const context of contexts) {
      const key =
        context.metadata?.messageId || context.content.substring(0, 100);
      const existing = seen.get(key);

      if (!existing || context.score > existing.score) {
        seen.set(key, context);
      }
    }

    return Array.from(seen.values());
  }

  private isProductRelated(content: string): boolean {
    const productIndicators = [
      'product',
      'buy',
      'purchase',
      'shop',
      'price',
      'cost',
      'recommend',
      'feature',
      'brand',
      'quality',
      'compare',
      'available',
      'stock',
      'order',
      'shipping',
      'delivery',
      'dollar',
      'expensive',
      'cheap',
      'affordable',
      'watch',
      'phone',
      'laptop',
      'shoes',
      'clothing',
      'book',
      'electronics',
      'furniture',
      'appliance',
      'gadget',
    ];

    const contentLower = content.toLowerCase();
    return productIndicators.some((indicator) =>
      contentLower.includes(indicator),
    );
  }

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

  private getEmptySearchResult(
    query: string,
    processingTime: number,
  ): ProductSearchResult {
    return {
      query,
      contexts: [],
      totalFound: 0,
      processingTime,
      productInsights: {
        detectedProducts: [],
        detectedBrands: [],
        detectedCategories: [],
        commercialIntent: 0,
        searchType: 'general',
      },
    };
  }

  // ===== PRODUCT ANALYTICS METHODS =====

  async getProductAnalytics(userId?: string): Promise<{
    totalProductQueries: number;
    topProducts: Array<{ name: string; mentions: number }>;
    topBrands: Array<{ name: string; count: number }>;
    topCategories: Array<{ name: string; count: number }>;
    averageCommercialIntent: number;
    searchTypeDistribution: Record<string, number>;
    userEngagement: {
      avgQueriesPerSession: number;
      avgResponseTime: number;
      conversionIndicators: number;
    };
  }> {
    try {
      const messages = userId
        ? await this.messageRepository.findRecentByUserId(userId, 500)
        : await this.messageRepository.findRecentByUserId('', 1000);

      const productMessages = messages.filter((m) =>
        this.isProductRelated(m.content),
      );

      // Analyze entities
      const products = new Map<string, number>();
      const brands = new Map<string, number>();
      const categories = new Map<string, number>();
      let totalCommercialIntent = 0;
      const searchTypes = new Map<string, number>();

      for (const message of productMessages) {
        // Count commercial intent
        totalCommercialIntent += this.calculateCommercialIntent(
          message.content,
        );

        // Count search types

        // Count entities
        if (message.entities) {
          for (const entity of message.entities) {
            switch (entity.type) {
              case 'PRODUCT':
                products.set(entity.text, (products.get(entity.text) || 0) + 1);
                break;
              case 'BRAND':
                brands.set(entity.text, (brands.get(entity.text) || 0) + 1);
                break;
              case 'CATEGORY':
                categories.set(
                  entity.text,
                  (categories.get(entity.text) || 0) + 1,
                );
                break;
            }
          }
        }
      }

      // Calculate engagement metrics
      const sessionIds = new Set(productMessages.map((m) => m.sessionId));
      const avgQueriesPerSession =
        sessionIds.size > 0 ? productMessages.length / sessionIds.size : 0;

      const responseTimes = productMessages
        .map((m) => m.metadata?.processingTime || 0)
        .filter((time) => time > 0);
      const avgResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;

      const conversionIndicators = productMessages.filter(
        (m) =>
          m.content.toLowerCase().includes('buy') ||
          m.content.toLowerCase().includes('purchase'),
      ).length;

      return {
        totalProductQueries: productMessages.length,
        topProducts: Array.from(products.entries())
          .map(([name, mentions]) => ({ name, mentions }))
          .sort((a, b) => b.mentions - a.mentions)
          .slice(0, 10),
        topBrands: Array.from(brands.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        topCategories: Array.from(categories.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        averageCommercialIntent:
          productMessages.length > 0
            ? totalCommercialIntent / productMessages.length
            : 0,
        searchTypeDistribution: Object.fromEntries(searchTypes),
        userEngagement: {
          avgQueriesPerSession,
          avgResponseTime,
          conversionIndicators,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get product analytics:', error);
      return {
        totalProductQueries: 0,
        topProducts: [],
        topBrands: [],
        topCategories: [],
        averageCommercialIntent: 0,
        searchTypeDistribution: {},
        userEngagement: {
          avgQueriesPerSession: 0,
          avgResponseTime: 0,
          conversionIndicators: 0,
        },
      };
    }
  }

  /**
   * Clean up old product interactions to maintain performance
   */
  cleanupOldProductInteractions(daysToKeep: number = 30): void {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // This would typically involve database cleanup operations
      // Implementation depends on your database structure

      this.logger.log(
        `Cleanup completed for product interactions older than ${daysToKeep} days`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup old product interactions:', error);
    }
  }
}
