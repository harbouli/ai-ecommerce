// dto/message-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductRecommendationDto } from './product-recommendation.dto';

export class MessageResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the message',
    example: '507f1f77bcf86cd799439013',
  })
  id: string;

  @ApiProperty({
    description: 'Chat session ID this message belongs to',
    example: '507f1f77bcf86cd799439011',
  })
  chatId: string;

  @ApiProperty({
    description: 'Content of the message',
    example: 'Can you recommend a good laptop for gaming?',
  })
  content: string;

  @ApiProperty({
    description: 'Role of the message sender',
    example: 'user',
    enum: ['user', 'assistant'],
  })
  role: 'user' | 'assistant';

  @ApiPropertyOptional({
    description: 'Additional metadata for the message',
    example: {
      model: 'mistral-ai',
      confidence: 0.95,
      reasoning: 'Based on your gaming preferences',
      processingTime: 1250,
      intent: 'product_recommendation',
    },
  })
  metadata?: {
    model?: string;
    confidence?: number;
    reasoning?: string;
    processingTime?: number;
    intent?: string;
    error?: boolean;
    errorMessage?: string;
    productCount?: number;
    searchQuery?: string;
    [key: string]: any;
  };

  @ApiProperty({
    description: 'When the message was created',
    example: '2024-01-15T14:30:00.000Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description:
      'Product recommendations associated with this message (for assistant messages)',
    type: [ProductRecommendationDto],
  })
  productRecommendations?: ProductRecommendationDto[];

  @ApiPropertyOptional({
    description: 'Indicates if this message contains product recommendations',
    example: true,
  })
  hasRecommendations?: boolean;

  @ApiPropertyOptional({
    description: 'Message type for better client-side handling',
    example: 'recommendation',
    enum: ['text', 'recommendation', 'search_result', 'error', 'greeting'],
  })
  messageType?:
    | 'text'
    | 'recommendation'
    | 'search_result'
    | 'error'
    | 'greeting';

  @ApiPropertyOptional({
    description: 'Confidence score for AI responses (0-1)',
    example: 0.95,
    minimum: 0,
    maximum: 1,
  })
  confidence?: number;

  @ApiPropertyOptional({
    description: 'Quick action buttons that can be displayed with the message',
    example: [
      {
        label: 'Show more like this',
        action: 'similar_products',
        data: { productId: '123' },
      },
      {
        label: 'Add to cart',
        action: 'add_to_cart',
        data: { productId: '123' },
      },
    ],
  })
  quickActions?: Array<{
    label: string;
    action: string;
    data?: Record<string, any>;
  }>;

  @ApiPropertyOptional({
    description: 'Follow-up suggestions for the user',
    example: [
      'Tell me more about gaming laptops under $1500',
      'What are the best brands for gaming?',
      'Show me similar products',
    ],
  })
  followUpSuggestions?: string[];
}
