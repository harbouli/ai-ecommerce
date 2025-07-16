import { ApiProperty } from '@nestjs/swagger';

export class ExtractedEntity {
  @ApiProperty({
    type: String,
    example: 'entity_123',
    description: 'Unique identifier for the extracted entity',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'MacBook Pro',
    description: 'The extracted entity text',
  })
  text: string;

  @ApiProperty({
    enum: [
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
    ],
    example: 'PRODUCT',
    description: 'Type of the extracted entity',
  })
  type:
    | 'PRODUCT'
    | 'CATEGORY'
    | 'BRAND'
    | 'PRICE'
    | 'FEATURE'
    | 'LOCATION'
    | 'PERSON'
    | 'DATE'
    | 'TIME'
    | 'QUANTITY'
    | 'SIZE'
    | 'COLOR'
    | 'MATERIAL'
    | 'MODEL'
    | 'ORDER_ID';

  @ApiProperty({
    type: Number,
    example: 0.95,
    description: 'Confidence score (0-1)',
  })
  confidence: number;

  @ApiProperty({
    type: Number,
    example: 15,
    description: 'Start index of the entity in the source text',
  })
  startIndex: number;

  @ApiProperty({
    type: Number,
    example: 26,
    description: 'End index of the entity in the source text',
  })
  endIndex: number;

  metadata: Record<string, any>;

  @ApiProperty({
    type: String,
    example: 'I need a MacBook Pro for video editing',
    description: 'Original text from which the entity was extracted',
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
    this.metadata = {};
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
