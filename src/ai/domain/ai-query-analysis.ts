import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntentClassification } from './intent-classification';
import { ExtractedEntity } from './extracted-entity';

export class AIQueryAnalysis {
  @ApiProperty({
    type: String,
    example: 'analysis_123',
    description: 'Unique identifier for the query analysis',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'I need a gaming laptop under $1500',
    description: 'Original query text',
  })
  query: string;

  @ApiProperty({
    type: () => IntentClassification,
    description: 'Intent classification result',
  })
  intent: IntentClassification;

  @ApiProperty({
    type: [ExtractedEntity],
    description: 'Entities extracted from the query',
  })
  entities: ExtractedEntity[];

  @ApiProperty({
    type: [String],
    example: [
      'What specific games will you be playing?',
      'Do you have a preferred brand?',
    ],
    description: 'AI-generated follow-up suggestions',
  })
  suggestions: string[];

  @ApiProperty({
    type: Number,
    example: 1800,
    description: 'Total processing time in milliseconds',
  })
  processingTime: number;

  @ApiPropertyOptional({
    type: String,
    example: 'user_123',
    description: 'User ID if available',
  })
  userId?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'session_456',
    description: 'Session ID if available',
  })
  sessionId?: string;

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
    this.entities = [];
    this.suggestions = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
