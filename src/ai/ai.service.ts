/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import axios, { AxiosInstance } from 'axios';
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
  provider: 'gemini' | 'ollama';
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
  provider: 'gemini' | 'ollama';
  processingTime: number;
}

// Ollama-specific interfaces
export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  context?: number[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
    seed?: number;
    num_ctx?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaEmbedRequest {
  model: string;
  prompt: string;
}

export interface OllamaEmbedResponse {
  embedding: number[];
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
  private readonly ollamaClient: AxiosInstance;
  private readonly rateLimitManager = new GeminiRateLimitManager();
  private readonly cache = new SimpleCache();

  // Configuration
  private readonly preferredProvider: 'gemini' | 'ollama';
  private readonly ollamaBaseUrl: string;
  private readonly geminiModel: string;
  private readonly geminiEmbeddingModel: string;
  private readonly ollamaChatModel: string;
  private readonly ollamaEmbeddingModel: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly topP: number;
  private readonly topK: number;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    // Initialize Gemini
    const geminiApiKey = this.configService.get('app.gemini.apiKey', {
      infer: true,
    });
    if (geminiApiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiApiKey);
    }

    // Initialize Ollama
    this.ollamaBaseUrl =
      this.configService.get('app.ollama.baseUrl', { infer: true }) ||
      'http://localhost:11434';
    this.ollamaClient = axios.create({
      baseURL: this.ollamaBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Model configuration
    this.preferredProvider =
      this.configService.get('app.ai.preferredProvider', { infer: true }) ||
      'ollama';
    this.geminiModel =
      this.configService.get('app.gemini.model', { infer: true }) ||
      'gemini-1.5-flash';
    this.geminiEmbeddingModel =
      this.configService.get('app.gemini.embeddingModel', { infer: true }) ||
      'text-embedding-004';
    this.ollamaChatModel =
      this.configService.get('app.ollama.chatModel', { infer: true }) ||
      'llama3.2:latest';
    this.ollamaEmbeddingModel =
      this.configService.get('app.ollama.embeddingModel', { infer: true }) ||
      'nomic-embed-text:latest';

    // Generation parameters
    this.temperature =
      this.configService.get('app.gemini.temperature', { infer: true }) || 0.7;
    this.maxTokens =
      this.configService.get('app.gemini.maxTokens', { infer: true }) || 500;
    this.topP =
      this.configService.get('app.gemini.topP', { infer: true }) || 0.95;
    this.topK =
      this.configService.get('app.gemini.topK', { infer: true }) || 40;

    this.logger.log(
      `AI Service initialized with preferred provider: ${this.preferredProvider}`,
    );
    this.logger.log(
      `Ollama models: Chat=${this.ollamaChatModel}, Embedding=${this.ollamaEmbeddingModel}`,
    );
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
      provider?: 'gemini' | 'ollama' | 'auto';
    },
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const useCache = customOptions?.useCache !== false;
    const provider = customOptions?.provider || this.preferredProvider;

    try {
      // Check cache first
      if (useCache) {
        const cacheKey = this.cache.getCacheKey(
          `${provider}_${prompt}`,
          'response',
        );
        const cachedResponse = this.cache.get(cacheKey);
        if (cachedResponse) {
          this.logger.log(`Returning cached response from ${provider}`);
          return {
            ...cachedResponse,
            fromCache: true,
            processingTime: Date.now() - startTime,
          };
        }
      }

      let response: AIResponse;

      // Determine which provider to use
      if (provider === 'auto') {
        // Try Ollama first (local), fallback to Gemini
        try {
          response = await this.generateOllamaResponse(
            prompt,
            conversationHistory,
            customOptions,
            startTime,
          );
        } catch (error) {
          this.logger.warn(
            'Ollama failed, falling back to Gemini:',
            error.message,
          );
          response = await this.generateGeminiResponse(
            prompt,
            conversationHistory,
            customOptions,
            startTime,
          );
        }
      } else if (provider === 'ollama') {
        response = await this.generateOllamaResponse(
          prompt,
          conversationHistory,
          customOptions,
          startTime,
        );
      } else {
        response = await this.generateGeminiResponse(
          prompt,
          conversationHistory,
          customOptions,
          startTime,
        );
      }

      // FIX: Ensure response.content is never undefined
      if (!response.content || typeof response.content !== 'string') {
        this.logger.warn('Generated response has empty or invalid content');
        response = this.getFallbackResponse(prompt, startTime);
      }

      // Cache the response
      if (useCache) {
        const cacheKey = this.cache.getCacheKey(
          `${provider}_${prompt}`,
          'response',
        );
        this.cache.set(cacheKey, response, 5 * 60 * 1000); // 5 minutes cache
      }

      return response;
    } catch (error) {
      this.logger.error(`Error generating response with ${provider}:`, error);
      return this.getFallbackResponse(prompt, startTime);
    }
  }

  private async generateOllamaResponse(
    prompt: string,
    conversationHistory?: ChatMessage[],
    customOptions?: any,
    startTime?: number,
  ): Promise<AIResponse> {
    const requestStartTime = startTime || Date.now();

    try {
      this.logger.log(
        `Starting Ollama generation for prompt: "${prompt.substring(0, 100)}..."`,
      );

      // Check if Ollama is available
      await this.checkOllamaHealth();

      // Build conversation context for Llama
      const fullPrompt = this.buildOllamaPrompt(prompt, conversationHistory);

      this.logger.log(`Full prompt length: ${fullPrompt.length} characters`);

      const ollamaRequest: OllamaGenerateRequest = {
        model: customOptions?.model || this.ollamaChatModel,
        prompt: fullPrompt,
        stream: false, // IMPORTANT: Disable streaming to get complete response
        options: {
          temperature: customOptions?.temperature || this.temperature,
          top_p: customOptions?.topP || this.topP,
          top_k: customOptions?.topK || this.topK,
          num_ctx: Math.min(customOptions?.maxTokens || this.maxTokens, 4096),
        },
      };

      this.logger.log(
        `Sending NON-STREAMING request to Ollama with model: ${ollamaRequest.model}`,
      );
      this.logger.log(
        `Request options: ${JSON.stringify(ollamaRequest.options, null, 2)}`,
      );

      const response = await this.ollamaClient.post<OllamaGenerateResponse>(
        '/api/generate',
        ollamaRequest,
        { timeout: 30000 }, // 30 second timeout
      );

      const ollamaResponse = response.data;

      this.logger.log(
        `Ollama response received. Status: ${ollamaResponse.done ? 'completed' : 'incomplete'}`,
      );
      this.logger.log(
        `Raw response object:`,
        JSON.stringify(ollamaResponse, null, 2),
      );

      const processingTime = Date.now() - requestStartTime;
      const tokensUsed =
        (ollamaResponse.eval_count || 0) +
        (ollamaResponse.prompt_eval_count || 0);

      this.logger.log(
        `Ollama metrics - Processing time: ${processingTime}ms, Tokens used: ${tokensUsed}`,
      );

      // Enhanced content validation with detailed logging
      const content = ollamaResponse.response?.trim() || '';

      this.logger.log(`Response content length: ${content.length}`);
      if (content.length > 0) {
        this.logger.log(`Response preview: "${content.substring(0, 200)}..."`);
      } else {
        this.logger.warn('Response content is empty or undefined');
        this.logger.warn(`Raw response field: "${ollamaResponse.response}"`);
      }

      if (!content || content.length === 0) {
        this.logger.warn('Ollama returned empty or null response');
        return this.getFallbackResponse(prompt, requestStartTime);
      }

      // Check for common Ollama error responses
      if (this.isOllamaErrorResponse(content)) {
        this.logger.warn(`Ollama returned error response: "${content}"`);
        return this.getFallbackResponse(prompt, requestStartTime);
      }

      this.logger.log('Ollama generation completed successfully');

      return {
        content,
        tokensUsed,
        processingTime,
        model: ollamaRequest.model,
        provider: 'ollama',
        fromCache: false,
      };
    } catch (error) {
      this.logger.error('Ollama generation failed with error:', error);
      this.logger.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      });

      // Return intelligent fallback instead of throwing
      this.logger.warn('Using intelligent fallback due to Ollama failure');
      return this.getFallbackResponse(prompt, requestStartTime);
    }
  }

  private async generateGeminiResponse(
    prompt: string,
    conversationHistory?: ChatMessage[],
    customOptions?: any,
    startTime?: number,
  ): Promise<AIResponse> {
    if (!this.geminiClient) {
      throw new Error('Gemini client not initialized - API key missing');
    }

    // Estimate token usage
    const estimatedTokens =
      this.estimateTokenCount(prompt) + (conversationHistory?.length || 0) * 50;

    // Check rate limits
    const rateLimitCheck =
      this.rateLimitManager.canMakeRequest(estimatedTokens);

    if (!rateLimitCheck.allowed) {
      this.logger.warn(`Gemini rate limit exceeded: ${rateLimitCheck.reason}`);
      return this.getRateLimitResponse(rateLimitCheck, startTime || Date.now());
    }

    const modelName = customOptions?.model || this.geminiModel;
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
      `Generating Gemini response for prompt: ${prompt.substring(0, 100)}...`,
    );

    const result = await generativeModel.generateContent(optimizedPrompt);
    const response = await result.response;
    const content = response.text();

    const processingTime = startTime ? Date.now() - startTime : 0;
    const tokensUsed = this.estimateTokenCount(content + optimizedPrompt);

    // Record the request
    this.rateLimitManager.recordRequest(tokensUsed);

    this.logger.log(
      `Gemini response generated in ${processingTime}ms using ${tokensUsed} tokens`,
    );

    return {
      content,
      tokensUsed,
      processingTime,
      model: modelName,
      provider: 'gemini',
      fromCache: false,
    };
  }

  async generateEmbedding(
    text: string,
    customOptions?: {
      model?: string;
      provider?: 'gemini' | 'ollama' | 'auto';
    },
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const provider = customOptions?.provider || this.preferredProvider;

    try {
      // Check cache first
      const cacheKey = this.cache.getCacheKey(
        `${provider}_${text}`,
        'embedding',
      );
      const cachedEmbedding = this.cache.get(cacheKey);
      if (cachedEmbedding) {
        this.logger.log(`Returning cached embedding from ${provider}`);
        return cachedEmbedding;
      }

      let result: EmbeddingResult;

      if (provider === 'auto') {
        // Try Ollama first, fallback to Gemini
        try {
          result = await this.generateOllamaEmbedding(
            text,
            customOptions?.model,
          );
        } catch (error) {
          this.logger.warn(
            'Ollama embedding failed, falling back to Gemini:',
            error.message,
          );
          result = await this.generateGeminiEmbedding(
            text,
            customOptions?.model,
          );
        }
      } else if (provider === 'ollama') {
        result = await this.generateOllamaEmbedding(text, customOptions?.model);
      } else {
        result = await this.generateGeminiEmbedding(text, customOptions?.model);
      }

      // Cache the embedding
      this.cache.set(cacheKey, result, 30 * 60 * 1000); // 30 minutes cache

      return result;
    } catch (error) {
      this.logger.error(`Error generating embedding with ${provider}:`, error);

      // Return a fallback embedding
      const fallbackVector = new Array(768)
        .fill(0)
        .map(() => Math.random() - 0.5);
      return {
        vector: fallbackVector,
        dimensions: fallbackVector.length,
        model: 'fallback',
        provider: 'ollama',
        processingTime: Date.now() - startTime,
      };
    }
  }

  private async generateOllamaEmbedding(
    text: string,
    customModel?: string,
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();

    try {
      await this.checkOllamaHealth();

      const model = customModel || this.ollamaEmbeddingModel;
      const truncatedText = text.substring(0, 1000); // Limit text length

      const request: OllamaEmbedRequest = {
        model,
        prompt: truncatedText,
      };

      this.logger.log(`Generating Ollama embedding with model: ${model}`);

      const response = await this.ollamaClient.post<OllamaEmbedResponse>(
        '/api/embeddings',
        request,
      );
      const ollamaResponse = response.data;

      if (!ollamaResponse.embedding || ollamaResponse.embedding.length === 0) {
        throw new Error('Failed to generate embedding: empty vector received');
      }

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Ollama embedding generated in ${processingTime}ms with ${ollamaResponse.embedding.length} dimensions`,
      );

      return {
        vector: ollamaResponse.embedding,
        dimensions: ollamaResponse.embedding.length,
        model,
        provider: 'ollama',
        processingTime,
      };
    } catch (error) {
      this.logger.error('Ollama embedding generation failed:', error);
      throw new Error(`Ollama embedding failed: ${error.message}`);
    }
  }

  private async generateGeminiEmbedding(
    text: string,
    customModel?: string,
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();

    if (!this.geminiClient) {
      throw new Error('Gemini client not initialized - API key missing');
    }

    try {
      // Check rate limits
      const estimatedTokens = this.estimateTokenCount(text);
      const rateLimitCheck =
        this.rateLimitManager.canMakeRequest(estimatedTokens);

      if (!rateLimitCheck.allowed) {
        this.logger.warn('Rate limit exceeded for Gemini embedding generation');
        throw new Error('Rate limit exceeded');
      }

      const modelName = customModel || this.geminiEmbeddingModel;
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

      this.logger.log(
        `Gemini embedding generated in ${processingTime}ms with ${embedding.values.length} dimensions`,
      );

      return {
        vector: embedding.values,
        dimensions: embedding.values.length,
        model: modelName,
        provider: 'gemini',
        processingTime,
      };
    } catch (error) {
      this.logger.error('Gemini embedding generation failed:', error);
      throw new Error(`Gemini embedding failed: ${error.message}`);
    }
  }

  // Ollama utility methods
  private async checkOllamaHealth(): Promise<void> {
    try {
      await this.ollamaClient.get('/api/tags');
    } catch (error) {
      throw new Error(
        `Ollama is not available at ${this.ollamaBaseUrl}. Please ensure Ollama is running.`,
      );
    }
  }

  async listOllamaModels(): Promise<{
    models: Array<{ name: string; size: number; digest: string }>;
  }> {
    try {
      const response = await this.ollamaClient.get('/api/tags');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to list Ollama models:', error);
      throw new Error(`Failed to list Ollama models: ${error.message}`);
    }
  }

  async checkOllamaModelExists(modelName: string): Promise<boolean> {
    try {
      const models = await this.listOllamaModels();
      return models.models.some((model) => model.name.includes(modelName));
    } catch (error) {
      this.logger.error(`Failed to check if model ${modelName} exists:`, error);
      return false;
    }
  }

  async pullOllamaModel(modelName: string): Promise<void> {
    try {
      this.logger.log(`Pulling Ollama model: ${modelName}`);
      await this.ollamaClient.post('/api/pull', { name: modelName });
      this.logger.log(`Successfully pulled model: ${modelName}`);
    } catch (error) {
      this.logger.error(`Failed to pull model ${modelName}:`, error);
      throw new Error(`Failed to pull model ${modelName}: ${error.message}`);
    }
  }

  private buildOllamaPrompt(
    prompt: string,
    conversationHistory?: ChatMessage[],
  ): string {
    let fullPrompt = this.getSystemPrompt() + '\n\n';

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      fullPrompt += 'Previous conversation:\n';
      conversationHistory.slice(-5).forEach((msg) => {
        // Keep last 5 messages
        if (msg.role !== 'system') {
          fullPrompt += `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}\n`;
        }
      });
      fullPrompt += '\n';
    }

    // Add current prompt
    fullPrompt += `Human: ${prompt}\n\nAssistant: `;

    return fullPrompt;
  }

  // Enhanced utility methods with provider support
  async classifyIntent(
    text: string,
    customIntents?: string[],
    provider?: 'gemini' | 'ollama' | 'auto',
  ): Promise<IntentClassification> {
    try {
      const shortPrompt = `Intent for "${text.substring(0, 100)}"? Options: ${this.getDefaultIntents().slice(0, 7).join(', ')}. Answer with one word.`;

      const response = await this.generateResponse(shortPrompt, undefined, {
        maxTokens: 20,
        useCache: true,
        provider: provider || this.preferredProvider,
      });

      // FIX: Check if response.content exists and is not empty
      if (!response.content || typeof response.content !== 'string') {
        this.logger.warn('Empty or invalid response content in classifyIntent');
        return {
          intent: 'OTHER',
          confidence: 0.3,
          entities: [],
          metadata: {
            error: 'Empty response content',
            originalText: text,
          },
        };
      }

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
          provider: response.provider,
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

  async generateContextualResponse(
    query: string,
    context: string[],
    conversationHistory?: ChatMessage[],
    provider?: 'gemini' | 'ollama' | 'auto',
  ): Promise<AIResponse> {
    try {
      // Optimize context to reduce token usage
      const limitedContext = context
        .slice(0, 3) // Increased context for better RAG
        .map((ctx) => ctx.substring(0, 200))
        .join(' | ');
      const contextSection = limitedContext
        ? `Context: ${limitedContext}\n\n`
        : '';

      const enhancedPrompt = `${contextSection}User: ${query}`;

      return await this.generateResponse(
        enhancedPrompt,
        conversationHistory?.slice(-2), // Keep last 2 exchanges
        {
          useCache: true,
          provider: provider || this.preferredProvider,
        },
      );
    } catch (error) {
      this.logger.error('Error generating contextual response:', error);
      throw new Error(
        `Failed to generate contextual response: ${error.message}`,
      );
    }
  }

  // System status and debugging
  async getSystemStatus(): Promise<{
    providers: {
      gemini: {
        available: boolean;
        rateLimitStatus?: {
          requestsThisMinute: number;
          tokensThisMinute: number;
          requestsToday: number;
          limits: {
            requestsPerMinute: number;
            tokensPerMinute: number;
            requestsPerDay: number;
          };
        };
      };
      ollama: {
        available: boolean;
        models?: {
          models: Array<{
            name: string;
            size: number;
            digest: string;
          }>;
        };
      };
    };
    preferredProvider: string;
    cache: { size: number };
  }> {
    const status: {
      providers: {
        gemini: {
          available: boolean;
          rateLimitStatus?: {
            requestsThisMinute: number;
            tokensThisMinute: number;
            requestsToday: number;
            limits: {
              requestsPerMinute: number;
              tokensPerMinute: number;
              requestsPerDay: number;
            };
          };
        };
        ollama: {
          available: boolean;
          models?: {
            models: Array<{
              name: string;
              size: number;
              digest: string;
            }>;
          };
        };
      };
      preferredProvider: string;
      cache: { size: number };
    } = {
      providers: {
        gemini: { available: false },
        ollama: { available: false },
      },
      preferredProvider: this.preferredProvider,
      cache: { size: this.cache['cache'].size },
    };

    // Check Gemini
    try {
      if (this.geminiClient) {
        status.providers.gemini.available = true;
        status.providers.gemini.rateLimitStatus =
          this.rateLimitManager.getStatus();
      }
    } catch (error) {
      this.logger.warn('Gemini status check failed:', error);
    }

    // Check Ollama
    try {
      await this.checkOllamaHealth();
      status.providers.ollama.available = true;
      status.providers.ollama.models = await this.listOllamaModels();
    } catch (error) {
      this.logger.warn('Ollama status check failed:', error);
    }

    return status;
  }

  // Existing methods remain the same...
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
    provider?: 'gemini' | 'ollama' | 'auto',
  ): Promise<TextSummary> {
    try {
      const shortPrompt = `Summarize in ${maxSentences || 2} sentences: "${text.substring(0, 300)}"`;

      const response = await this.generateResponse(shortPrompt, undefined, {
        maxTokens: 100,
        useCache: true,
        provider: provider || this.preferredProvider,
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
    provider?: 'gemini' | 'ollama' | 'auto',
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
        provider: provider || this.preferredProvider,
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
    provider?: 'gemini' | 'ollama' | 'auto',
  ): Promise<string[]> {
    try {
      const shortPrompt = `3 short questions about: "${context.substring(0, 100)}"`;

      const response = await this.generateResponse(shortPrompt, undefined, {
        maxTokens: 80,
        useCache: true,
        provider: provider || this.preferredProvider,
      });

      // FIX: Check if response.content exists and is not empty
      if (!response.content || typeof response.content !== 'string') {
        this.logger.warn(
          'Empty or invalid response content in generateSuggestions',
        );
        return [
          'How can I help you further?',
          'Would you like product recommendations?',
          'Do you have other questions?',
        ];
      }

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

  async analyzeQuery(
    query: string,
    provider?: 'gemini' | 'ollama' | 'auto',
  ): Promise<{
    intent: IntentClassification;
    entities: ExtractedEntity[];
    suggestions: string[];
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      this.logger.log(`Analyzing query: ${query.substring(0, 100)}...`);

      // Execute in sequence with delays to respect rate limits (only for Gemini)
      const selectedProvider = provider || this.preferredProvider;
      const intent = await this.classifyIntent(
        query,
        undefined,
        selectedProvider,
      );

      // Small delay between requests only for Gemini
      if (selectedProvider === 'gemini') {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const entities = await this.extractEntities(query);

      if (selectedProvider === 'gemini') {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const suggestions = await this.generateSuggestions(
        query,
        3,
        selectedProvider,
      );

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Query analyzed in ${processingTime}ms using ${selectedProvider}`,
      );

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

  // Shopping-specific methods enhanced for hybrid RAG-KAG
  async generateShoppingResponse(
    query: string,
    productContext: string[],
    userPreferences?: any,
    conversationHistory?: ChatMessage[],
    provider?: 'gemini' | 'ollama' | 'auto',
  ): Promise<AIResponse> {
    try {
      // Build enhanced context for shopping
      const systemContext = this.getShoppingSystemPrompt();
      const productInfo = productContext.slice(0, 5).join('\n\n'); // Limit products
      const preferences = userPreferences
        ? `User preferences: ${JSON.stringify(userPreferences).substring(0, 200)}`
        : '';

      const enhancedPrompt = `${systemContext}

${preferences}

Available products:
${productInfo}

Customer query: ${query}

Please provide a helpful shopping response that:
1. Addresses the customer's specific needs
2. Recommends relevant products from the available options
3. Explains why these products match their requirements
4. Offers additional assistance

Response:`;

      return await this.generateResponse(
        enhancedPrompt,
        conversationHistory?.slice(-3), // Keep more context for shopping
        {
          useCache: true,
          provider: provider || this.preferredProvider,
          temperature: 0.7, // Slightly more creative for shopping recommendations
        },
      );
    } catch (error) {
      this.logger.error('Error generating shopping response:', error);
      throw new Error(`Failed to generate shopping response: ${error.message}`);
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

  // Enhanced provider switching
  async switchProvider(newProvider: 'gemini' | 'ollama'): Promise<boolean> {
    try {
      if (newProvider === 'ollama') {
        await this.checkOllamaHealth();
        // Check if required models are available
        const chatModelExists = await this.checkOllamaModelExists(
          this.ollamaChatModel,
        );
        const embeddingModelExists = await this.checkOllamaModelExists(
          this.ollamaEmbeddingModel,
        );

        if (!chatModelExists || !embeddingModelExists) {
          this.logger.warn('Required Ollama models not found');
          return false;
        }
      } else if (newProvider === 'gemini') {
        if (!this.geminiClient) {
          this.logger.warn('Gemini client not available - API key missing');
          return false;
        }
      }

      this.logger.log(`Successfully switched to provider: ${newProvider}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to switch to provider ${newProvider}:`, error);
      return false;
    }
  }

  // Private utility methods
  private isRateLimitError(error: any): boolean {
    return (
      error?.status === 429 ||
      error?.message?.includes('rate limit') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('Too Many Requests')
    );
  }

  private getSystemPrompt(): string {
    return `You are a helpful e-commerce assistant. Be concise and helpful. Focus on understanding customer needs and providing relevant product recommendations.`;
  }

  private getShoppingSystemPrompt(): string {
    return `You are an expert e-commerce shopping assistant with deep knowledge of products and customer service. Your role is to:

1. Understand customer needs and preferences
2. Recommend the most suitable products from available inventory
3. Provide clear explanations for your recommendations
4. Help customers make informed purchasing decisions
5. Offer excellent customer service

Guidelines:
- Be friendly, professional, and helpful
- Ask clarifying questions when needed
- Provide specific product recommendations with reasons
- Include pricing and key features when relevant
- Be honest about product limitations
- Suggest alternatives when the exact request isn't available`;
  }

  private getDefaultIntents(): string[] {
    return [
      'PRODUCT_SEARCH',
      'PRICE_INQUIRY',
      'RECOMMENDATION',
      'SUPPORT',
      'GREETING',
      'ORDER_STATUS',
      'COMPARISON',
      'AVAILABILITY',
      'OTHER',
    ];
  }

  private getDefaultEntityTypes(): string[] {
    return ['PRODUCT', 'CATEGORY', 'BRAND', 'PRICE', 'FEATURE', 'LOCATION'];
  }

  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
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
      provider: 'gemini',
      confidence: 0.5,
    };
  }

  private getFallbackResponse(prompt: string, startTime: number): AIResponse {
    const processingTime = Date.now() - startTime;
    const lowerPrompt = prompt.toLowerCase().trim();

    let content =
      "I apologize, but I'm currently experiencing technical difficulties. Please try again in a moment.";
    let confidence = 0.5;

    // Greeting patterns
    if (this.isGreeting(lowerPrompt)) {
      content =
        "Hello! Welcome to our store! I'm your shopping assistant and I'm here to help you find exactly what you're looking for. How can I assist you today?";
      confidence = 0.9;
    }
    // Product search patterns
    else if (this.isProductSearch(lowerPrompt)) {
      content =
        "I'd be happy to help you find products! Could you please tell me more specifically what you're looking for? For example, what category, brand, or features are you interested in?";
      confidence = 0.8;
    }
    // Price inquiry patterns
    else if (this.isPriceInquiry(lowerPrompt)) {
      content =
        "I can help you with pricing information! Could you please specify which product you're interested in learning about?";
      confidence = 0.8;
    }
    // Help/support patterns
    else if (this.isHelpRequest(lowerPrompt)) {
      content =
        "I'm here to help! I can assist you with finding products, comparing options, checking prices, and answering any questions about our store. What would you like to know?";
      confidence = 0.8;
    }
    // Order/shipping patterns
    else if (this.isOrderInquiry(lowerPrompt)) {
      content =
        'I can help you with order-related questions! Please let me know what specific information you need about your order, shipping, or our policies.';
      confidence = 0.8;
    }
    // General conversation
    else if (this.isGeneralConversation(lowerPrompt)) {
      content =
        "I'm doing well, thank you for asking! I'm here to help you with your shopping needs. Is there anything specific you're looking for today?";
      confidence = 0.8;
    }

    return {
      content,
      tokensUsed: this.estimateTokenCount(content),
      processingTime,
      model: 'intelligent-fallback',
      provider: 'ollama',
      confidence,
      fromCache: false,
    };
  }

  private isGreeting(text: string): boolean {
    const greetingPatterns = [
      'hello',
      'hi',
      'hey',
      'good morning',
      'good afternoon',
      'good evening',
      'greetings',
      'howdy',
      'welcome',
      'start',
      'begin',
    ];
    return greetingPatterns.some((pattern) => text.includes(pattern));
  }

  private isProductSearch(text: string): boolean {
    const searchPatterns = [
      'search',
      'find',
      'look for',
      'looking for',
      'need',
      'want',
      'product',
      'item',
      'buy',
      'purchase',
      'shop',
      'shopping',
      'browse',
      'show me',
    ];
    return searchPatterns.some((pattern) => text.includes(pattern));
  }

  private isPriceInquiry(text: string): boolean {
    const pricePatterns = [
      'price',
      'cost',
      'expensive',
      'cheap',
      'budget',
      'affordable',
      'how much',
      'pricing',
      'fee',
      'charge',
      'rate',
      'dollar',
      '$',
    ];
    return pricePatterns.some((pattern) => text.includes(pattern));
  }

  private isHelpRequest(text: string): boolean {
    const helpPatterns = [
      'help',
      'assist',
      'support',
      'guide',
      'explain',
      'tell me',
      'how to',
      'can you',
      'please',
      'information',
      'info',
    ];
    return helpPatterns.some((pattern) => text.includes(pattern));
  }

  private isOrderInquiry(text: string): boolean {
    const orderPatterns = [
      'order',
      'shipping',
      'delivery',
      'track',
      'status',
      'return',
      'refund',
      'exchange',
      'policy',
      'warranty',
      'guarantee',
    ];
    return orderPatterns.some((pattern) => text.includes(pattern));
  }

  private isGeneralConversation(text: string): boolean {
    const conversationPatterns = [
      'how are you',
      'how do you do',
      "what's up",
      "how's it going",
      'good',
      'fine',
      'doing',
      'today',
      'weather',
      'nice',
      'thanks',
      'thank you',
    ];
    return conversationPatterns.some((pattern) => text.includes(pattern));
  }
  private isOllamaErrorResponse(content: string): boolean {
    const errorPatterns = [
      'error',
      'failed',
      'unable',
      'cannot',
      'connection',
      'timeout',
      'not found',
      '404',
      '500',
      'internal server error',
      'bad request',
    ];
    const lowerContent = content.toLowerCase();
    return errorPatterns.some((pattern) => lowerContent.includes(pattern));
  }
}
