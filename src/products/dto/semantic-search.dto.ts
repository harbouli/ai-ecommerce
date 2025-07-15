import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SemanticSearchDto {
  @ApiProperty({
    description: 'Natural language search query for semantic search',
    example: 'comfortable running shoes for marathon',
    required: true,
  })
  @IsString()
  q: string;

  @ApiProperty({
    description: 'Maximum number of results to return',
    example: 10,
    required: false,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    description:
      'Similarity threshold (0.0 to 1.0). Higher values return more similar results',
    example: 0.7,
    required: false,
    minimum: 0,
    maximum: 1,
    default: 0.7,
  })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number = 0.7;

  @ApiProperty({
    description: 'Include only active products in search results',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean()
  activeOnly?: boolean = true;

  @ApiProperty({
    description: 'Include similarity scores in the response',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean()
  includeScores?: boolean = false;
}
