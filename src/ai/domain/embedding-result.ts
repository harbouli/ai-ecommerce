import { ApiProperty } from '@nestjs/swagger';

export class EmbeddingResult {
  @ApiProperty({
    type: String,
    example: 'embedding_123',
    description: 'Unique identifier for the embedding result',
  })
  id: string;

  @ApiProperty({
    type: [Number],
    example: [0.1, 0.2, 0.3, 0.4, 0.5],
    description: 'Vector embedding array',
  })
  vector: number[];

  @ApiProperty({
    type: Number,
    example: 1536,
    description: 'Number of dimensions in the vector',
  })
  dimensions: number;

  @ApiProperty({
    type: String,
    example: 'mistral-embed',
    description: 'Model used for embedding generation',
  })
  model: string;

  @ApiProperty({
    type: Number,
    example: 850,
    description: 'Processing time in milliseconds',
  })
  processingTime: number;

  @ApiProperty({
    type: String,
    example: 'This is the text that was embedded',
    description: 'Original text that was embedded',
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
    this.vector = [];
    this.dimensions = 0;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
