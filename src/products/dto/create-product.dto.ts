import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsDate,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    required: true,
    type: String,
    example: 'iPhone 15 Pro',
  })
  @IsString()
  name: string;

  @ApiProperty({
    required: false,
    type: String,
    example: 'Latest iPhone with advanced features',
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({
    required: false,
    type: String,
    example: 'iphone-15-pro',
  })
  @IsOptional()
  @IsString()
  slug?: string | null;

  @ApiProperty({
    required: true,
    type: Number,
    example: 999.99,
  })
  @IsNumber()
  price: number;

  @ApiProperty({
    required: false,
    type: Number,
    example: 800.0,
  })
  @IsOptional()
  @IsNumber()
  costPrice?: number | null;

  @ApiProperty({
    required: false,
    type: Number,
    example: 899.99,
  })
  @IsOptional()
  @IsNumber()
  salePrice?: number | null;

  @ApiProperty({
    required: true,
    type: Number,
    example: 100,
  })
  @IsNumber()
  stock: number;

  @ApiProperty({
    required: false,
    type: Number,
    example: 0.5,
  })
  @IsOptional()
  @IsNumber()
  weight?: number | null;

  @ApiProperty({
    required: false,
    type: String,
    example: '15.7 x 7.6 x 0.8 cm',
  })
  @IsOptional()
  @IsString()
  dimensions?: string | null;

  @ApiProperty({
    required: false,
    type: String,
    example: 'Space Black',
  })
  @IsOptional()
  @IsString()
  color?: string | null;

  @ApiProperty({
    required: false,
    type: String,
    example: '256GB',
  })
  @IsOptional()
  @IsString()
  size?: string | null;

  @ApiProperty({
    required: false,
    type: Boolean,
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    required: false,
    type: Boolean,
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({
    required: false,
    type: Boolean,
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDigital?: boolean;

  @ApiProperty({
    required: false,
    type: String,
    example: 'iPhone 15 Pro - Latest Apple Smartphone',
  })
  @IsOptional()
  @IsString()
  metaTitle?: string | null;

  @ApiProperty({
    required: false,
    type: String,
    example:
      'Discover the iPhone 15 Pro with advanced features and cutting-edge technology.',
  })
  @IsOptional()
  @IsString()
  metaDescription?: string | null;

  @ApiProperty({
    required: false,
    type: Date,
  })
  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  publishedAt?: Date | null;

  @ApiProperty({
    required: false,
    type: Date,
  })
  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  expiresAt?: Date | null;
}
