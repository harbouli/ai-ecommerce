import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export class GenerateEmbeddingDto {
  @ApiProperty({
    description: 'Text to generate embeddings for',
    example: 'High-quality wireless gaming headset with noise cancellation',
    minLength: 1,
    maxLength: 8000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  text: string;

  @ApiPropertyOptional({
    description: 'Embedding model to use',
    example: 'text-embedding-ada-002',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Number of dimensions for the embedding',
    example: 1536,
    minimum: 64,
    maximum: 4096,
  })
  @IsOptional()
  @IsInt()
  @Min(64)
  @Max(4096)
  dimensions?: number;

  @ApiPropertyOptional({
    description: 'Session ID to associate this embedding with',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
