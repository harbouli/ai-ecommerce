import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export class GenerateTextDto {
  @ApiProperty({
    description: 'The prompt for text generation',
    example: 'Write a product description for a wireless gaming headset',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  prompt: string;

  @ApiPropertyOptional({
    description: 'AI model to use for generation',
    example: 'mistral-7b',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of tokens to generate',
    example: 1000,
    minimum: 1,
    maximum: 4000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4000)
  maxTokens?: number;

  @ApiPropertyOptional({
    description: 'Temperature for generation (0.0 to 2.0)',
    example: 0.7,
    minimum: 0,
    maximum: 2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    description: 'System prompt to guide the AI behavior',
    example:
      'You are a professional copywriter specializing in e-commerce product descriptions.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  systemPrompt?: string;

  @ApiPropertyOptional({
    description: 'Additional context for the generation',
    example: 'Target audience: gaming enthusiasts, age 18-35',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  context?: string;

  @ApiPropertyOptional({
    description: 'Session ID to associate this generation with',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
