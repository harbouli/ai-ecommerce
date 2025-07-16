import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMessage } from './chat-message';
import { ExtractedEntity } from './extracted-entity';
import { TextSummary } from './text-summary';

export class AIConversationContext {
  @ApiProperty({
    type: String,
    example: 'context_123',
    description: 'Unique identifier for the conversation context',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'session_456',
    description: 'Session identifier',
  })
  sessionId: string;

  @ApiProperty({
    type: String,
    example: 'user_789',
    description: 'User identifier',
  })
  userId: string;

  @ApiProperty({
    type: [ChatMessage],
    description: 'List of chat messages in the conversation',
  })
  messages: ChatMessage[];

  @ApiPropertyOptional({
    type: String,
    example: 'PRODUCT_SEARCH',
    description: 'Current conversation intent',
  })
  currentIntent?: string;

  @ApiProperty({
    type: [ExtractedEntity],
    description: 'Entities extracted from the conversation',
  })
  extractedEntities: ExtractedEntity[];

  @ApiPropertyOptional({
    type: () => TextSummary,
    description: 'Summary of the conversation',
  })
  summary?: TextSummary;

  @ApiProperty({
    type: Boolean,
    example: true,
    description: 'Whether the conversation is active',
  })
  isActive: boolean;

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
    this.messages = [];
    this.extractedEntities = [];
    this.isActive = true;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
