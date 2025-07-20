/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AllConfigType } from '../config/config.type';
import { ConfigService } from '@nestjs/config';

// Import domain entities
import { IntentClassification } from './domain/intent-classification';
import { ExtractedEntity } from './domain/extracted-entity';
import { QueryAnalysis } from './domain/query-analysis';
import { ShoppingResponse } from './domain/shopping-response';
import { OllamaRequest, OllamaRequestOptions, OllamaResponse } from './domain';

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
   * Main query analysis method - combines intent classification and entity extraction
   * @param query User's text query
   * @returns Complete analysis with intent and entities
   */
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    const startTime = Date.now();

    try {
      this.logger.log(`Analyzing query: ${query.substring(0, 100)}...`);

      // Run intent classification and entity extraction in parallel
      const [intent, entities] = await Promise.all([
        this.classifyIntent(query),
        this.extractEntities(query),
      ]);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Query analyzed in ${processingTime}ms - Intent: ${intent.intent} (${intent.confidence}), Entities: ${entities.length}`,
      );

      return new QueryAnalysis(intent, entities, processingTime);
    } catch (error) {
      this.logger.error('Error analyzing query:', error);

      return new QueryAnalysis(
        new IntentClassification(
          'OTHER',
          0.3,
          `Analysis failed: ${error.message}`,
        ),
        [],
        Date.now() - startTime,
      );
    }
  }

  /**
   * Classify user intent for luxury watch shopping
   * @param query User's text query
   * @returns Intent classification with confidence
   */
  async classifyIntent(query: string): Promise<IntentClassification> {
    try {
      this.logger.log(`Classifying intent for: ${query.substring(0, 50)}...`);

      const prompt = `You are an expert at understanding customer intentions in a luxury watch boutique.

Classify this customer query into ONE of these categories:

CATEGORIES:
- PRODUCT_SEARCH: Customer looking for specific luxury watches or timepieces
- PRICE_INQUIRY: Customer asking about pricing information or investment value
- BRAND_COMPARISON: Customer comparing different luxury watch brands
- COLLECTION_INQUIRY: Customer asking about specific watch collections or series
- AUTHENTICATION: Customer asking about authenticity or verification
- INVESTMENT_ADVICE: Customer seeking investment guidance for watches
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
REASON: Customer is looking for a Rolex Submariner`;

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
   * Extract luxury watch brands, models, features, and other horological entities
   * @param query User's text query
   * @returns Array of extracted entities
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

      const entities = this.parseEntityResponse(response, query);

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
   * Generate contextual luxury watch shopping response
   * @param query User's query
   * @param productContext Array of relevant watch information
   * @param userPreferences User's shopping preferences and history
   * @returns Generated response with watch recommendations
   */
  async generateShoppingResponse(
    query: string,
    productContext: string[],
    userPreferences?: any,
  ): Promise<ShoppingResponse> {
    try {
      this.logger.log(
        `Generating luxury watch response for: ${query.substring(0, 50)}...`,
      );

      const contextSection =
        productContext.length > 0
          ? `AVAILABLE TIMEPIECES:\n${productContext
              .slice(0, 5)
              .map((product, index) => `${index + 1}. ${product}`)
              .join('\n\n')}\n`
          : '';

      const preferencesSection = userPreferences
        ? `CLIENT PREFERENCES:\n${JSON.stringify(userPreferences, null, 2)}\n`
        : '';

      const prompt = `You are a knowledgeable and sophisticated luxury watch specialist working in an exclusive horological boutique. Your expertise covers fine timepieces, investment potential, and horological craftsmanship.

${contextSection}
${preferencesSection}

CLIENT INQUIRY: "${query}"

GUIDELINES:
- Be professional, knowledgeable, and sophisticated in your approach
- If timepieces are available above, recommend specific ones that match the client's needs
- Discuss horological complications, craftsmanship, and heritage when relevant
- Address investment potential and market appreciation for luxury watches
- Mention authenticity, provenance, and certification considerations
- Provide insights about watch movements, materials, and manufacturing
- Keep responses informative but elegant (under 250 words)
- Always emphasize the exclusivity and craftsmanship of luxury timepieces
- Use sophisticated horological terminology appropriately

Generate a refined response:`;

      const response = await this.callOllama(prompt, {
        temperature: 0.7,
        num_predict: 300,
        top_p: 0.9,
      });

      // Extract product references from context
      const referencedProducts = this.extractProductReferences(
        response,
        productContext,
      );

      // Generate follow-up suggestions
      const suggestions = await this.generateSuggestions(query, response);

      return new ShoppingResponse(
        response.trim(),
        0.9,
        referencedProducts,
        suggestions,
      );
    } catch (error) {
      this.logger.error('Error generating shopping response:', error);

      return new ShoppingResponse(
        "I apologize, but I'm having trouble processing your inquiry at the moment. Would you like to discuss a specific luxury timepiece or perhaps schedule a private consultation?",
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

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Call Ollama API with proper error handling and retry logic
   */
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
            timeout: 30000, // 30 second timeout
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const processingTime = Date.now() - startTime;

      if (response.data && response.data.response) {
        // Update conversation context for better continuity
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

      // Try to recover by checking health again
      await this.checkOllamaHealth();

      throw new Error(`Ollama API error: ${error.message}`);
    }
  }

  /**
   * Parse intent classification response from Ollama
   */
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
      this.logger.warn('Failed to parse intent response, using fallback');
      return this.classifyIntentFallback(originalQuery);
    }
  }

  /**
   * Parse entity extraction response from Ollama
   */
  private parseEntityResponse(
    response: string,
    originalQuery: string,
  ): ExtractedEntity[] {
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
      this.logger.warn('Failed to parse entity response');
    }

    return entities;
  }

  /**
   * Generate contextual follow-up suggestions
   */
  private async generateSuggestions(
    query: string,
    response: string,
  ): Promise<string[]> {
    try {
      const prompt = `Based on this luxury watch consultation, generate 3 sophisticated follow-up questions or suggestions:

Client Inquiry: "${query}"
Our Response: "${response}"

Generate 3 refined, helpful follow-up questions that would assist the client in finding the perfect timepiece. Focus on:
- Specific watch preferences (complications, size, style)
- Brand heritage and craftsmanship interests
- Investment considerations and collection goals
- Occasion or lifestyle requirements

Format as numbered list:
1. [suggestion]
2. [suggestion] 
3. [suggestion]`;

      const suggestionResponse = await this.callOllama(prompt, {
        temperature: 0.6,
        num_predict: 150,
      });

      const suggestions = this.parseSuggestions(suggestionResponse);
      return suggestions.length > 0
        ? suggestions
        : this.getDefaultSuggestions(query);
    } catch (error) {
      this.logger.warn('Failed to generate AI suggestions, using defaults');
      return this.getDefaultSuggestions(query);
    }
  }

  /**
   * Parse suggestions from AI response
   */
  private parseSuggestions(response: string): string[] {
    const suggestions: string[] = [];
    const lines = response.split('\n');

    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)$/);
      if (match && match[1]) {
        suggestions.push(match[1].trim());
      }
    }

    return suggestions.slice(0, 3); // Max 3 suggestions
  }

  /**
   * Get default suggestions based on query content
   */
  private getDefaultSuggestions(query: string): string[] {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('rolex')) {
      return [
        'Are you interested in a specific Rolex collection like Submariner or Daytona?',
        'Would you prefer a new piece or are you open to vintage options?',
        'What occasions will you primarily wear this timepiece for?',
      ];
    }

    if (lowerQuery.includes('patek') || lowerQuery.includes('philippe')) {
      return [
        'Are you interested in Patek Philippe complications or a time-only piece?',
        'Would you like to explore the Calatrava or Nautilus collections?',
        'Are you considering this as an investment or personal collection piece?',
      ];
    }

    if (lowerQuery.includes('price') || lowerQuery.includes('investment')) {
      return [
        'What is your preferred investment range for this timepiece?',
        'Are you interested in watches with strong appreciation potential?',
        'Would you like to discuss market trends for specific brands?',
      ];
    }

    return [
      'Which luxury watch brands are you most drawn to?',
      'Are you looking for specific complications like chronograph or GMT?',
      'Would you prefer to schedule a private consultation to view pieces?',
    ];
  }

  // Fallback methods
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

    // Luxury watch brands
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
      'vacheron constantin',
      'chopard',
      'panerai',
      'tudor',
      'zenith',
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

    // Price patterns for luxury watches
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

    // Watch models and types
    const watchTypes = [
      'submariner',
      'daytona',
      'datejust',
      'nautilus',
      'royal oak',
      'speedmaster',
      'seamaster',
      'tank',
      'santos',
      'chronograph',
      'diving watch',
      'dress watch',
      'pilot watch',
      'gmt',
    ];
    const typeRegex = new RegExp(`\\b(${watchTypes.join('|')})\\b`, 'gi');
    while ((match = typeRegex.exec(query)) !== null) {
      entities.push(
        new ExtractedEntity(
          match[0],
          'WATCH_MODEL',
          0.8,
          match.index,
          match.index + match[0].length,
        ),
      );
    }

    return entities;
  }

  // Pattern matching helpers for luxury watches
  private containsWatchTerms(text: string): boolean {
    const terms = [
      'watch',
      'timepiece',
      'chronometer',
      'wristwatch',
      'horology',
      'movement',
      'complication',
      'tourbillon',
      'perpetual calendar',
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
      'appreciation',
      'market',
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
      'which brand',
      'what brand',
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

  private extractProductReferences(
    response: string,
    productContext: string[],
  ): string[] {
    const references: string[] = [];

    productContext.forEach((product, index) => {
      const productName = product.split('\n')[0];
      if (response.toLowerCase().includes(productName.toLowerCase())) {
        references.push(`product_${index}`);
      }
    });

    return references;
  }
}
