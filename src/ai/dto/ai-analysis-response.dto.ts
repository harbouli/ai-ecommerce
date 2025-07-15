import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DetectedObject {
  @ApiProperty({
    description: 'Object label',
    example: 'headset',
  })
  label: string;

  @ApiProperty({
    description: 'Confidence score',
    example: 0.95,
  })
  confidence: number;

  @ApiPropertyOptional({
    description: 'Bounding box coordinates',
    example: { x: 100, y: 150, width: 200, height: 180 },
  })
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class AiAnalysisResponseDto {
  @ApiProperty({
    description: 'Analysis result or description',
    example:
      'The image shows a black wireless gaming headset with RGB lighting...',
  })
  analysis: string;

  @ApiPropertyOptional({
    description: 'Overall confidence score',
    example: 0.92,
  })
  confidence?: number;

  @ApiPropertyOptional({
    description: 'Detected objects in the image',
    type: [DetectedObject],
  })
  detectedObjects?: DetectedObject[];

  @ApiPropertyOptional({
    description: 'Extracted text from the image',
    example: 'GAMING HEADSET\nPremium Quality',
  })
  extractedText?: string;

  @ApiProperty({
    description: 'Model used for analysis',
    example: 'vision-transformer',
  })
  model: string;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 2100,
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
