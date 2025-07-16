/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';
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

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly mistralClient: Mistral;
  private readonly model: string;
  private readonly embeddingModel: string;
  private readonly temperature: number;
  private readonly maxTokens: number;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    this.mistralClient = new Mistral({
      apiKey: this.configService.get('app.mistral.apiKey', { infer: true }),
    });

    this.model =
      this.configService.get('app.mistral.model', { infer: true }) ||
      'mistral-large-latest';
    this.embeddingModel =
      this.configService.get('app.mistral.embeddingModel', { infer: true }) ||
      'mistral-embed';
    this.temperature =
      this.configService.get('app.mistral.temperature', { infer: true }) || 0.7;
    this.maxTokens =
      this.configService.get('app.mistral.maxTokens', { infer: true }) || 1000;
  }

  async generateResponse(
    prompt: string,
    conversationHistory?: ChatMessage[],
    customOptions?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    },
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const messages = [
        {
          role: 'system' as const,
          content: this.getSystemPrompt(),
        },
        ...(conversationHistory || []),
        {
          role: 'user' as const,
          content: prompt,
        },
      ];

      this.logger.log(
        `Generating response for prompt: ${prompt.substring(0, 100)}...`,
      );

      const response = await this.mistralClient.chat.complete({
        model: customOptions?.model || this.model,
        messages,
        temperature: customOptions?.temperature || this.temperature,
        maxTokens: customOptions?.maxTokens || this.maxTokens,
      });

      const processingTime = Date.now() - startTime;
      const rawContent = response.choices[0]?.message?.content;
      const content = Array.isArray(rawContent)
        ? rawContent
            .map((chunk) =>
              typeof chunk === 'string'
                ? chunk
                : chunk.type === 'text'
                  ? chunk.text
                  : '',
            )
            .join('')
        : rawContent || '';
      const tokensUsed = response.usage?.totalTokens || 0;

      this.logger.log(
        `Response generated in ${processingTime}ms using ${tokensUsed} tokens`,
      );

      return {
        content,
        tokensUsed,
        processingTime,
        model: customOptions?.model || this.model,
      };
    } catch (error) {
      this.logger.error('Error generating response:', error);
      throw new Error(`Failed to generate AI response: ${error.message}`);
    }
  }

  async generateEmbedding(
    text: string,
    customModel?: string,
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Generating embedding for text: ${text.substring(0, 100)}...`,
      );

      const response = await this.mistralClient.embeddings.create({
        model: customModel || this.embeddingModel,
        inputs: [text],
      });

      const processingTime = Date.now() - startTime;
      const vector = response.data[0]?.embedding || [];

      if (!vector || vector.length === 0) {
        throw new Error('Failed to generate embedding: empty vector received');
      }

      this.logger.log(
        `Embedding generated in ${processingTime}ms with ${vector.length} dimensions`,
      );

      return {
        vector,
        dimensions: vector.length,
        model: customModel || this.embeddingModel,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  async generateMultipleEmbeddings(
    texts: string[],
    customModel?: string,
  ): Promise<EmbeddingResult[]> {
    const startTime = Date.now();

    try {
      this.logger.log(`Generating embeddings for ${texts.length} texts`);

      const response = await this.mistralClient.embeddings.create({
        model: customModel || this.embeddingModel,
        inputs: texts,
      });

      const processingTime = Date.now() - startTime;

      const results: EmbeddingResult[] = response.data.map((item, index) => {
        const embedding = item.embedding || [];
        if (!embedding || embedding.length === 0) {
          throw new Error(
            `Failed to generate embedding for text ${index}: empty vector received`,
          );
        }

        return {
          vector: embedding,
          dimensions: embedding.length,
          model: customModel || this.embeddingModel,
          processingTime: processingTime / texts.length, // Approximate per-text processing time
        };
      });

      this.logger.log(
        `${texts.length} embeddings generated in ${processingTime}ms`,
      );

      return results;
    } catch (error) {
      this.logger.error('Error generating multiple embeddings:', error);
      throw new Error(
        `Failed to generate multiple embeddings: ${error.message}`,
      );
    }
  }

  async classifyIntent(
    text: string,
    customIntents?: string[],
  ): Promise<IntentClassification> {
    const startTime = Date.now();

    try {
      const intents = customIntents || this.getDefaultIntents();

      const prompt = `
      Classify the intent of the following user message into one of these categories:
      ${intents.map((intent) => `- ${intent}`).join('\n')}

      User message: "${text}"
      
      Respond with a JSON object containing:
      - intent: the classified intent
      - confidence: confidence score (0-1)
      - reasoning: brief explanation of the classification
      
      Example: {"intent": "PRODUCT_SEARCH", "confidence": 0.95, "reasoning": "User is looking for specific products"}
      `;

      const response = await this.generateResponse(prompt);

      try {
        const parsed = JSON.parse(response.content);

        const processingTime = Date.now() - startTime;

        this.logger.log(
          `Intent classified as '${parsed.intent}' with confidence ${parsed.confidence} in ${processingTime}ms`,
        );

        return {
          intent: parsed.intent,
          confidence: parsed.confidence || 0.8,
          entities: [], // Will be populated by extractEntities if needed
          metadata: {
            reasoning: parsed.reasoning,
            processingTime,
            originalText: text,
          },
        };
      } catch (parseError) {
        this.logger.warn(
          'Failed to parse intent classification JSON, using fallback',
        );

        return {
          intent: 'OTHER',
          confidence: 0.5,
          entities: [],
          metadata: {
            reasoning: 'Failed to parse AI response',
            processingTime: Date.now() - startTime,
            originalText: text,
            rawResponse: response.content,
          },
        };
      }
    } catch (error) {
      this.logger.error('Error classifying intent:', error);
      throw new Error(`Failed to classify intent: ${error.message}`);
    }
  }

  async extractEntities(
    text: string,
    customEntityTypes?: string[],
  ): Promise<ExtractedEntity[]> {
    const startTime = Date.now();

    try {
      const entityTypes = customEntityTypes || this.getDefaultEntityTypes();

      const prompt = `
      Extract entities from the following text and categorize them.
      
      Entity types to extract:
      ${entityTypes.map((type) => `- ${type}`).join('\n')}

      Text: "${text}"
      
      Respond with a JSON array of entities:
      [
        {
          "text": "entity_text",
          "type": "ENTITY_TYPE",
          "confidence": 0.95,
          "startIndex": 0,
          "endIndex": 10,
          "context": "surrounding context"
        }
      ]
      
      Only return valid JSON array, no other text.
      `;

      const response = await this.generateResponse(prompt);

      try {
        const entities = JSON.parse(response.content);
        const processingTime = Date.now() - startTime;

        const extractedEntities: ExtractedEntity[] = entities.map(
          (entity: any) => ({
            text: entity.text,
            type: entity.type,
            confidence: entity.confidence || 0.8,
            startIndex: entity.startIndex || 0,
            endIndex: entity.endIndex || entity.text.length,
            metadata: {
              context: entity.context,
              processingTime,
              originalText: text,
            },
          }),
        );

        this.logger.log(
          `Extracted ${extractedEntities.length} entities in ${processingTime}ms`,
        );

        return extractedEntities;
      } catch (parseError) {
        this.logger.warn(
          'Failed to parse entities JSON, returning empty array',
        );
        return [];
      }
    } catch (error) {
      this.logger.error('Error extracting entities:', error);
      throw new Error(`Failed to extract entities: ${error.message}`);
    }
  }

  async summarizeText(
    text: string,
    maxSentences?: number,
  ): Promise<TextSummary> {
    const startTime = Date.now();

    try {
      const prompt = `
      Summarize the following text in ${maxSentences || 3} sentences or less.
      Also provide:
      - Key points (3-5 bullet points)
      - Overall sentiment (positive/negative/neutral)
      - Confidence score (0-1)

      Text: "${text}"
      
      Respond with JSON:
      {
        "summary": "brief summary",
        "keyPoints": ["point 1", "point 2", "point 3"],
        "sentiment": "positive|negative|neutral",
        "confidence": 0.95
      }
      `;

      const response = await this.generateResponse(prompt);

      try {
        const parsed = JSON.parse(response.content);
        const processingTime = Date.now() - startTime;

        this.logger.log(`Text summarized in ${processingTime}ms`);

        return {
          summary: parsed.summary,
          keyPoints: parsed.keyPoints || [],
          sentiment: parsed.sentiment || 'neutral',
          confidence: parsed.confidence || 0.8,
        };
      } catch (parseError) {
        this.logger.warn('Failed to parse summary JSON, using fallback');

        return {
          summary: response.content.substring(0, 200) + '...',
          keyPoints: [],
          sentiment: 'neutral',
          confidence: 0.5,
        };
      }
    } catch (error) {
      this.logger.error('Error summarizing text:', error);
      throw new Error(`Failed to summarize text: ${error.message}`);
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
    const startTime = Date.now();

    try {
      const prompt = `
      Translate the following text to ${targetLanguage}.
      ${sourceLanguage ? `Source language: ${sourceLanguage}` : 'Auto-detect source language.'}
      
      Text: "${text}"
      
      Respond with JSON:
      {
        "translatedText": "translated text here",
        "sourceLanguage": "detected_language",
        "targetLanguage": "${targetLanguage}",
        "confidence": 0.95
      }
      `;

      const response = await this.generateResponse(prompt);

      try {
        const parsed = JSON.parse(response.content);
        const processingTime = Date.now() - startTime;

        this.logger.log(
          `Text translated from ${parsed.sourceLanguage} to ${targetLanguage} in ${processingTime}ms`,
        );

        return {
          translatedText: parsed.translatedText,
          sourceLanguage: parsed.sourceLanguage,
          targetLanguage: parsed.targetLanguage,
          confidence: parsed.confidence || 0.8,
        };
      } catch (parseError) {
        this.logger.warn('Failed to parse translation JSON, using fallback');

        return {
          translatedText: response.content,
          sourceLanguage: sourceLanguage || 'unknown',
          targetLanguage,
          confidence: 0.5,
        };
      }
    } catch (error) {
      this.logger.error('Error translating text:', error);
      throw new Error(`Failed to translate text: ${error.message}`);
    }
  }

  async generateSuggestions(
    context: string,
    numberOfSuggestions: number = 5,
  ): Promise<string[]> {
    try {
      const prompt = `
      Based on the following context, generate ${numberOfSuggestions} helpful suggestions or follow-up questions that would be relevant to the user.
      
      Context: "${context}"
      
      Generate suggestions that are:
      - Relevant to the context
      - Helpful for the user
      - Clear and actionable
      
      Respond with a JSON array of strings:
      ["suggestion 1", "suggestion 2", "suggestion 3", ...]
      `;

      const response = await this.generateResponse(prompt);

      try {
        const suggestions = JSON.parse(response.content);

        this.logger.log(`Generated ${suggestions.length} suggestions`);

        return Array.isArray(suggestions) ? suggestions : [];
      } catch (parseError) {
        this.logger.warn(
          'Failed to parse suggestions JSON, returning empty array',
        );
        return [];
      }
    } catch (error) {
      this.logger.error('Error generating suggestions:', error);
      throw new Error(`Failed to generate suggestions: ${error.message}`);
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

      const [intent, entities, suggestions] = await Promise.all([
        this.classifyIntent(query),
        this.extractEntities(query),
        this.generateSuggestions(query, 3),
      ]);

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
      throw new Error(`Failed to analyze query: ${error.message}`);
    }
  }

  async generateContextualResponse(
    query: string,
    context: string[],
    conversationHistory?: ChatMessage[],
  ): Promise<AIResponse> {
    try {
      const contextSection =
        context.length > 0
          ? `
        Relevant Context:
        ${context.map((ctx, index) => `${index + 1}. ${ctx}`).join('\n')}
        `
          : '';

      const enhancedPrompt = `
      ${contextSection}
      
      User Query: ${query}
      
      Please provide a helpful and contextual response based on the information provided above.
      `;

      return await this.generateResponse(enhancedPrompt, conversationHistory);
    } catch (error) {
      this.logger.error('Error generating contextual response:', error);
      throw new Error(
        `Failed to generate contextual response: ${error.message}`,
      );
    }
  }

  private getSystemPrompt(): string {
    return `
    You are an AI assistant for an e-commerce platform. Your role is to:
    
    1. Help customers find products they're looking for
    2. Provide detailed product information and comparisons
    3. Offer personalized recommendations based on user preferences
    4. Answer questions about pricing, shipping, and policies
    5. Assist with order-related inquiries
    6. Provide excellent customer service
    
    Guidelines:
    - Be friendly, helpful, and professional
    - Provide accurate information based on the context provided
    - If you don't have specific information, be honest about it
    - Suggest relevant products when appropriate
    - Keep responses concise but informative
    - Use the knowledge and context provided to give relevant answers
    - Always prioritize customer satisfaction
    
    Current date: ${new Date().toISOString().split('T')[0]}
    `;
  }

  private getDefaultIntents(): string[] {
    return [
      'PRODUCT_SEARCH',
      'PRODUCT_QUESTION',
      'PRICE_INQUIRY',
      'RECOMMENDATION',
      'SUPPORT',
      'GREETING',
      'ORDER_STATUS',
      'SHIPPING_INFO',
      'RETURN_POLICY',
      'ACCOUNT_HELP',
      'COMPLAINT',
      'COMPLIMENT',
      'GOODBYE',
      'OTHER',
    ];
  }

  private getDefaultEntityTypes(): string[] {
    return [
      'PRODUCT',
      'CATEGORY',
      'BRAND',
      'PRICE',
      'FEATURE',
      'LOCATION',
      'PERSON',
      'DATE',
      'TIME',
      'QUANTITY',
      'SIZE',
      'COLOR',
      'MATERIAL',
      'MODEL',
      'ORDER_ID',
    ];
  }
}
