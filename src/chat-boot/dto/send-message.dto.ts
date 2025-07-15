import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'The message content to send to the chatbot',
    example: 'Can you recommend a good laptop for gaming?',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the message',
    example: { intent: 'product_recommendation', urgency: 'high' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
