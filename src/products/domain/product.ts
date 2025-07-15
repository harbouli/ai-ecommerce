import { ApiProperty } from '@nestjs/swagger';

export class Product {
  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'iPhone 15 Pro',
  })
  name: string;

  @ApiProperty({
    type: String,
    example: 'Latest iPhone with advanced features',
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    type: String,
    example: 'iphone-15-pro',
    nullable: true,
  })
  slug?: string | null;

  @ApiProperty({
    type: Number,
    example: 999.99,
  })
  price: number;

  @ApiProperty({
    type: Number,
    example: 800.0,
    nullable: true,
  })
  costPrice?: number | null;

  @ApiProperty({
    type: Number,
    example: 899.99,
    nullable: true,
  })
  salePrice?: number | null;

  @ApiProperty({
    type: Number,
    example: 100,
  })
  stock?: number | null;

  @ApiProperty({
    type: Number,
    example: 0.5,
    nullable: true,
  })
  weight?: number | null;

  @ApiProperty({
    type: String,
    example: '15.7 x 7.6 x 0.8 cm',
    nullable: true,
  })
  dimensions?: string | null;

  @ApiProperty({
    type: String,
    example: 'Space Black',
    nullable: true,
  })
  color?: string | null;

  @ApiProperty({
    type: String,
    example: '256GB',
    nullable: true,
  })
  size?: string | null;

  @ApiProperty({
    type: Boolean,
    example: true,
    default: true,
  })
  isActive?: boolean;

  @ApiProperty({
    type: Boolean,
    example: false,
    default: false,
  })
  isFeatured?: boolean;

  @ApiProperty({
    type: Boolean,
    example: false,
    default: false,
  })
  isDigital?: boolean;

  @ApiProperty({
    type: String,
    example: 'iPhone 15 Pro - Latest Apple Smartphone',
    nullable: true,
  })
  metaTitle?: string | null;

  @ApiProperty({
    type: String,
    example:
      'Discover the iPhone 15 Pro with advanced features and cutting-edge technology.',
    nullable: true,
  })
  metaDescription?: string | null;

  @ApiProperty({
    type: Date,
    nullable: true,
  })
  publishedAt?: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
  })
  expiresAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
