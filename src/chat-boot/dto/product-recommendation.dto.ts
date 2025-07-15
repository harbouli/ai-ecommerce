import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductRecommendationDto {
  @ApiProperty({
    description: 'Unique identifier of the recommended product',
    example: '507f1f77bcf86cd799439014',
  })
  productId: string;

  @ApiProperty({
    description: 'Name of the recommended product',
    example: 'ASUS ROG Strix G15 Gaming Laptop',
  })
  productName: string;

  @ApiProperty({
    description: 'Description of the product',
    example: 'High-performance gaming laptop with RTX 3070 and AMD Ryzen 7',
  })
  description: string;

  @ApiProperty({
    description: 'Price of the product',
    example: 1299.99,
  })
  price: number;

  @ApiPropertyOptional({
    description: 'URL of the product image',
    example: 'https://example.com/images/asus-rog-strix-g15.jpg',
  })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Category name of the product',
    example: 'Gaming Laptops',
  })
  categoryName?: string;

  @ApiPropertyOptional({
    description: 'Brand name of the product',
    example: 'ASUS',
  })
  brandName?: string;

  @ApiProperty({
    description: 'Confidence score of the recommendation (0-1)',
    example: 0.95,
  })
  confidence: number;

  @ApiProperty({
    description: 'Explanation of why this product was recommended',
    example:
      'Recommended based on your preference for high-performance gaming laptops',
  })
  reasoning: string;

  @ApiPropertyOptional({
    description: 'Key features of the product',
    example: ['RTX 3070 Graphics', 'AMD Ryzen 7 5800H', '16GB RAM', '1TB SSD'],
  })
  features?: string[];
}
