import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OllamaResponse {
  @ApiProperty({
    type: String,
    example: 'llama3.2:latest',
    description: 'The model name used for generating the response',
  })
  model: string;

  @ApiProperty({
    type: String,
    example: '2024-01-01T12:00:00.000Z',
    description: 'ISO timestamp when the response was created',
  })
  created_at: string;

  @ApiProperty({
    type: String,
    example: 'Based on your Honda Civic 2018, I recommend these brake pads...',
    description: 'The generated text response from Ollama',
  })
  response: string;

  @ApiProperty({
    type: Boolean,
    example: true,
    description: 'Whether the response generation is complete',
  })
  done: boolean;

  @ApiPropertyOptional({
    type: [Number],
    example: [128, 256, 512, 1024],
    description: 'Context vector for maintaining conversation state',
    isArray: true,
  })
  context?: number[];

  @ApiPropertyOptional({
    type: Number,
    example: 5000000000,
    description: 'Total duration for the entire request in nanoseconds',
    minimum: 0,
  })
  total_duration?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 1000000000,
    description: 'Time taken to load the model in nanoseconds',
    minimum: 0,
  })
  load_duration?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 50,
    description: 'Number of tokens in the prompt',
    minimum: 0,
  })
  prompt_eval_count?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 2000000000,
    description: 'Time taken to evaluate the prompt in nanoseconds',
    minimum: 0,
  })
  prompt_eval_duration?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 150,
    description: 'Number of tokens in the generated response',
    minimum: 0,
  })
  eval_count?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 3000000000,
    description: 'Time taken to generate the response in nanoseconds',
    minimum: 0,
  })
  eval_duration?: number;

  constructor(data?: Partial<OllamaResponse>) {
    if (data) {
      Object.assign(this, data);
    }
  }

  /**
   * Get the response generation duration in milliseconds
   */
  getResponseTimeMs(): number {
    return this.total_duration ? Math.round(this.total_duration / 1000000) : 0;
  }

  /**
   * Get the tokens per second rate for response generation
   */
  getTokensPerSecond(): number {
    if (!this.eval_count || !this.eval_duration) return 0;
    return Math.round((this.eval_count * 1000000000) / this.eval_duration);
  }

  /**
   * Check if the model had to be loaded for this request
   */
  wasModelLoaded(): boolean {
    return Boolean(this.load_duration && this.load_duration > 0);
  }

  /**
   * Get performance metrics summary
   */
  getPerformanceMetrics(): {
    totalTimeMs: number;
    loadTimeMs: number;
    promptEvalTimeMs: number;
    responseGenTimeMs: number;
    tokensPerSecond: number;
    promptTokens: number;
    responseTokens: number;
  } {
    return {
      totalTimeMs: this.total_duration
        ? Math.round(this.total_duration / 1000000)
        : 0,
      loadTimeMs: this.load_duration
        ? Math.round(this.load_duration / 1000000)
        : 0,
      promptEvalTimeMs: this.prompt_eval_duration
        ? Math.round(this.prompt_eval_duration / 1000000)
        : 0,
      responseGenTimeMs: this.eval_duration
        ? Math.round(this.eval_duration / 1000000)
        : 0,
      tokensPerSecond: this.getTokensPerSecond(),
      promptTokens: this.prompt_eval_count || 0,
      responseTokens: this.eval_count || 0,
    };
  }
}
