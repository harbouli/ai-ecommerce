import { ApiPropertyOptional } from '@nestjs/swagger';

export class OllamaRequestOptions {
  @ApiPropertyOptional({
    type: Number,
    example: 0.7,
    description:
      'Controls randomness in response generation (0.0 = deterministic, 1.0 = very random)',
    minimum: 0,
    maximum: 2,
  })
  temperature?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 0.9,
    description:
      'Controls diversity via nucleus sampling (0.0 = most likely tokens only)',
    minimum: 0,
    maximum: 1,
  })
  top_p?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 40,
    description:
      'Limits the next token selection to the K most probable tokens',
    minimum: 1,
    maximum: 100,
  })
  top_k?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 1.1,
    description:
      'Penalizes repetition in the generated text (1.0 = no penalty)',
    minimum: 0.5,
    maximum: 2.0,
  })
  repeat_penalty?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 200,
    description: 'Maximum number of tokens to generate (-1 for unlimited)',
    minimum: -1,
    maximum: 4096,
  })
  num_predict?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['\n\n', 'User:', 'Assistant:'],
    description: 'Stop sequences that will halt text generation',
    isArray: true,
    maxItems: 10,
  })
  stop?: string[];

  constructor(data?: Partial<OllamaRequestOptions>) {
    if (data) {
      Object.assign(this, data);
    }
  }

  /**
   * Get conservative default options for car parts queries
   */
  static getCarPartsDefaults(): OllamaRequestOptions {
    return new OllamaRequestOptions({
      temperature: 0.3, // Lower temperature for more consistent responses
      top_p: 0.9,
      top_k: 40,
      repeat_penalty: 1.1,
      num_predict: 200,
      stop: ['\n\n', 'Human:', 'User:'],
    });
  }

  /**
   * Get creative options for generating suggestions
   */
  static getCreativeDefaults(): OllamaRequestOptions {
    return new OllamaRequestOptions({
      temperature: 0.7, // Higher temperature for more creative responses
      top_p: 0.95,
      top_k: 50,
      repeat_penalty: 1.05,
      num_predict: 150,
    });
  }
}
