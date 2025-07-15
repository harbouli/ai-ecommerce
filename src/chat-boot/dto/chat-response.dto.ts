import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the chat session',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Title of the chat session',
    example: 'Shopping for Electronics',
  })
  title: string;

  @ApiProperty({
    description: 'User ID who owns this chat session',
    example: '507f1f77bcf86cd799439012',
  })
  userId: string;

  @ApiPropertyOptional({
    description: 'Context or topic of the chat',
    example: 'Looking for a new laptop for programming',
  })
  context?: string;

  @ApiProperty({
    description: 'Whether the chat session is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Number of messages in the chat',
    example: 5,
  })
  messageCount: number;

  @ApiProperty({
    description: 'When the chat session was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the chat session was last updated',
    example: '2024-01-15T14:30:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Last activity timestamp',
    example: '2024-01-15T14:30:00.000Z',
  })
  lastActivity?: Date;
}
