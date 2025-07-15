/* eslint-disable no-restricted-syntax */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';

export interface TextGenerationRequest {
  prompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
  context?: string;
  topP?: number;
  randomSeed?: number;
  safePrompt?: boolean;
}

export interface TextGenerationResponse {
  text: string;
  model: string;
  tokensUsed: number;
  confidence: number;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class TextGenerationService {
  private readonly logger = new Logger(TextGenerationService.name);
  private readonly mistralClient: Mistral;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('MISTRAL_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'MISTRAL_API_KEY not found. Mistral AI functionality will be limited.',
      );
    }

    this.mistralClient = new Mistral({
      apiKey: apiKey || '',
    });
  }

  async generateText(
    request: TextGenerationRequest,
  ): Promise<TextGenerationResponse> {
    this.logger.log(`Generating text with model: ${request.model}`);

    try {
      // Check if it's a Mistral model
      if (this.isMistralModel(request.model)) {
        return await this.generateWithMistral(request);
      } else {
        // Fallback to other providers or mock response
        return await this.generateWithFallback(request);
      }
    } catch (error) {
      this.logger.error(`Text generation failed: ${error.message}`, error);
      throw error;
    }
  }

  private async generateWithMistral(
    request: TextGenerationRequest,
  ): Promise<TextGenerationResponse> {
    this.logger.log(
      `Using Mistral AI for text generation with model: ${request.model}`,
    );

    try {
      // Prepare messages for chat completion with proper typing
      const messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
      }> = [];

      // Add system message if provided
      if (request.systemPrompt) {
        messages.push({
          role: 'system' as const,
          content: request.systemPrompt,
        });
      }

      // Add context if provided
      if (request.context) {
        messages.push({
          role: 'user' as const,
          content: `Context: ${request.context}`,
        });
      }

      // Add main prompt
      messages.push({
        role: 'user' as const,
        content: request.prompt,
      });

      // Create chat completion
      const chatResponse = await this.mistralClient.chat.complete({
        model: request.model,
        messages: messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        topP: request.topP,
        randomSeed: request.randomSeed,
        safePrompt: request.safePrompt ?? true,
      });

      const choice = chatResponse.choices?.[0];
      if (!choice) {
        throw new Error('No response generated from Mistral AI');
      }

      // Handle both string and ContentChunk[] responses
      let generatedText = '';
      if (typeof choice.message?.content === 'string') {
        generatedText = choice.message.content;
      } else if (Array.isArray(choice.message?.content)) {
        // Handle ContentChunk[] - extract text content
        generatedText = choice.message.content
          .map((chunk) => {
            if ('text' in chunk) {
              return chunk.text;
            }
            return '';
          })
          .join('');
      }

      const usage = chatResponse.usage;

      return {
        text: generatedText,
        model: request.model,
        tokensUsed: usage?.totalTokens || 0,
        confidence: this.calculateConfidence(choice.finishReason),
        finishReason: choice.finishReason,
        usage: usage
          ? {
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Mistral AI generation failed: ${error.message}`,
        error,
      );

      // Handle specific Mistral AI errors
      if (error.status === 401) {
        throw new Error('Invalid Mistral AI API key');
      } else if (error.status === 429) {
        throw new Error('Mistral AI rate limit exceeded');
      } else if (error.status === 400) {
        throw new Error(`Invalid request to Mistral AI: ${error.message}`);
      }

      throw error;
    }
  }

  private async generateWithFallback(
    request: TextGenerationRequest,
  ): Promise<TextGenerationResponse> {
    this.logger.log(`Using fallback generation for model: ${request.model}`);

    // This could integrate with other providers like OpenAI, Anthropic, etc.
    // For now, return a mock response
    const mockResponse: TextGenerationResponse = {
      text: `Generated text response for prompt: "${request.prompt.substring(0, 50)}..." using fallback provider.`,
      model: request.model,
      tokensUsed: Math.floor(Math.random() * 200) + 50,
      confidence: 0.85 + Math.random() * 0.1,
      finishReason: 'stop',
    };

    // Simulate API call delay
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1000),
    );

    return mockResponse;
  }

  private isMistralModel(model: string): boolean {
    const mistralModels = [
      'mistral-tiny',
      'mistral-small',
      'mistral-medium',
      'mistral-large-latest',
      'mistral-large-2402',
      'mistral-large-2407',
      'mistral-embed',
      'open-mistral-7b',
      'open-mixtral-8x7b',
      'open-mixtral-8x22b',
      'codestral-latest',
      'codestral-2405',
      'ministral-8b-latest',
      'ministral-3b-latest',
    ];

    return mistralModels.includes(model);
  }

  private calculateConfidence(finishReason?: string): number {
    // Calculate confidence based on finish reason
    switch (finishReason) {
      case 'stop':
        return 0.95; // Natural completion
      case 'length':
        return 0.85; // Stopped due to max length
      case 'model_length':
        return 0.8; // Stopped due to model context length
      case 'error':
        return 0.3; // Error occurred
      default:
        return 0.75; // Unknown reason
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      // Get available models from Mistral AI
      const modelsResponse = await this.mistralClient.models.list();
      const mistralModels = modelsResponse.data?.map((model) => model.id) || [];

      // Add other provider models
      const otherModels = [
        'gpt-3.5-turbo',
        'gpt-4',
        'claude-3-sonnet',
        'claude-3-opus',
      ];

      return [...mistralModels, ...otherModels];
    } catch (error) {
      this.logger.error(
        'Failed to fetch Mistral models, returning default list',
        error,
      );

      // Return default Mistral models if API call fails
      return [
        'mistral-tiny',
        'mistral-small',
        'mistral-medium',
        'mistral-large-latest',
        'open-mistral-7b',
        'open-mixtral-8x7b',
        'open-mixtral-8x22b',
        'codestral-latest',
        'ministral-8b-latest',
        'ministral-3b-latest',
        'gpt-3.5-turbo',
        'gpt-4',
        'claude-3-sonnet',
        'claude-3-opus',
      ];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test Mistral AI connection with a simple request
      await this.mistralClient.models.list();
      return true;
    } catch (error) {
      this.logger.error('Mistral AI health check failed', error);
      return false;
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.mistralClient.models.list();
      return true;
    } catch (error) {
      if (error.status === 401) {
        this.logger.error('Invalid Mistral AI API key');
        return false;
      }
      throw error;
    }
  }

  estimateTokens(text: string): number {
    // Simple token estimation (rough approximation)
    // For more accurate counting, you might want to use tiktoken or similar
    const words = text.split(/\s+/).length;
    const avgTokensPerWord = 1.3; // Approximation for most models
    return Math.ceil(words * avgTokensPerWord);
  }

  estimateCost(
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    // Mistral AI pricing (as of 2024 - check current pricing)
    const pricing: Record<string, { input: number; output: number }> = {
      'mistral-tiny': { input: 0.00025, output: 0.00025 },
      'mistral-small': { input: 0.002, output: 0.006 },
      'mistral-medium': { input: 0.0027, output: 0.0081 },
      'mistral-large-latest': { input: 0.008, output: 0.024 },
      'open-mistral-7b': { input: 0.00025, output: 0.00025 },
      'open-mixtral-8x7b': { input: 0.0007, output: 0.0007 },
      'open-mixtral-8x22b': { input: 0.002, output: 0.006 },
      'codestral-latest': { input: 0.001, output: 0.003 },
      'ministral-8b-latest': { input: 0.0001, output: 0.0001 },
      'ministral-3b-latest': { input: 0.00004, output: 0.00004 },
    };

    const modelPricing = pricing[model];
    if (!modelPricing) {
      return 0; // Unknown model
    }

    // Calculate cost per 1K tokens
    const inputCost = (promptTokens / 1000) * modelPricing.input;
    const outputCost = (completionTokens / 1000) * modelPricing.output;

    return inputCost + outputCost;
  }

  async generateWithStreaming(
    request: TextGenerationRequest,
    onChunk: (chunk: string) => void,
  ): Promise<TextGenerationResponse> {
    this.logger.log(
      `Generating text with streaming for model: ${request.model}`,
    );

    if (!this.isMistralModel(request.model)) {
      throw new Error('Streaming is only supported for Mistral models');
    }

    try {
      const messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
      }> = [];

      if (request.systemPrompt) {
        messages.push({
          role: 'system' as const,
          content: request.systemPrompt,
        });
      }

      if (request.context) {
        messages.push({
          role: 'user' as const,
          content: `Context: ${request.context}`,
        });
      }

      messages.push({
        role: 'user' as const,
        content: request.prompt,
      });

      const streamResponse = await this.mistralClient.chat.stream({
        model: request.model,
        messages: messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        topP: request.topP,
        randomSeed: request.randomSeed,
      });

      let fullText = '';
      let totalTokens = 0;
      let finishReason = '';
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const event of streamResponse) {
        // Handle different event types in the stream
        if (event.data && typeof event.data === 'object') {
          const data = event.data;

          // Check for choices in the event data
          if ('choices' in data && Array.isArray(data.choices)) {
            const choice = data.choices[0];

            if (choice?.delta?.content) {
              let chunkText = '';
              if (typeof choice.delta.content === 'string') {
                chunkText = choice.delta.content;
              } else if (Array.isArray(choice.delta.content)) {
                chunkText = choice.delta.content
                  .map((contentChunk) => {
                    if ('text' in contentChunk) {
                      return contentChunk.text;
                    }
                    return '';
                  })
                  .join('');
              }

              if (chunkText) {
                fullText += chunkText;
                onChunk(chunkText);
              }
            }

            if (choice?.finishReason) {
              finishReason = choice.finishReason;
            }
          }

          // Check for usage information
          if ('usage' in data && data.usage) {
            totalTokens = data.usage.totalTokens || 0;
            promptTokens = data.usage.promptTokens || 0;
            completionTokens = data.usage.completionTokens || 0;
          }
        }
      }

      // If no tokens were reported during streaming, estimate them
      if (totalTokens === 0) {
        promptTokens = await this.estimateTokens(
          request.prompt +
            (request.systemPrompt || '') +
            (request.context || ''),
        );
        completionTokens = await this.estimateTokens(fullText);
        totalTokens = promptTokens + completionTokens;
      }

      return {
        text: fullText,
        model: request.model,
        tokensUsed: totalTokens,
        confidence: this.calculateConfidence(finishReason),
        finishReason,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
        },
      };
    } catch (error) {
      this.logger.error(`Mistral AI streaming failed: ${error.message}`, error);
      throw error;
    }
  }
}
