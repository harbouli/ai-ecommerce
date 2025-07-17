/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { AllConfigType } from '../config/config.type';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  tokensUsed: number;
  processingTime: number;
  model: string;
  confidence?: number;
  fromCache?: boolean;
}

export interface ExtractedEntity {
  text: string;
  type:
    | 'PRODUCT'
    | 'CATEGORY'
    | 'BRAND'
    | 'PRICE'
    | 'FEATURE'
    | 'LOCATION'
    | 'PERSON';
  confidence: number;
  startIndex: number;
  endIndex: number;
  metadata: Record<string, any>;
}

export interface IntentClassification {
  intent: string;
  confidence: number;
  entities: ExtractedEntity[];
  metadata: Record<string, any>;
}

export interface TextSummary {
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
  model: string;
  processingTime: number;
}

interface CacheEntry {
  response: any;
  timestamp: number;
  ttl: number;
}

class GeminiRateLimitManager {
  private requestCounts = new Map<string, number>();
  private tokenCounts = new Map<string, number>();
  private dailyRequestCount = 0;
  private lastResetTime = new Map<string, number>();
  private lastDailyReset = Date.now();

  private readonly MINUTE_MS = 60 * 1000;
  private readonly DAY_MS = 24 * 60 * 60 * 1000;

  // Conservative Gemini Free Tier Limits
  private readonly LIMITS = {
    requestsPerMinute: 10, // Very conservative (actual: 15)
    tokensPerMinute: 800, // Conservative for input tokens
    requestsPerDay: 1000, // Conservative (actual: 1500)
  };

  canMakeRequest(estimatedTokens: number = 100): {
    allowed: boolean;
    reason?: string;
    waitTime?: number;
  } {
    const now = Date.now();

    // Reset daily counter
    if (now - this.lastDailyReset >= this.DAY_MS) {
      this.dailyRequestCount = 0;
      this.lastDailyReset = now;
    }

    // Check daily limit
    if (this.dailyRequestCount >= this.LIMITS.requestsPerDay) {
      return {
        allowed: false,
        reason: 'Daily request limit exceeded',
        waitTime: this.DAY_MS - (now - this.lastDailyReset),
      };
    }

    // Reset minute counters
    const requestKey = 'requests_per_minute';
    const tokenKey = 'tokens_per_minute';

    const lastRequestReset = this.lastResetTime.get(requestKey) || 0;
    const lastTokenReset = this.lastResetTime.get(tokenKey) || 0;

    if (now - lastRequestReset >= this.MINUTE_MS) {
      this.requestCounts.set(requestKey, 0);
      this.lastResetTime.set(requestKey, now);
    }

    if (now - lastTokenReset >= this.MINUTE_MS) {
      this.tokenCounts.set(tokenKey, 0);
      this.lastResetTime.set(tokenKey, now);
    }

    const currentRequests = this.requestCounts.get(requestKey) || 0;
    const currentTokens = this.tokenCounts.get(tokenKey) || 0;

    // Check per-minute request limit
    if (currentRequests >= this.LIMITS.requestsPerMinute) {
      const waitTime = this.MINUTE_MS - (now - lastRequestReset);
      return {
        allowed: false,
        reason: 'Per-minute request limit exceeded',
        waitTime,
      };
    }

    // Check per-minute token limit
    if (currentTokens + estimatedTokens > this.LIMITS.tokensPerMinute) {
      const waitTime = this.MINUTE_MS - (now - lastTokenReset);
      return {
        allowed: false,
        reason: 'Per-minute token limit exceeded',
        waitTime,
      };
    }

    return { allowed: true };
  }

  recordRequest(tokensUsed: number = 100): void {
    const requestKey = 'requests_per_minute';
    const tokenKey = 'tokens_per_minute';

    const currentRequests = this.requestCounts.get(requestKey) || 0;
    const currentTokens = this.tokenCounts.get(tokenKey) || 0;

    this.requestCounts.set(requestKey, currentRequests + 1);
    this.tokenCounts.set(tokenKey, currentTokens + tokensUsed);
    this.dailyRequestCount++;
  }

  getStatus() {
    const now = Date.now();
    const requestKey = 'requests_per_minute';
    const tokenKey = 'tokens_per_minute';

    return {
      requestsThisMinute: this.requestCounts.get(requestKey) || 0,
      tokensThisMinute: this.tokenCounts.get(tokenKey) || 0,
      requestsToday: this.dailyRequestCount,
      limits: this.LIMITS,
    };
  }
}

class SimpleCache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, value: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      response: value,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.response;
  }

  clear(): void {
    this.cache.clear();
  }

  private generateKey(input: string, type: string): string {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${type}_${Math.abs(hash)}`;
  }

  getCacheKey(input: string, type: string): string {
    return this.generateKey(input.substring(0, 200), type); // Limit input length for key
  }
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly geminiClient: GoogleGenerativeAI;
  private readonly rateLimitManager = new GeminiRateLimitManager();
  private readonly cache = new SimpleCache();
  private readonly model: string;
  private readonly embeddingModel: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly topP: number;
  private readonly topK: number;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    const apiKey = this.configService.get('app.gemini.apiKey', { infer: true });
    if (!apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    this.geminiClient = new GoogleGenerativeAI(apiKey);

    // Use Flash model for better rate limits and lower cost
    this.model =
      this.configService.get('app.gemini.model', { infer: true }) ||
      'gemini-1.5-flash';
    this.embeddingModel =
      this.configService.get('app.gemini.embeddingModel', { infer: true }) ||
      'text-embedding-004';
    this.temperature =
      this.configService.get('app.gemini.temperature', { infer: true }) || 0.7;
    this.maxTokens =
      this.configService.get('app.gemini.maxTokens', { infer: true }) || 500; // Reduced for free tier
    this.topP =
      this.configService.get('app.gemini.topP', { infer: true }) || 0.95;
    this.topK =
      this.configService.get('app.gemini.topK', { infer: true }) || 40;

    this.logger.log(`Gemini AI Service initialized with model: ${this.model}`);
  }

  async generateResponse(
    prompt: string,
    conversationHistory?: ChatMessage[],
    customOptions?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
      topP?: number;
      topK?: number;
      useCache?: boolean;
    },
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const useCache = customOptions?.useCache !== false;

    try {
      // Check cache first
      if (useCache) {
        const cacheKey = this.cache.getCacheKey(prompt, 'response');
        const cachedResponse = this.cache.get(cacheKey);
        if (cachedResponse) {
          this.logger.log('Returning cached response');
          return {
            ...cachedResponse,
            fromCache: true,
            processingTime: Date.now() - startTime,
          };
        }
      }

      // Estimate token usage
      const estimatedTokens =
        this.estimateTokenCount(prompt) +
        (conversationHistory?.length || 0) * 50;

      // Check rate limits
      const rateLimitCheck =
        this.rateLimitManager.canMakeRequest(estimatedTokens);

      if (!rateLimitCheck.allowed) {
        this.logger.warn(`Rate limit exceeded: ${rateLimitCheck.reason}`);
        return this.getRateLimitResponse(rateLimitCheck, startTime);
      }

      const modelName = customOptions?.model || this.model;
      const generativeModel: GenerativeModel =
        this.geminiClient.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: customOptions?.temperature || this.temperature,
            maxOutputTokens: Math.min(
              customOptions?.maxTokens || this.maxTokens,
              500,
            ),
            topP: customOptions?.topP || this.topP,
            topK: customOptions?.topK || this.topK,
          },
          systemInstruction: this.getSystemPrompt(),
        });

      // Optimize prompt to reduce token usage
      let optimizedPrompt = this.optimizePrompt(prompt);

      if (conversationHistory && conversationHistory.length > 0) {
        // Limit conversation history to last 2 exchanges to save tokens
        const recentHistory = conversationHistory
          .filter((msg) => msg.role !== 'system')
          .slice(-2)
          .map(
            (msg) =>
              `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 200)}`,
          )
          .join('\n');
        optimizedPrompt = `${recentHistory}\nUser: ${optimizedPrompt}`;
      }

      this.logger.log(
        `Generating response for prompt: ${prompt.substring(0, 100)}...`,
      );

      const result = await generativeModel.generateContent(optimizedPrompt);
      const response = await result.response;
      const content = response.text();

      const processingTime = Date.now() - startTime;
      const tokensUsed = this.estimateTokenCount(content + optimizedPrompt);

      // Record the request
      this.rateLimitManager.recordRequest(tokensUsed);

      const aiResponse: AIResponse = {
        content,
        tokensUsed,
        processingTime,
        model: modelName,
        fromCache: false,
      };

      // Cache the response
      if (useCache) {
        const cacheKey = this.cache.getCacheKey(prompt, 'response');
        this.cache.set(cacheKey, aiResponse, 5 * 60 * 1000); // 5 minutes cache
      }

      this.logger.log(
        `Response generated in ${processingTime}ms using ${tokensUsed} tokens`,
      );

      return aiResponse;
    } catch (error) {
      this.logger.error('Error generating response:', error);

      if (this.isRateLimitError(error)) {
        return this.getRateLimitResponse(
          {
            allowed: false,
            reason: 'API rate limit exceeded',
            waitTime: 60000,
          },
          startTime,
        );
      }

      return this.getFallbackResponse(prompt, startTime);
    }
  }

  private optimizePrompt(prompt: string): string {
    // Truncate very long prompts to save tokens
    if (prompt.length > 1000) {
      return prompt.substring(0, 1000) + '...';
    }
    return prompt;
  }

  private getRateLimitResponse(
    rateLimitInfo: any,
    startTime: number,
  ): AIResponse {
    const waitMinutes = Math.ceil((rateLimitInfo.waitTime || 60000) / 60000);
    const content = `I'm currently managing my response rate to provide the best service. Please wait about ${waitMinutes} minute(s) before trying again, or try a shorter, more specific question.`;

    return {
      content,
      tokensUsed: this.estimateTokenCount(content),
      processingTime: Date.now() - startTime,
      model: 'rate-limited',
      confidence: 0.5,
    };
  }

  private getFallbackResponse(prompt: string, startTime: number): AIResponse {
    const processingTime = Date.now() - startTime;

    // Intelligent fallback based on prompt keywords
    const lowerPrompt = prompt.toLowerCase();

    let content =
      "I apologize, but I'm currently experiencing technical difficulties. Please try again in a moment.";

    if (
      lowerPrompt.includes('hello') ||
      lowerPrompt.includes('hi') ||
      lowerPrompt.includes('hey')
    ) {
      content =
        "Hello! I'm here to help you with your shopping needs. How can I assist you today?";
    } else if (
      lowerPrompt.includes('product') ||
      lowerPrompt.includes('search') ||
      lowerPrompt.includes('find')
    ) {
      content =
        "I'd be happy to help you find products. Could you please be more specific about what you're looking for?";
    } else if (
      lowerPrompt.includes('price') ||
      lowerPrompt.includes('cost') ||
      lowerPrompt.includes('$')
    ) {
      content =
        "I can help you with pricing information. Could you specify which product you're interested in?";
    } else if (
      lowerPrompt.includes('help') ||
      lowerPrompt.includes('support')
    ) {
      content =
        "I'm here to help! Please let me know what specific assistance you need, and I'll do my best to help you.";
    } else if (
      lowerPrompt.includes('recommend') ||
      lowerPrompt.includes('suggest')
    ) {
      content =
        "I'd love to help you find the perfect product! Could you tell me more about your preferences or what you're shopping for?";
    }

    return {
      content,
      tokensUsed: this.estimateTokenCount(content),
      processingTime,
      model: 'fallback',
      confidence: 0.4,
    };
  }

  async generateEmbedding(
    text: string,
    customModel?: string,
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.cache.getCacheKey(text, 'embedding');
      const cachedEmbedding = this.cache.get(cacheKey);
      if (cachedEmbedding) {
        this.logger.log('Returning cached embedding');
        return cachedEmbedding;
      }

      // Check rate limits
      const estimatedTokens = this.estimateTokenCount(text);
      const rateLimitCheck =
        this.rateLimitManager.canMakeRequest(estimatedTokens);

      if (!rateLimitCheck.allowed) {
        this.logger.warn('Rate limit exceeded for embedding generation');
        throw new Error('Rate limit exceeded');
      }

      const modelName = customModel || this.embeddingModel;
      const embeddingModel = this.geminiClient.getGenerativeModel({
        model: modelName,
      });

      // Truncate text if too long
      const truncatedText = text.substring(0, 1000);

      const result = await embeddingModel.embedContent(truncatedText);
      const embedding = result.embedding;

      if (!embedding || !embedding.values || embedding.values.length === 0) {
        throw new Error('Failed to generate embedding: empty vector received');
      }

      const processingTime = Date.now() - startTime;
      this.rateLimitManager.recordRequest(estimatedTokens);

      const embeddingResult: EmbeddingResult = {
        vector: embedding.values,
        dimensions: embedding.values.length,
        model: modelName,
        processingTime,
      };

      // Cache the embedding
      this.cache.set(cacheKey, embeddingResult, 30 * 60 * 1000); // 30 minutes cache

      this.logger.log(
        `Embedding generated in ${processingTime}ms with ${embedding.values.length} dimensions`,
      );

      return embeddingResult;
    } catch (error) {
      this.logger.error('Error generating embedding:', error);

      // Return a simple fallback embedding
      const fallbackVector = new Array(768)
        .fill(0)
        .map(() => Math.random() - 0.5);
      return {
        vector: fallbackVector,
        dimensions: fallbackVector.length,
        model: 'fallback',
        processingTime: Date.now() - startTime,
      };
    }
  }

  async classifyIntent(
    text: string,
    customIntents?: string[],
  ): Promise<IntentClassification> {
    try {
      // Simple, token-efficient intent classification
      const shortPrompt = `Intent for "${text.substring(0, 100)}"? Options: ${this.getDefaultIntents().slice(0, 7).join(', ')}. Answer with one word.`;

      const response = await this.generateResponse(shortPrompt, undefined, {
        maxTokens: 20,
        useCache: true,
      });

      const intent = response.content.trim().toUpperCase();
      const validIntents = this.getDefaultIntents();
      const finalIntent = validIntents.includes(intent) ? intent : 'OTHER';

      return {
        intent: finalIntent,
        confidence: response.fromCache ? 0.9 : 0.8,
        entities: [],
        metadata: {
          processingTime: response.processingTime,
          originalText: text,
          fromCache: response.fromCache,
        },
      };
    } catch (error) {
      this.logger.error('Error classifying intent:', error);
      return {
        intent: 'OTHER',
        confidence: 0.3,
        entities: [],
        metadata: { error: error.message, originalText: text },
      };
    }
  }

  extractEntities(
    text: string,
    customEntityTypes?: string[],
  ): ExtractedEntity[] {
    try {
      // Use pattern matching for basic entity extraction to save tokens
      const entities: ExtractedEntity[] = [];

      // Price patterns
      const priceMatches = text.match(/\$[\d,]+\.?\d*/g);
      if (priceMatches) {
        priceMatches.forEach((match) => {
          const startIndex = text.indexOf(match);
          entities.push({
            text: match,
            type: 'PRICE',
            confidence: 0.9,
            startIndex,
            endIndex: startIndex + match.length,
            metadata: { extractionMethod: 'regex' },
          });
        });
      }

      // Product/brand patterns (simple capitalized words)
      const productMatches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
      if (productMatches) {
        productMatches.slice(0, 3).forEach((match) => {
          // Limit to 3 to avoid noise
          const startIndex = text.indexOf(match);
          entities.push({
            text: match,
            type: 'PRODUCT',
            confidence: 0.6,
            startIndex,
            endIndex: startIndex + match.length,
            metadata: { extractionMethod: 'regex' },
          });
        });
      }

      return entities;
    } catch (error) {
      this.logger.error('Error extracting entities:', error);
      return [];
    }
  }

  async summarizeText(
    text: string,
    maxSentences?: number,
  ): Promise<TextSummary> {
    try {
      const shortPrompt = `Summarize in ${maxSentences || 2} sentences: "${text.substring(0, 300)}"`;

      const response = await this.generateResponse(shortPrompt, undefined, {
        maxTokens: 100,
        useCache: true,
      });

      return {
        summary: response.content,
        keyPoints: [response.content],
        sentiment: 'neutral',
        confidence: response.fromCache ? 0.9 : 0.7,
      };
    } catch (error) {
      this.logger.error('Error summarizing text:', error);
      return {
        summary: text.substring(0, 200) + '...',
        keyPoints: [],
        sentiment: 'neutral',
        confidence: 0.3,
      };
    }
  }

  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
  ): Promise<{
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    confidence: number;
  }> {
    try {
      const shortPrompt = `Translate to ${targetLanguage}: "${text.substring(0, 200)}"`;

      const response = await this.generateResponse(shortPrompt, undefined, {
        maxTokens: Math.min(200, text.length * 2),
        useCache: true,
      });

      return {
        translatedText: response.content,
        sourceLanguage: sourceLanguage || 'auto-detected',
        targetLanguage,
        confidence: response.fromCache ? 0.9 : 0.7,
      };
    } catch (error) {
      this.logger.error('Error translating text:', error);
      return {
        translatedText: text,
        sourceLanguage: sourceLanguage || 'unknown',
        targetLanguage,
        confidence: 0.3,
      };
    }
  }

  async generateSuggestions(
    context: string,
    numberOfSuggestions: number = 3,
  ): Promise<string[]> {
    try {
      const shortPrompt = `3 short questions about: "${context.substring(0, 100)}"`;

      const response = await this.generateResponse(shortPrompt, undefined, {
        maxTokens: 80,
        useCache: true,
      });

      const suggestions = response.content
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => line.replace(/^\d+\.?\s*/, '').trim())
        .filter((suggestion) => suggestion.length > 0)
        .slice(0, numberOfSuggestions);

      return suggestions.length > 0
        ? suggestions
        : [
            'Can you tell me more?',
            'Would you like recommendations?',
            'Do you need help with anything else?',
          ];
    } catch (error) {
      this.logger.error('Error generating suggestions:', error);
      return [
        'How can I help you further?',
        'Would you like product recommendations?',
        'Do you have other questions?',
      ];
    }
  }

  async analyzeQuery(query: string): Promise<{
    intent: IntentClassification;
    entities: ExtractedEntity[];
    suggestions: string[];
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      this.logger.log(`Analyzing query: ${query.substring(0, 100)}...`);

      // Execute in sequence with delays to respect rate limits
      const intent = await this.classifyIntent(query);

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));

      const entities = await this.extractEntities(query);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const suggestions = await this.generateSuggestions(query, 3);

      const processingTime = Date.now() - startTime;

      this.logger.log(`Query analyzed in ${processingTime}ms`);

      return {
        intent,
        entities,
        suggestions,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error analyzing query:', error);

      return {
        intent: {
          intent: 'OTHER',
          confidence: 0.3,
          entities: [],
          metadata: { error: error.message },
        },
        entities: [],
        suggestions: ['How can I help you?'],
        processingTime: Date.now() - startTime,
      };
    }
  }

  async generateContextualResponse(
    query: string,
    context: string[],
    conversationHistory?: ChatMessage[],
  ): Promise<AIResponse> {
    try {
      // Optimize context to reduce token usage
      const limitedContext = context
        .slice(0, 2)
        .map((ctx) => ctx.substring(0, 100))
        .join(' | ');
      const contextSection = limitedContext
        ? `Context: ${limitedContext}\n\n`
        : '';

      const enhancedPrompt = `${contextSection}User: ${query}`;

      return await this.generateResponse(
        enhancedPrompt,
        conversationHistory?.slice(-1), // Only keep last exchange
        { useCache: true },
      );
    } catch (error) {
      this.logger.error('Error generating contextual response:', error);
      throw new Error(
        `Failed to generate contextual response: ${error.message}`,
      );
    }
  }

  // Utility methods
  getRateLimitStatus() {
    return this.rateLimitManager.getStatus();
  }

  clearCache() {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }

  private isRateLimitError(error: any): boolean {
    return (
      error?.status === 429 ||
      error?.message?.includes('rate limit') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('Too Many Requests')
    );
  }

  private getSystemPrompt(): string {
    return `You are a helpful e-commerce assistant. Be concise and helpful.`;
  }

  private getDefaultIntents(): string[] {
    return [
      'PRODUCT_SEARCH',
      'PRICE_INQUIRY',
      'RECOMMENDATION',
      'SUPPORT',
      'GREETING',
      'ORDER_STATUS',
      'OTHER',
    ];
  }

  private getDefaultEntityTypes(): string[] {
    return ['PRODUCT', 'CATEGORY', 'BRAND', 'PRICE', 'FEATURE', 'LOCATION'];
  }

  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
