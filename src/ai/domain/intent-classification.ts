import { ApiProperty } from '@nestjs/swagger';
import { ExtractedEntity } from './extracted-entity';

export class IntentClassification {
  @ApiProperty({
    type: String,
    example: 'intent_123',
    description: 'Unique identifier for the intent classification',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'PRODUCT_SEARCH',
    description: 'Classified intent category',
  })
  intent: string;

  @ApiProperty({
    type: Number,
    example: 0.92,
    description: 'Confidence score for the classification (0-1)',
  })
  confidence: number;

  @ApiProperty({
    type: [ExtractedEntity],
    description: 'Entities extracted from the text',
  })
  entities: ExtractedEntity[];

  metadata: Record<string, any>;

  @ApiProperty({
    type: String,
    example: 'I need a laptop for gaming',
    description: 'Original text that was classified',
  })
  sourceText: string;

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
    this.metadata = {};
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
