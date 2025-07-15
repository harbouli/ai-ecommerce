import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AiEmbeddingResponseDto {
  @ApiProperty({
    description: 'Generated embedding vector',
    example: [0.123, -0.456, 0.789],
  })
  embedding: number[];

  @ApiProperty({
    description: 'Number of dimensions in the embedding',
    example: 1536,
  })
  dimensions: number;

  @ApiProperty({
    description: 'Model used for embedding generation',
    example: 'text-embedding-ada-002',
  })
  model: string;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 850,
  })
  processingTime: number;

  @ApiPropertyOptional({
    description: 'Session ID if associated with a session',
    example: '507f1f77bcf86cd799439011',
  })
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Interaction ID for tracking',
    example: '507f1f77bcf86cd799439013',
  })
  interactionId?: string;
}
