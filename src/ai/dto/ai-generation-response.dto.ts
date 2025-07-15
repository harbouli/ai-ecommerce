import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AiGenerationResponseDto {
  @ApiProperty({
    description: 'Generated text content',
    example: 'Experience immersive gaming with our premium wireless headset...',
  })
  generatedText: string;

  @ApiProperty({
    description: 'Model used for generation',
    example: 'mistral-7b',
  })
  model: string;

  @ApiProperty({
    description: 'Number of tokens used',
    example: 150,
  })
  tokensUsed: number;

  @ApiPropertyOptional({
    description: 'Confidence score of the generation',
    example: 0.95,
  })
  confidence?: number;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 1250,
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
