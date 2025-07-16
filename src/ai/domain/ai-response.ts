import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AIResponse {
  @ApiProperty({
    type: String,
    example: 'response_123',
    description: 'Unique identifier for the AI response',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'I can help you find the perfect laptop for your needs.',
    description: 'Generated AI response content',
  })
  content: string;

  @ApiProperty({
    type: Number,
    example: 150,
    description: 'Number of tokens used in the response generation',
  })
  tokensUsed: number;

  @ApiProperty({
    type: Number,
    example: 1250,
    description: 'Processing time in milliseconds',
  })
  processingTime: number;

  @ApiProperty({
    type: String,
    example: 'mistral-large-latest',
    description: 'AI model used for generation',
  })
  model: string;

  @ApiPropertyOptional({
    type: Number,
    example: 0.95,
    description: 'Confidence score of the response (0-1)',
  })
  confidence?: number;

  @ApiProperty({
    type: Date,
    example: '2023-01-01T00:00:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
    example: '2023-01-01T00:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;

  constructor() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
