import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiSessionType } from './create-ai-session.dto';

export class AiSessionResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the AI session',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Title of the AI session',
    example: 'Product Description Generation',
  })
  title: string;

  @ApiProperty({
    description: 'User ID who owns this session',
    example: '507f1f77bcf86cd799439012',
  })
  userId: string;

  @ApiProperty({
    description: 'Type of AI session',
    example: 'text_generation',
    enum: AiSessionType,
  })
  sessionType: AiSessionType;

  @ApiPropertyOptional({
    description: 'Context or description of the session',
    example: 'Generating product descriptions for e-commerce items',
  })
  context?: string;

  @ApiPropertyOptional({
    description: 'Configuration settings for the session',
    example: { model: 'mistral-7b', temperature: 0.7 },
  })
  configuration?: Record<string, any>;

  @ApiProperty({
    description: 'Whether the session is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Number of interactions in the session',
    example: 5,
  })
  interactionCount: number;

  @ApiProperty({
    description: 'When the session was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the session was last updated',
    example: '2024-01-15T14:30:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Last activity timestamp',
    example: '2024-01-15T14:30:00.000Z',
  })
  lastActivity?: Date;
}
