import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsDate,
  IsArray,
  Min,
  Length,
  ArrayMaxSize,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    required: true,
    type: String,
    example: 'Rolex Submariner Date',
    description: 'The name of the product',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({
    required: false,
    type: String,
    example:
      'Professional diving watch with date function, ceramic bezel, and automatic movement. Water resistant to 300 meters.',
    description: 'Detailed description of the product',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;

  @ApiProperty({
    required: false,
    type: String,
    example: 'rolex-submariner-date-41mm',
    description: 'URL-friendly slug for the product',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  slug?: string | null;

  @ApiProperty({
    required: true,
    type: Number,
    example: 13150.0,
    description: 'The selling price of the product',
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiProperty({
    required: false,
    type: Number,
    example: 8000.0,
    description: 'The cost price of the product',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice?: number | null;

  @ApiProperty({
    required: false,
    type: Number,
    example: 12500.0,
    description: 'The sale price when product is on discount',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salePrice?: number | null;

  @ApiProperty({
    required: false,
    type: Number,
    example: 5,
    description: 'Available stock quantity',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number | null;

  @ApiProperty({
    required: false,
    type: Number,
    example: 0.155,
    description: 'Weight of the product in kilograms',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  weight?: number | null;

  @ApiProperty({
    required: false,
    type: String,
    example: '41mm x 12.5mm',
    description: 'Physical dimensions of the product',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  dimensions?: string | null;

  @ApiProperty({
    required: false,
    type: String,
    example: 'Black',
    description: 'Primary color of the product',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  color?: string | null;

  @ApiProperty({
    required: false,
    type: String,
    example: '41mm',
    description: 'Size specification of the product',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  size?: string | null;

  @ApiProperty({
    required: false,
    type: Boolean,
    example: true,
    default: true,
    description: 'Whether the product is active and available for sale',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    required: false,
    type: Boolean,
    example: true,
    default: false,
    description: 'Whether the product is featured/highlighted',
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({
    required: false,
    type: Boolean,
    example: false,
    default: false,
    description: 'Whether the product is digital (downloadable/virtual)',
  })
  @IsOptional()
  @IsBoolean()
  isDigital?: boolean;

  @ApiProperty({
    required: false,
    type: String,
    example: 'Rolex Submariner Date 41mm - Luxury Diving Watch',
    description: 'SEO meta title for the product page',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @Length(0, 60)
  metaTitle?: string | null;

  @ApiProperty({
    required: false,
    type: String,
    example:
      'Premium Swiss diving watch with ceramic bezel, automatic movement, and 300m water resistance.',
    description: 'SEO meta description for the product page',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  metaDescription?: string | null;

  @ApiProperty({
    required: false,
    type: Date,
    example: '2024-01-01T00:00:00.000Z',
    description: 'Date when the product becomes available',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : null))
  @IsDate()
  publishedAt?: Date | null;

  @ApiProperty({
    required: false,
    type: Date,
    example: '2025-12-31T23:59:59.999Z',
    description: 'Date when the product expires or becomes unavailable',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : null))
  @IsDate()
  expiresAt?: Date | null;

  // NEW FIELDS FOR NEO4J SUPPORT
  @ApiProperty({
    required: false,
    type: String,
    example: 'Luxury Watches',
    description: 'Product category for classification and filtering',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  category?: string | null;

  @ApiProperty({
    required: false,
    type: String,
    example: 'Rolex',
    description: 'Brand or manufacturer of the product',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  brand?: string | null;

  @ApiProperty({
    required: false,
    type: [String],
    example: [
      'diving',
      'luxury',
      'automatic',
      'swiss',
      'waterproof',
      'ceramic-bezel',
    ],
    description: 'Tags for better searchability and categorization',
    maxItems: 20,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  @Length(1, 50, { each: true })
  tags?: string[];
}
