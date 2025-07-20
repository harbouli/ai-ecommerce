import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OllamaRequestOptions } from './ollama-request-options';

export class OllamaRequest {
  @ApiProperty({
    type: String,
    example: 'llama3.2:latest',
    description: 'The name of the model to use for generation',
  })
  model: string;

  @ApiProperty({
    type: String,
    example: 'Classify this customer query about car parts...',
    description: 'The prompt text to send to the model',
    maxLength: 10000,
  })
  prompt: string;

  @ApiProperty({
    type: Boolean,
    example: false,
    description: 'Whether to stream the response (false for complete response)',
    default: false,
  })
  stream: boolean;

  @ApiPropertyOptional({
    type: () => OllamaRequestOptions,
    description: 'Optional parameters to control text generation',
  })
  options?: OllamaRequestOptions;

  @ApiPropertyOptional({
    type: [Number],
    example: [128, 256, 512, 1024],
    description: 'Context vector from previous conversation for continuity',
    isArray: true,
  })
  context?: number[];

  constructor(data?: Partial<OllamaRequest>) {
    if (data) {
      Object.assign(this, data);

      // Ensure stream is boolean
      this.stream = Boolean(data.stream);

      // Create options object if provided as plain object
      if (data.options && !(data.options instanceof OllamaRequestOptions)) {
        this.options = new OllamaRequestOptions(data.options);
      }
    }
  }

  /**
   * Create a request for intent classification
   */
  static forIntentClassification(
    model: string,
    prompt: string,
    context?: number[],
  ): OllamaRequest {
    return new OllamaRequest({
      model,
      prompt,
      stream: false,
      options: OllamaRequestOptions.getCarPartsDefaults(),
      context,
    });
  }

  /**
   * Create a request for entity extraction
   */
  static forEntityExtraction(
    model: string,
    prompt: string,
    context?: number[],
  ): OllamaRequest {
    return new OllamaRequest({
      model,
      prompt,
      stream: false,
      options: new OllamaRequestOptions({
        temperature: 0.2, // Very low temperature for consistent entity extraction
        top_p: 0.8,
        top_k: 30,
        repeat_penalty: 1.1,
        num_predict: 300,
      }),
      context,
    });
  }

  /**
   * Create a request for shopping response generation
   */
  static forShoppingResponse(
    model: string,
    prompt: string,
    context?: number[],
  ): OllamaRequest {
    return new OllamaRequest({
      model,
      prompt,
      stream: false,
      options: new OllamaRequestOptions({
        temperature: 0.7, // Balanced temperature for helpful responses
        top_p: 0.9,
        top_k: 40,
        repeat_penalty: 1.05,
        num_predict: 250,
        stop: ['\n\nHuman:', '\n\nUser:', '\n\nCustomer:'],
      }),
      context,
    });
  }

  /**
   * Create a request for generating suggestions
   */
  static forSuggestions(
    model: string,
    prompt: string,
    context?: number[],
  ): OllamaRequest {
    return new OllamaRequest({
      model,
      prompt,
      stream: false,
      options: OllamaRequestOptions.getCreativeDefaults(),
      context,
    });
  }
}
