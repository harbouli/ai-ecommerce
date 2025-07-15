import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsObject,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export class SemanticSearchDto {
  @ApiProperty({
    description: 'Search query',
    example: 'wireless gaming headsets with good battery life',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  query: string;

  @ApiPropertyOptional({
    description: 'Collection to search in',
    example: 'products',
  })
  @IsOptional()
  @IsString()
  collection?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Minimum similarity threshold',
    example: 0.7,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;

  @ApiPropertyOptional({
    description: 'Additional filters for the search',
    example: { category: 'electronics', price_range: { min: 50, max: 500 } },
  })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Session ID to associate this search with',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
