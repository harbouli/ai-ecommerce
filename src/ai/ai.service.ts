import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AllConfigType } from '../config/config.type';
import { ConfigService } from '@nestjs/config';

// Import domain entities
import { IntentClassification } from './domain/intent-classification';
import { ExtractedEntity } from './domain/extracted-entity';
import { ShoppingResponse } from './domain/shopping-response';
import { OllamaRequest, OllamaRequestOptions, OllamaResponse } from './domain';
import {
  ProductContext,
  QueryAnalysisWithProducts,
} from './domain/product-context';

// Import product services for semantic search
import { ProductsService } from '../products/products.service';
import { Product } from '../products/domain/product';

@Injectable()
export class AIService implements OnModuleInit {
  private readonly logger = new Logger(AIService.name);
  private readonly ollamaBaseUrl: string;
  private readonly ollamaModel: string;
  private conversationContext: number[] = [];
  private isOllamaAvailable = false;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly httpService: HttpService,
    private readonly productsService: ProductsService, // Inject product service
  ) {
    this.ollamaBaseUrl = this.configService.getOrThrow('app.ollama.baseUrl', {
      infer: true,
    });
    this.ollamaModel = this.configService.getOrThrow('app.ollama.chatModel', {
      infer: true,
    });
  }

  async onModuleInit() {
    await this.checkOllamaHealth();
  }

  /**
   * Check if Ollama is available and the model is loaded
   */
  private async checkOllamaHealth(): Promise<void> {
    try {
      this.logger.log('Checking Ollama availability...');

      const response = await firstValueFrom(
        this.httpService.get(`${this.ollamaBaseUrl}/api/tags`),
      );

      if (response.status === 200) {
        const models = response.data.models || [];
        const modelExists = models.some((model: any) =>
          model.name.includes(this.ollamaModel),
        );

        if (modelExists) {
          this.isOllamaAvailable = true;
          this.logger.log(
            `✅ Ollama is available with model: ${this.ollamaModel}`,
          );
        } else {
          this.logger.warn(
            `⚠️ Model ${this.ollamaModel} not found. Available models: ${models.map((m: any) => m.name).join(', ')}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('❌ Ollama not available:', error.message);
      this.isOllamaAvailable = false;
    }
  }

  /**
   * Main query analysis method with product context retrieval
   * @param query User's text query
   * @returns Complete analysis with intent, entities, and relevant products
   */
  async analyzeQuery(query: string): Promise<QueryAnalysisWithProducts> {
    const startTime = Date.now();

    try {
      this.logger.log(`Analyzing query: ${query.substring(0, 100)}...`);

      // Run analysis in parallel with product search
      const [intent, entities, productContext] = await Promise.all([
        this.classifyIntent(query),
        this.extractEntities(query),
        this.getProductContext(query), // New method to get relevant products
      ]);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Query analyzed in ${processingTime}ms - Intent: ${intent.intent} (${intent.confidence}), Entities: ${entities.length}, Products: ${productContext.products.length}`,
      );

      const analysis = new QueryAnalysisWithProducts(
        intent,
        entities,
        processingTime,
        productContext,
      );

      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing query:', error);

      return new QueryAnalysisWithProducts(
        new IntentClassification(
          'OTHER',
          0.3,
          `Analysis failed: ${error.message}`,
        ),
        [],
        Date.now() - startTime,
        undefined, // oder ein leeres ProductContext-Objekt, falls erforderlich
      );
    }
  }

  /**
   * Get relevant product context using semantic search
   * @param query User's query
   * @returns Product context with relevant watches from your store
   */
  private async getProductContext(query: string): Promise<ProductContext> {
    try {
      this.logger.log(`Searching products for: ${query.substring(0, 50)}...`);

      // First try semantic search for natural language queries
      let products: Product[] = [];
      let searchMethod: 'semantic' | 'hybrid' | 'filtered' = 'semantic';

      try {
        // Use your existing semantic search
        products = await this.productsService.semanticSearch(query, 10, 0.6);
        this.logger.log(
          `Found ${products.length} products via semantic search`,
        );
      } catch (_semanticError) {
        this.logger.warn(
          'Semantic search failed, trying hybrid search:',
          _semanticError,
        );

        try {
          // Fallback to hybrid search
          products = await this.productsService.hybridSearch(query, {}, 10);
          searchMethod = 'hybrid';
          this.logger.log(
            `Found ${products.length} products via hybrid search`,
          );
        } catch (hybridError) {
          this.logger.warn(
            'Hybrid search failed, using basic pagination:',
            hybridError,
          );

          // Final fallback to basic product listing
          products = await this.productsService.findAllWithPagination({
            paginationOptions: { page: 1, limit: 10 },
          });
          searchMethod = 'filtered';
        }
      }

      // Filter only active products for luxury watches
      const activeProducts = products.filter((product) => product.isActive);

      return new ProductContext(
        activeProducts,
        query,
        this.calculateRelevanceScore(query, activeProducts),
        searchMethod,
      );
    } catch (error) {
      this.logger.error('Error getting product context:', error);

      return new ProductContext([], query, 0, 'filtered');
    }
  }

  /**
   * Calculate relevance score based on query and found products
   */
  private calculateRelevanceScore(query: string, products: Product[]): number {
    if (products.length === 0) return 0;

    const lowerQuery = query.toLowerCase();
    let totalScore = 0;

    for (const product of products) {
      let productScore = 0;

      // Check if query terms appear in product name (highest weight)
      if (product.name?.toLowerCase().includes(lowerQuery)) {
        productScore += 0.4;
      }

      // Check description
      if (product.description?.toLowerCase().includes(lowerQuery)) {
        productScore += 0.3;
      }

      // Check metadata
      if (
        product.metaTitle?.toLowerCase().includes(lowerQuery) ||
        product.metaDescription?.toLowerCase().includes(lowerQuery)
      ) {
        productScore += 0.2;
      }

      // Check attributes
      if (
        product.color?.toLowerCase().includes(lowerQuery) ||
        product.size?.toLowerCase().includes(lowerQuery)
      ) {
        productScore += 0.1;
      }

      totalScore += productScore;
    }

    return Math.min(totalScore / products.length, 1.0);
  }

  /**
   * Enhanced shopping response generation with real product data
   * @param query User's query
   * @param productContext Array of product strings (for backward compatibility)
   * @param userPreferences User's shopping preferences
   * @returns Generated response with actual product recommendations
   */
  async generateShoppingResponse(
    query: string,
    productContext: string[] = [],
    userPreferences?: any,
  ): Promise<ShoppingResponse> {
    try {
      this.logger.log(
        `Generating luxury watch response for: ${query.substring(0, 50)}...`,
      );

      // Get relevant products from your store
      const storeProductContext = await this.getProductContext(query);
      const relevantProducts = storeProductContext.products.slice(0, 5);

      // Format products for AI prompt
      const formattedProducts = this.formatProductsForAI(relevantProducts);

      // Combine with any additional context provided
      const allContext = [...formattedProducts, ...productContext];

      const contextSection =
        allContext.length > 0
          ? `AVAILABLE LUXURY TIMEPIECES IN OUR BOUTIQUE:\n${allContext
              .map((product, index) => `${index + 1}. ${product}`)
              .join('\n\n')}\n`
          : 'We have an exquisite collection of luxury timepieces available.\n';

      const preferencesSection = userPreferences
        ? `CLIENT PREFERENCES:\n${JSON.stringify(userPreferences, null, 2)}\n`
        : '';

      const searchInfoSection =
        relevantProducts.length > 0
          ? `SEARCH CONTEXT: Found ${relevantProducts.length} relevant timepieces using ${storeProductContext.searchMethod} search (relevance: ${(storeProductContext.relevanceScore * 100).toFixed(1)}%)\n`
          : '';

      const prompt = `You are a sophisticated luxury watch specialist in an exclusive horological boutique. You have access to our current inventory and can make specific recommendations.

${searchInfoSection}
${contextSection}
${preferencesSection}

CLIENT INQUIRY: "${query}"

GUIDELINES:
- Recommend SPECIFIC timepieces from our current inventory shown above
- Be knowledgeable about horological craftsmanship, complications, and heritage
- Discuss investment potential and market appreciation when relevant
- Mention authenticity, certification, and provenance
- Provide insights about movements, materials, and manufacturing excellence
- Use sophisticated terminology while remaining approachable
- Keep responses elegant and informative (under 300 words)
- Always reference specific products by name when making recommendations
- If no perfect matches exist, suggest similar alternatives or special orders

Generate a refined recommendation:`;

      const response = await this.callOllama(prompt, {
        temperature: 0.7,
        num_predict: 350,
        top_p: 0.9,
      });

      // Extract product references from actual store inventory
      const referencedProducts = this.extractStoreProductReferences(
        response,
        relevantProducts,
      );

      // Generate contextual suggestions
      const suggestions = await this.generateProductBasedSuggestions(
        query,
        response,
        relevantProducts,
      );

      return new ShoppingResponse(
        response.trim(),
        storeProductContext.relevanceScore > 0.3 ? 0.9 : 0.7,
        referencedProducts,
        suggestions,
      );
    } catch (error) {
      this.logger.error('Error generating shopping response:', error);

      return new ShoppingResponse(
        "I apologize, but I'm having trouble accessing our current inventory at the moment. Would you like to discuss a specific luxury timepiece or perhaps schedule a private consultation to view our collection?",
        0.3,
        [],
        [
          'Which luxury watch brands interest you most?',
          'Are you looking for a specific complication or feature?',
          'Would you prefer to schedule a private viewing?',
        ],
      );
    }
  }

  /**
   * Format products for AI prompt
   */
  private formatProductsForAI(products: Product[]): string[] {
    return products.map((product) => {
      const features: string[] = [];

      if (product.color) features.push(`Color: ${product.color}`);
      if (product.size) features.push(`Size: ${product.size}`);
      if (product.dimensions)
        features.push(`Dimensions: ${product.dimensions}`);
      if (product.weight) features.push(`Weight: ${product.weight}g`);

      const featuresText =
        features.length > 0 ? ` | ${features.join(', ')}` : '';
      const stockText = product.stock ? ` | In Stock: ${product.stock}` : '';
      const priceText = product.salePrice
        ? ` | Sale Price: $${product.salePrice.toLocaleString()}`
        : product.price
          ? ` | Price: $${product.price.toLocaleString()}`
          : '';

      return `${product.name} - ${product.description || 'Luxury timepiece'}${priceText}${featuresText}${stockText}`;
    });
  }

  /**
   * Extract references to actual store products
   */
  private extractStoreProductReferences(
    response: string,
    products: Product[],
  ): string[] {
    const references: string[] = [];
    const lowerResponse = response.toLowerCase();

    products.forEach((product) => {
      // Check if product name is mentioned in response
      if (product.name && lowerResponse.includes(product.name.toLowerCase())) {
        references.push(product.id);
      }

      // Check if description keywords are mentioned
      if (product.description) {
        const descWords = product.description.toLowerCase().split(' ');
        const matchedWords = descWords.filter(
          (word) => word.length > 4 && lowerResponse.includes(word),
        );

        if (matchedWords.length >= 2) {
          references.push(product.id);
        }
      }
    });

    return [...new Set(references)]; // Remove duplicates
  }

  /**
   * Generate suggestions based on actual product inventory
   */
  private async generateProductBasedSuggestions(
    query: string,
    response: string,
    availableProducts: Product[],
  ): Promise<string[]> {
    try {
      const productSummary =
        availableProducts.length > 0
          ? `Available products: ${availableProducts.map((p) => p.name).join(', ')}`
          : 'Limited inventory available';

      const prompt = `Based on this luxury watch consultation and our current inventory, generate 3 sophisticated follow-up questions:

Client Inquiry: "${query}"
Our Response: "${response}"
Current Inventory: ${productSummary}

Generate 3 refined questions that would help the client choose from our available timepieces:

1. [specific question about available products]
2. [question about preferences or requirements]
3. [question about service or next steps]`;

      const suggestionResponse = await this.callOllama(prompt, {
        temperature: 0.6,
        num_predict: 150,
      });

      const suggestions = this.parseSuggestions(suggestionResponse);
      return suggestions.length > 0
        ? suggestions
        : this.getDefaultSuggestions(query);
    } catch (error) {
      this.logger.warn(
        'Failed to generate product-based suggestions, using defaults:',
        error,
      );
      return this.getDefaultSuggestions(query);
    }
  }

  /**
   * Classify user intent for watch shopping (all types)
   */
  async classifyIntent(query: string): Promise<IntentClassification> {
    try {
      this.logger.log(`Classifying intent for: ${query.substring(0, 50)}...`);

      const prompt = `You are an expert at understanding customer intentions in a comprehensive watch store that sells all types of watches.

Classify this customer query into ONE of these categories:

CATEGORIES:
- PRODUCT_SEARCH: Customer looking for specific watches or timepieces
- PRICE_INQUIRY: Customer asking about pricing information or value
- BRAND_COMPARISON: Customer comparing different watch brands
- FEATURE_INQUIRY: Customer asking about specific watch features or functions
- COMPATIBILITY: Customer checking compatibility with devices or lifestyle
- MAINTENANCE_SERVICE: Customer needs servicing, repair, or maintenance
- WARRANTY_INQUIRY: Customer asking about warranty or guarantee
- AVAILABILITY: Customer checking if watches are in stock
- APPOINTMENT_REQUEST: Customer wants to schedule viewing or consultation
- GREETING: Customer greeting or starting conversation
- HELP_REQUEST: Customer needs general assistance
- OTHER: Query doesn't fit other categories

Customer Query: "${query}"

Respond in this exact format:
CATEGORY: [category_name]
CONFIDENCE: [0.0 to 1.0]
REASON: [brief explanation]

Example:
CATEGORY: PRODUCT_SEARCH
CONFIDENCE: 0.95
REASON: Customer is looking for a specific watch type`;

      const response = await this.callOllama(prompt, {
        temperature: 0.3,
        num_predict: 150,
        stop: ['\n\n'],
      });

      return this.parseIntentResponse(response, query);
    } catch (error) {
      this.logger.error('Error classifying intent:', error);
      return this.classifyIntentFallback(query);
    }
  }

  /**
   * Extract luxury watch entities
   */
  async extractEntities(query: string): Promise<ExtractedEntity[]> {
    try {
      this.logger.log(`Extracting entities from: ${query.substring(0, 50)}...`);

      const prompt = `You are an expert at identifying luxury watches and horological information.

Extract watch-related entities from this customer query and categorize them:

ENTITY TYPES TO FIND:
- WATCH_BRAND: Rolex, Patek Philippe, Audemars Piguet, Omega, Cartier, etc.
- WATCH_MODEL: Submariner, Daytona, Nautilus, Royal Oak, Speedmaster, etc.
- WATCH_COLLECTION: Oyster Perpetual, Aquanaut, Offshore, Seamaster, etc.
- WATCH_TYPE: diving watch, dress watch, chronograph, GMT, pilot watch, etc.
- PRICE_RANGE: $5000, under $50k, between $100k-500k, investment grade, etc.
- MATERIAL: gold, platinum, titanium, ceramic, steel, rose gold, etc.
- COMPLICATION: tourbillon, perpetual calendar, minute repeater, moon phase, etc.
- SIZE: 40mm, 42mm, case diameter, etc.
- CONDITION: new, vintage, pre-owned, certified pre-owned, etc.

Customer Query: "${query}"

For each entity found, respond with one line in this format:
ENTITY: [entity_text] | TYPE: [entity_type] | CONFIDENCE: [0.0-1.0] | POSITION: [start_index]

Example:
ENTITY: Rolex Submariner | TYPE: WATCH_MODEL | CONFIDENCE: 0.95 | POSITION: 7
ENTITY: Rolex | TYPE: WATCH_BRAND | CONFIDENCE: 0.90 | POSITION: 7
ENTITY: $15000 | TYPE: PRICE_RANGE | CONFIDENCE: 0.85 | POSITION: 30

Only include entities with confidence > 0.7`;

      const response = await this.callOllama(prompt, {
        temperature: 0.2,
        num_predict: 300,
      });

      const entities = this.parseEntityResponse(response);

      // Add fallback entity extraction using patterns
      const fallbackEntities = this.extractEntitiesFallback(query);
      entities.push(...fallbackEntities);

      // Remove duplicates
      const uniqueEntities = this.removeDuplicateEntities(entities);

      this.logger.log(`Extracted ${uniqueEntities.length} entities`);
      return uniqueEntities;
    } catch (error) {
      this.logger.error('Error extracting entities:', error);
      return this.extractEntitiesFallback(query);
    }
  }

  // ===== REST OF THE METHODS REMAIN THE SAME =====
  // (All the existing private methods like callOllama, parseIntentResponse, etc.)

  private async callOllama(
    prompt: string,
    options?: Partial<OllamaRequestOptions>,
  ): Promise<string> {
    if (!this.isOllamaAvailable) {
      throw new Error(
        'Ollama is not available. Please check your Ollama installation.',
      );
    }

    const requestData: OllamaRequest = {
      model: this.ollamaModel,
      prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        repeat_penalty: 1.1,
        num_predict: 200,
        ...options,
      },
      context: this.conversationContext,
    };

    try {
      const startTime = Date.now();

      const response = await firstValueFrom(
        this.httpService.post<OllamaResponse>(
          `${this.ollamaBaseUrl}/api/generate`,
          requestData,
          {
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const processingTime = Date.now() - startTime;

      if (response.data && response.data.response) {
        if (response.data.context) {
          this.conversationContext = response.data.context;
        }

        this.logger.debug(`Ollama response generated in ${processingTime}ms`);
        return response.data.response;
      } else {
        throw new Error('Invalid response from Ollama');
      }
    } catch (error) {
      this.logger.error('Ollama API call failed:', error.message);
      await this.checkOllamaHealth();
      throw new Error(`Ollama API error: ${error.message}`);
    }
  }

  // Include all other existing private methods...
  private parseIntentResponse(
    response: string,
    originalQuery: string,
  ): IntentClassification {
    const validIntents = [
      'PRODUCT_SEARCH',
      'PRICE_INQUIRY',
      'BRAND_COMPARISON',
      'COLLECTION_INQUIRY',
      'AUTHENTICATION',
      'INVESTMENT_ADVICE',
      'MAINTENANCE_SERVICE',
      'WARRANTY_INQUIRY',
      'AVAILABILITY',
      'APPOINTMENT_REQUEST',
      'GREETING',
      'HELP_REQUEST',
      'OTHER',
    ];

    try {
      const lines = response.split('\n');
      let intent = 'OTHER';
      let confidence = 0.5;
      let reasoning = 'AI classification';

      for (const line of lines) {
        if (line.startsWith('CATEGORY:')) {
          const intentMatch = line
            .replace('CATEGORY:', '')
            .trim()
            .toUpperCase();
          if (validIntents.includes(intentMatch)) {
            intent = intentMatch;
          }
        } else if (line.startsWith('CONFIDENCE:')) {
          const confMatch = line.replace('CONFIDENCE:', '').trim();
          const parsedConf = parseFloat(confMatch);
          if (!isNaN(parsedConf) && parsedConf >= 0 && parsedConf <= 1) {
            confidence = parsedConf;
          }
        } else if (line.startsWith('REASON:')) {
          reasoning = line.replace('REASON:', '').trim();
        }
      }

      return new IntentClassification(intent, confidence, reasoning);
    } catch (error) {
      this.logger.warn(
        'Failed to parse intent response, using fallback:',
        error,
      );
      return this.classifyIntentFallback(originalQuery);
    }
  }

  private parseEntityResponse(response: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    try {
      const lines = response.split('\n');

      for (const line of lines) {
        if (line.includes('ENTITY:') && line.includes('TYPE:')) {
          const entityMatch = line.match(
            /ENTITY:\s*([^|]+)\s*\|\s*TYPE:\s*([^|]+)\s*\|\s*CONFIDENCE:\s*([^|]+)\s*\|\s*POSITION:\s*(\d+)/,
          );

          if (entityMatch) {
            const [, text, type, confidenceStr, positionStr] = entityMatch;
            const confidence = parseFloat(confidenceStr.trim());
            const position = parseInt(positionStr.trim());

            if (text && type && !isNaN(confidence) && confidence > 0.7) {
              entities.push(
                new ExtractedEntity(
                  text.trim(),
                  type.trim().toUpperCase(),
                  confidence,
                  position || 0,
                  (position || 0) + text.trim().length,
                ),
              );
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to parse entity response:', error);
    }

    return entities;
  }

  private parseSuggestions(response: string): string[] {
    const suggestions: string[] = [];
    const lines = response.split('\n');

    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)$/);
      if (match && match[1]) {
        suggestions.push(match[1].trim());
      }
    }

    return suggestions.slice(0, 3);
  }

  private getDefaultSuggestions(query: string): string[] {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('rolex')) {
      return [
        'Are you interested in a specific Rolex collection like Submariner or Daytona?',
        'Would you prefer a new piece or are you open to vintage options?',
        'What occasions will you primarily wear this timepiece for?',
      ];
    }

    return [
      'Which luxury watch brands are you most drawn to?',
      'Are you looking for specific complications like chronograph or GMT?',
      'Would you prefer to schedule a private consultation to view pieces?',
    ];
  }

  // Include all fallback methods...
  private classifyIntentFallback(query: string): IntentClassification {
    const lowerQuery = query.toLowerCase();

    if (this.containsWatchTerms(lowerQuery)) {
      return new IntentClassification(
        'PRODUCT_SEARCH',
        0.8,
        'Contains luxury watch terms',
      );
    }
    if (this.containsPriceTerms(lowerQuery)) {
      return new IntentClassification(
        'PRICE_INQUIRY',
        0.8,
        'Contains price or investment terms',
      );
    }
    if (this.containsBrandTerms(lowerQuery)) {
      return new IntentClassification(
        'BRAND_COMPARISON',
        0.8,
        'Contains brand comparison terms',
      );
    }
    if (this.containsGreetingTerms(lowerQuery)) {
      return new IntentClassification(
        'GREETING',
        0.9,
        'Contains greeting terms',
      );
    }
    if (this.containsHelpTerms(lowerQuery)) {
      return new IntentClassification(
        'HELP_REQUEST',
        0.8,
        'Contains help request terms',
      );
    }

    return new IntentClassification('OTHER', 0.5, 'No clear pattern match');
  }

  private extractEntitiesFallback(query: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    const watchBrands = [
      'rolex',
      'patek philippe',
      'audemars piguet',
      'omega',
      'cartier',
      'breitling',
      'tag heuer',
      'hublot',
      'iwc',
      'jaeger-lecoultre',
    ];
    const brandRegex = new RegExp(`\\b(${watchBrands.join('|')})\\b`, 'gi');
    let match;
    while ((match = brandRegex.exec(query)) !== null) {
      entities.push(
        new ExtractedEntity(
          match[0],
          'WATCH_BRAND',
          0.9,
          match.index,
          match.index + match[0].length,
        ),
      );
    }

    const priceRegex =
      /\$[\d,]+k?|\$[\d,]+,[\d]+|under \$[\d,]+k?|over \$[\d,]+k?/gi;
    while ((match = priceRegex.exec(query)) !== null) {
      entities.push(
        new ExtractedEntity(
          match[0],
          'PRICE_RANGE',
          0.9,
          match.index,
          match.index + match[0].length,
        ),
      );
    }

    return entities;
  }

  private containsWatchTerms(text: string): boolean {
    const terms = [
      'watch',
      'timepiece',
      'chronometer',
      'wristwatch',
      'horology',
    ];
    return terms.some((term) => text.includes(term));
  }

  private containsPriceTerms(text: string): boolean {
    const terms = [
      'price',
      'cost',
      'expensive',
      'investment',
      'value',
      'worth',
      'budget',
      'how much',
      '$',
    ];
    return terms.some((term) => text.includes(term));
  }

  private containsBrandTerms(text: string): boolean {
    const terms = [
      'compare',
      'vs',
      'versus',
      'better',
      'best',
      'recommend',
      'difference',
      'between',
    ];
    return terms.some((term) => text.includes(term));
  }

  private containsGreetingTerms(text: string): boolean {
    const terms = [
      'hello',
      'hi',
      'hey',
      'good morning',
      'good afternoon',
      'greetings',
    ];
    return terms.some((term) => text.includes(term));
  }

  private containsHelpTerms(text: string): boolean {
    const terms = [
      'help',
      'assist',
      'support',
      'guide',
      'advice',
      'consultation',
    ];
    return terms.some((term) => text.includes(term));
  }

  private removeDuplicateEntities(
    entities: ExtractedEntity[],
  ): ExtractedEntity[] {
    const seen = new Set();
    return entities.filter((entity) => {
      const key = `${entity.text.toLowerCase()}-${entity.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
