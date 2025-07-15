import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class HybridSearchDto {
  @ApiProperty({
    description: 'Natural language search query',
    example: 'comfortable running shoes for marathon',
  })
  @IsString()
  q: string;

  @ApiProperty({
    description: 'Minimum price filter',
    example: 50,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiProperty({
    description: 'Maximum price filter',
    example: 200,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiProperty({
    description: 'Product category filter',
    example: 'footwear',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    description: 'Filter by active status',
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Maximum number of results',
    example: 10,
    required: false,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
