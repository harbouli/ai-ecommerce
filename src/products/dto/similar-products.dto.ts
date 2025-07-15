import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SimilarProductsDto {
  @ApiProperty({
    description: 'Maximum number of similar products to return',
    example: 5,
    required: false,
    minimum: 1,
    maximum: 50,
    default: 5,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 5;

  @ApiProperty({
    description: 'Minimum similarity threshold (0.0 to 1.0)',
    example: 0.6,
    required: false,
    minimum: 0,
    maximum: 1,
    default: 0.6,
  })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number = 0.6;

  @ApiProperty({
    description: 'Include only active products in results',
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
    description: 'Include only products with stock available',
    example: true,
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
  inStockOnly?: boolean = false;

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

  @ApiProperty({
    description:
      'Exclude products from the same category as the source product',
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
  excludeSameCategory?: boolean = false;
}
