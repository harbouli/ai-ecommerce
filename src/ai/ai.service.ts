/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { StoreInventoryContext } from './dto/store-inventory-context';
import axios from 'axios';

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

      const embedding = await this.generateEmbedding(query);

      // Run analysis in parallel with product search
      const [intent, entities, productContext] = await Promise.all([
        this.classifyIntent(query),
        this.extractEntities(query, embedding),
        this.getProductContext(embedding),
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
   * Get products directly from MongoDB to avoid UUID/ObjectId issues
   */
  private async getProductsDirectFromMongoDB(
    query: string,
  ): Promise<Product[]> {
    try {
      // Use only MongoDB-based methods to avoid ID format conflicts
      const products = await this.productsService.findAllWithPagination({
        paginationOptions: { page: 1, limit: 50 },
      });

      // Filter products based on query terms
      const lowerQuery = query.toLowerCase();
      const queryWords = lowerQuery
        .split(' ')
        .filter((word) => word.length > 2);

      const filteredProducts = products.filter((product) => {
        if (!product.isActive) return false;

        const searchableText = [
          product.name,
          product.description,
          product.metaTitle,
          product.metaDescription,
          product.color,
          product.size,
          product.brand,
          product.category,
          ...(product.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        // Check if any word in query matches product text
        return queryWords.some((word) => searchableText.includes(word));
      });

      this.logger.log(
        `MongoDB direct search found ${filteredProducts.length} products`,
      );
      return filteredProducts;
    } catch (error) {
      this.logger.error('Error in direct MongoDB search:', error);
      return [];
    }
  }
  private async callOllamaEmbedding(
    text: string,
  ): Promise<{ embedding: number[] }> {
    try {
      const url = `${this.ollamaBaseUrl}/api/embeddings`;

      const response = await axios.post(
        url,
        {
          model: 'nomic-embed-text:latest',
          prompt: text,
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.status !== 200) {
        throw new Error(`Ollama API returned status ${response.status}`);
      }

      return response.data;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          'Cannot connect to Ollama. Please ensure Ollama is running.',
        );
      }

      if (error.response) {
        throw new Error(
          `Ollama API error: ${error.response.status} - ${error.response.statusText}`,
        );
      }

      throw error;
    }
  }

  /**
   * Generate embedding using nomic-embed-text:latest via Ollama
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      this.logger.log(
        `Generating embedding for text: "${text.substring(0, 50)}..."`,
      );

      if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
      }

      const response = await this.callOllamaEmbedding(text);

      if (!response?.embedding) {
        throw new Error('No embedding returned from Ollama');
      }

      const embedding = response.embedding;

      // Validate embedding dimensions (nomic-embed-text typically returns 768 dimensions)
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error(
          `Invalid embedding format: expected array, got ${typeof embedding}`,
        );
      }

      this.logger.log(
        `Successfully generated embedding with ${embedding.length} dimensions`,
      );
      return embedding;
    } catch (error) {
      this.logger.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Enhanced product context with embedding support
   */
  private async getProductContext(
    embedding: number[],
  ): Promise<ProductContext> {
    try {
      this.logger.log(
        `Getting product context with embedding (${embedding.length} dimensions)`,
      );

      let products: Product[] = [];
      let searchMethod: 'semantic' | 'hybrid' | 'filtered' = 'semantic';

      try {
        // Use semantic search with embedding
        products = await this.productsService.semanticSearch(
          embedding,
          15,
          0.5,
        );
        this.logger.log(
          `Found ${products.length} products via embedding search`,
        );
      } catch (semanticError) {
        this.logger.warn(
          'Embedding search failed, using fallback:',
          semanticError,
        );
        // Use fallback to empty products since we can't convert embedding back to text
        products = [];
        searchMethod = 'filtered';
      }

      // Filter active products and apply relevance scoring
      const activeProducts = products.filter((product) => product.isActive);

      return new ProductContext(
        activeProducts,
        `embedding_search_${embedding.length}d`,
        activeProducts.length > 0 ? 0.8 : 0,
        searchMethod,
      );
    } catch (error) {
      this.logger.error('Error getting product context with embedding:', error);
      return new ProductContext([], 'embedding_search_failed', 0, 'filtered');
    }
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
      const embedding = await this.generateEmbedding(query);

      // Get relevant products from your store
      const storeProductContext = await this.getProductContext(embedding);
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
   * Enhanced entity extraction for all types of watches with store inventory context
   */
  async extractEntities(
    query: string,
    embedding?: number[],
  ): Promise<ExtractedEntity[]> {
    try {
      this.logger.log(`Extracting entities from: ${query.substring(0, 50)}...`);

      // Get store inventory context for semantic tagging
      const storeInventory = await this.getStoreInventoryContext(
        query,
        embedding,
      );
      console.log(storeInventory);

      const prompt = `You are an expert at identifying all types of watches and timepieces from budget to luxury.

Extract watch-related entities from this customer query and categorize them:

ENTITY TYPES TO FIND:
- WATCH_BRAND: ${storeInventory.brands.join(', ')}, and any other brands mentioned
- WATCH_MODEL: Submariner, Daytona, Apple Watch Series 9, Garmin Fenix, etc.
- WATCH_TYPE: smartwatch, mechanical, digital, diving, dress, sports, fitness tracker, etc.
- WATCH_STYLE: ${storeInventory.styles.join(', ')}, casual, formal, military, etc.
- PRICE_RANGE: under $100, $100-500, $500-1000, $1000-5000, luxury ($5000+), etc.
- MATERIAL: ${storeInventory.materials.join(', ')}, plastic, rubber, fabric, etc.
- COLOR: ${storeInventory.colors.join(', ')}, and any color variations
- SIZE: ${storeInventory.sizes.join(', ')}, small, medium, large, XL, etc.
- FEATURES: ${storeInventory.features.join(', ')}, GPS, heart rate, sleep tracking, etc.
- CONDITION: new, used, refurbished, vintage, pre-owned, etc.
- GENDER: men's, women's, unisex, kids, etc.
- OCCASION: work, sport, formal, casual, outdoor, wedding, etc.

Customer Query: "${query}"

STORE INVENTORY CONTEXT:
Available Brands: ${storeInventory.brands.slice(0, 10).join(', ')}
Available Colors: ${storeInventory.colors.join(', ')}
Available Materials: ${storeInventory.materials.join(', ')}

For each entity found, respond with one line in this format:
ENTITY: [entity_text] | TYPE: [entity_type] | CONFIDENCE: [0.0-1.0] | POSITION: [start_index]

Example:
ENTITY: Apple Watch | TYPE: WATCH_BRAND | CONFIDENCE: 0.95 | POSITION: 7
ENTITY: black | TYPE: COLOR | CONFIDENCE: 0.90 | POSITION: 18
ENTITY: fitness tracking | TYPE: FEATURES | CONFIDENCE: 0.85 | POSITION: 30

Only include entities with confidence > 0.7`;

      const response = await this.callOllama(prompt, {
        temperature: 0.2,
        num_predict: 400,
      });

      const entities = this.parseEntityResponse(response);

      // Add semantic inventory matching
      const inventoryEntities = this.extractInventorySemanticTags(
        query,
        storeInventory,
      );
      entities.push(...inventoryEntities);

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

  /**
   * Get store inventory context based on client's query using semantic search
   */
  private async getStoreInventoryContext(
    clientQuery?: string,
    embedding?: number[],
  ): Promise<StoreInventoryContext> {
    try {
      this.logger.log(
        `Building inventory context for query: "${clientQuery || 'general'}"`,
      );

      const brands = new Set<string>();
      const colors = new Set<string>();
      const materials = new Set<string>();
      const types = new Set<string>();
      const styles = new Set<string>();
      const features = new Set<string>();
      const sizes = new Set<string>();
      const priceRanges = new Set<string>();

      if (clientQuery) {
        // Use client's query to find relevant products via semantic search
        const relevantProducts = await this.getProductsForInventoryContext(
          clientQuery,
          embedding,
        );

        this.logger.log(
          `Found ${relevantProducts.length} relevant products for inventory context`,
        );

        // Extract inventory tags from semantically relevant products
        relevantProducts.forEach((product) => {
          this.extractInventoryTagsFromProduct(
            product,
            brands,
            colors,
            materials,
            types,
            styles,
            features,
            sizes,
            priceRanges,
          );
        });
      } else {
        // Fallback to general inventory sampling
        const generalProducts =
          await this.productsService.findAllWithPagination({
            paginationOptions: { page: 1, limit: 100 },
          });

        generalProducts.forEach((product) => {
          this.extractInventoryTagsFromProduct(
            product,
            brands,
            colors,
            materials,
            types,
            styles,
            features,
            sizes,
            priceRanges,
          );
        });
      }

      const inventoryContext = new StoreInventoryContext(
        Array.from(brands),
        Array.from(colors),
        Array.from(materials),
        Array.from(types),
        Array.from(priceRanges),
        Array.from(sizes),
        Array.from(styles),
        Array.from(features),
      );

      return inventoryContext;
    } catch (error) {
      this.logger.error(
        'Error getting query-based store inventory context:',
        error,
      );
      return this.getDefaultInventoryContext();
    }
  }
  /**
   * Get products for inventory context with proper error handling
   */
  private async getProductsForInventoryContext(
    clientQuery: string,
    embedding?: number[],
  ): Promise<Product[]> {
    const products: Product[] = [];

    try {
      // Try semantic search first, but handle UUID/ObjectId errors gracefully
      try {
        const semanticProducts = await this.productsService.semanticSearch(
          embedding ?? [],
          15,
          0.5,
        );
        products.push(...semanticProducts);
        this.logger.log(
          `Semantic search for inventory: ${semanticProducts.length} products`,
        );
      } catch (semanticError) {
        this.logger.warn(
          'Semantic search failed for inventory context:',
          semanticError,
        );

        // Fallback to direct MongoDB query
        const mongoProducts =
          await this.getProductsDirectFromMongoDB(clientQuery);
        products.push(...mongoProducts);
      }

      return products.filter((product) => product.isActive);
    } catch (error) {
      this.logger.error('Error getting products for inventory context:', error);
      // Final fallback to basic product list
      return this.productsService.findAllWithPagination({
        paginationOptions: { page: 1, limit: 20 },
      });
    }
  }

  /**
   * Expand client query to include related inventory terms
   */
  private expandQueryForInventory(clientQuery: string): string {
    const lowerQuery = clientQuery.toLowerCase();
    const expansions: string[] = [clientQuery];

    // Add related terms based on query content
    if (
      lowerQuery.includes('smart') ||
      lowerQuery.includes('apple') ||
      lowerQuery.includes('samsung')
    ) {
      expansions.push('smartwatch fitness tracker GPS bluetooth');
    }

    if (
      lowerQuery.includes('luxury') ||
      lowerQuery.includes('rolex') ||
      lowerQuery.includes('omega')
    ) {
      expansions.push('luxury mechanical automatic gold steel premium');
    }

    if (
      lowerQuery.includes('sport') ||
      lowerQuery.includes('fitness') ||
      lowerQuery.includes('running')
    ) {
      expansions.push('sports waterproof heart rate GPS tracking');
    }

    if (
      lowerQuery.includes('dress') ||
      lowerQuery.includes('formal') ||
      lowerQuery.includes('elegant')
    ) {
      expansions.push('dress formal elegant leather classic');
    }

    if (
      lowerQuery.includes('black') ||
      lowerQuery.includes('white') ||
      lowerQuery.includes('color')
    ) {
      expansions.push('black white silver gold blue red colors');
    }

    if (
      lowerQuery.includes('cheap') ||
      lowerQuery.includes('budget') ||
      lowerQuery.includes('affordable')
    ) {
      expansions.push('affordable budget under digital quartz');
    }

    return expansions.join(' ');
  }

  /**
   * Extract all inventory tags from a single product
   */
  private extractInventoryTagsFromProduct(
    product: Product,
    brands: Set<string>,
    colors: Set<string>,
    materials: Set<string>,
    types: Set<string>,
    styles: Set<string>,
    features: Set<string>,
    sizes: Set<string>,
    priceRanges: Set<string>,
  ): void {
    // Combine all product text
    const productText = [
      product.name,
      product.description,
      product.metaTitle,
      product.metaDescription,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // Direct attribute extraction
    if (product.color) colors.add(product.color.toLowerCase());
    if (product.size) sizes.add(product.size.toLowerCase());
    if (product.price)
      priceRanges.add(this.categorizePriceRange(product.price));

    // Extract all categories from product text
    this.extractInventoryTagsFromText(
      productText,
      brands,
      colors,
      materials,
      types,
      styles,
      features,
      sizes,
    );
  }

  /**
   * Extract semantic inventory tags using pattern matching
   */
  private extractInventorySemanticTags(
    query: string,
    inventory: StoreInventoryContext,
  ): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const lowerQuery = query.toLowerCase();

    // Semantic brand matching
    inventory.brands.forEach((brand) => {
      if (lowerQuery.includes(brand.toLowerCase())) {
        const position = lowerQuery.indexOf(brand.toLowerCase());
        entities.push(
          new ExtractedEntity(
            brand,
            'WATCH_BRAND',
            0.9,
            position,
            position + brand.length,
          ),
        );
      }
    });

    // Semantic color matching
    inventory.colors.forEach((color) => {
      if (lowerQuery.includes(color.toLowerCase())) {
        const position = lowerQuery.indexOf(color.toLowerCase());
        entities.push(
          new ExtractedEntity(
            color,
            'COLOR',
            0.85,
            position,
            position + color.length,
          ),
        );
      }
    });

    // Semantic material matching
    inventory.materials.forEach((material) => {
      if (lowerQuery.includes(material.toLowerCase())) {
        const position = lowerQuery.indexOf(material.toLowerCase());
        entities.push(
          new ExtractedEntity(
            material,
            'MATERIAL',
            0.8,
            position,
            position + material.length,
          ),
        );
      }
    });

    // Semantic feature matching
    inventory.features.forEach((feature) => {
      if (lowerQuery.includes(feature.toLowerCase())) {
        const position = lowerQuery.indexOf(feature.toLowerCase());
        entities.push(
          new ExtractedEntity(
            feature,
            'FEATURES',
            0.8,
            position,
            position + feature.length,
          ),
        );
      }
    });

    return entities;
  }
  /**
   * Extract inventory tags from text using pattern matching
   */
  private extractInventoryTagsFromText(
    text: string,
    brands: Set<string>,
    colors: Set<string>,
    materials: Set<string>,
    types: Set<string>,
    styles: Set<string>,
    features: Set<string>,
    sizes: Set<string>,
  ): void {
    const lowerText = text.toLowerCase();

    // Common watch brands (all categories)
    const brandPatterns = [
      'apple',
      'samsung',
      'garmin',
      'fitbit',
      'rolex',
      'omega',
      'seiko',
      'casio',
      'citizen',
      'timex',
      'fossil',
      'tissot',
      'breitling',
      'tag heuer',
      'patek philippe',
      'audemars piguet',
      'vacheron constantin',
      'cartier',
      'rado',
      'longines',
    ];

    // Colors
    const colorPatterns = [
      'black',
      'white',
      'silver',
      'gold',
      'rose gold',
      'blue',
      'red',
      'green',
      'brown',
      'gray',
      'grey',
      'pink',
      'purple',
      'yellow',
      'orange',
      'bronze',
    ];

    // Materials
    const materialPatterns = [
      'stainless steel',
      'titanium',
      'aluminum',
      'ceramic',
      'leather',
      'silicone',
      'rubber',
      'nylon',
      'fabric',
      'plastic',
      'carbon fiber',
      'sapphire',
    ];

    // Watch types
    const typePatterns = [
      'smartwatch',
      'fitness tracker',
      'mechanical',
      'automatic',
      'quartz',
      'digital',
      'analog',
      'chronograph',
      'diving watch',
      'dress watch',
      'sports watch',
    ];

    // Features
    const featurePatterns = [
      'gps',
      'heart rate',
      'sleep tracking',
      'waterproof',
      'bluetooth',
      'wifi',
      'nfc',
      'wireless charging',
      'voice assistant',
      'music storage',
      'ecg',
    ];

    brandPatterns.forEach((brand) => {
      if (lowerText.includes(brand)) brands.add(brand);
    });

    colorPatterns.forEach((color) => {
      if (lowerText.includes(color)) colors.add(color);
    });

    materialPatterns.forEach((material) => {
      if (lowerText.includes(material)) materials.add(material);
    });

    typePatterns.forEach((type) => {
      if (lowerText.includes(type)) types.add(type);
    });

    featurePatterns.forEach((feature) => {
      if (lowerText.includes(feature)) features.add(feature);
    });
  }

  // ===== ADD THIS NEW HELPER METHOD =====
  /**
   * Categorize price into ranges
   */
  private categorizePriceRange(price: number): string {
    if (price < 100) return 'budget (under $100)';
    if (price < 500) return 'affordable ($100-500)';
    if (price < 1000) return 'mid-range ($500-1000)';
    if (price < 5000) return 'premium ($1000-5000)';
    return 'luxury ($5000+)';
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
  /**
   * Get default inventory context as fallback
   */
  private getDefaultInventoryContext(): StoreInventoryContext {
    return new StoreInventoryContext(
      [
        'apple',
        'samsung',
        'garmin',
        'fitbit',
        'rolex',
        'omega',
        'seiko',
        'casio',
        'fossil',
      ],
      ['black', 'white', 'silver', 'gold', 'blue', 'red', 'brown'],
      ['stainless steel', 'aluminum', 'leather', 'silicone', 'ceramic'],
      [
        'smartwatch',
        'fitness tracker',
        'mechanical',
        'digital',
        'sports watch',
      ],
      [
        'budget (under $100)',
        'affordable ($100-500)',
        'mid-range ($500-1000)',
        'premium ($1000-5000)',
        'luxury ($5000+)',
      ],
      ['38mm', '40mm', '42mm', '44mm', '45mm', 'small', 'medium', 'large'],
      ['casual', 'formal', 'sport', 'luxury', 'vintage'],
      ['gps', 'heart rate', 'waterproof', 'bluetooth', 'sleep tracking'],
    );
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

  /**
   * Enhanced fallback entity extraction with patterns
   */
  private extractEntitiesFallback(query: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const lowerQuery = query.toLowerCase();

    // Price patterns
    const priceRegex = /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g;
    let match;
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

    // Size patterns (for all watch types)
    const sizeRegex =
      /(\d+(?:\.\d+)?\s*mm)|(?:size\s+)?(small|medium|large|xl|xxl)/gi;
    while ((match = sizeRegex.exec(query)) !== null) {
      entities.push(
        new ExtractedEntity(
          match[0],
          'SIZE',
          0.85,
          match.index,
          match.index + match[0].length,
        ),
      );
    }

    // Color patterns
    const colors = [
      'black',
      'white',
      'silver',
      'gold',
      'blue',
      'red',
      'green',
      'brown',
      'pink',
    ];
    colors.forEach((color) => {
      if (lowerQuery.includes(color)) {
        const position = lowerQuery.indexOf(color);
        entities.push(
          new ExtractedEntity(
            color,
            'COLOR',
            0.8,
            position,
            position + color.length,
          ),
        );
      }
    });

    // Watch type patterns
    const watchTypes = [
      'smartwatch',
      'fitness tracker',
      'smart watch',
      'activity tracker',
      'mechanical watch',
      'automatic watch',
      'digital watch',
      'analog watch',
      'diving watch',
      'dress watch',
      'sports watch',
      'luxury watch',
    ];

    watchTypes.forEach((type) => {
      if (lowerQuery.includes(type)) {
        const position = lowerQuery.indexOf(type);
        entities.push(
          new ExtractedEntity(
            type,
            'WATCH_TYPE',
            0.85,
            position,
            position + type.length,
          ),
        );
      }
    });

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
