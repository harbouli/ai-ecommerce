import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum AiSessionType {
  TEXT_GENERATION = 'text_generation',
  IMAGE_ANALYSIS = 'image_analysis',
  EMBEDDINGS = 'embeddings',
  SEMANTIC_SEARCH = 'semantic_search',
  MULTIMODAL = 'multimodal',
  GENERAL = 'general',
}

export class CreateAiSessionDto {
  @ApiPropertyOptional({
    description: 'Updated title of the AI session',
    example: 'Product Description Generation - Updated',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated context for the session',
    example: 'Generating enhanced product descriptions with SEO optimization',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  context?: string;

  @ApiPropertyOptional({
    description: 'Updated configuration settings',
    example: { model: 'mistral-7b', temperature: 0.8, maxTokens: 1500 },
  })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;
}
