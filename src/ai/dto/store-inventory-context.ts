// src/ai/domain/store-inventory-context.ts
import { ApiProperty } from '@nestjs/swagger';

export class StoreInventoryContext {
  @ApiProperty({
    description: 'Available watch brands in the store',
    example: ['Apple', 'Samsung', 'Rolex', 'Omega', 'Casio', 'Garmin'],
    type: [String],
  })
  brands: string[];

  @ApiProperty({
    description: 'Available colors for watches',
    example: ['black', 'white', 'silver', 'gold', 'blue', 'red'],
    type: [String],
  })
  colors: string[];

  @ApiProperty({
    description: 'Available materials for watch construction',
    example: ['stainless steel', 'aluminum', 'leather', 'silicone', 'ceramic'],
    type: [String],
  })
  materials: string[];

  @ApiProperty({
    description: 'Types of watches available',
    example: [
      'smartwatch',
      'mechanical',
      'digital',
      'sports watch',
      'dress watch',
    ],
    type: [String],
  })
  types: string[];

  @ApiProperty({
    description: 'Price ranges available in the store',
    example: [
      'budget (under $100)',
      'mid-range ($500-1000)',
      'luxury ($5000+)',
    ],
    type: [String],
  })
  priceRanges: string[];

  @ApiProperty({
    description: 'Available watch sizes',
    example: ['38mm', '40mm', '42mm', '44mm', 'small', 'medium', 'large'],
    type: [String],
  })
  sizes: string[];

  @ApiProperty({
    description: 'Watch styles available',
    example: ['casual', 'formal', 'sport', 'luxury', 'vintage'],
    type: [String],
  })
  styles: string[];

  @ApiProperty({
    description: 'Features available in watches',
    example: ['GPS', 'heart rate', 'waterproof', 'bluetooth', 'sleep tracking'],
    type: [String],
  })
  features: string[];

  constructor(
    brands: string[] = [],
    colors: string[] = [],
    materials: string[] = [],
    types: string[] = [],
    priceRanges: string[] = [],
    sizes: string[] = [],
    styles: string[] = [],
    features: string[] = [],
  ) {
    this.brands = brands;
    this.colors = colors;
    this.materials = materials;
    this.types = types;
    this.priceRanges = priceRanges;
    this.sizes = sizes;
    this.styles = styles;
    this.features = features;
  }

  @ApiProperty({
    description: 'Total number of unique inventory tags',
    example: 45,
    readOnly: true,
  })
  get totalTagCount(): number {
    return (
      this.brands.length +
      this.colors.length +
      this.materials.length +
      this.types.length +
      this.priceRanges.length +
      this.sizes.length +
      this.styles.length +
      this.features.length
    );
  }

  @ApiProperty({
    description: 'Summary of inventory context',
    example:
      'Inventory Context: 6 brands, 6 colors, 5 materials, 5 types, 3 features',
    readOnly: true,
  })
  get summary(): string {
    return `Inventory Context: ${this.brands.length} brands, ${this.colors.length} colors, ${this.materials.length} materials, ${this.types.length} types, ${this.features.length} features`;
  }

  /**
   * Check if inventory context has meaningful data
   */
  hasData(): boolean {
    return this.totalTagCount > 0;
  }

  /**
   * Get all tags as a flat array for search purposes
   */
  getAllTags(): string[] {
    return [
      ...this.brands,
      ...this.colors,
      ...this.materials,
      ...this.types,
      ...this.priceRanges,
      ...this.sizes,
      ...this.styles,
      ...this.features,
    ];
  }

  /**
   * Find matching tags in query
   */
  findMatchingTags(
    query: string,
  ): Array<{ tag: string; type: string; confidence: number }> {
    const lowerQuery = query.toLowerCase();
    const matches: Array<{ tag: string; type: string; confidence: number }> =
      [];

    const tagCategories = [
      { tags: this.brands, type: 'WATCH_BRAND' },
      { tags: this.colors, type: 'COLOR' },
      { tags: this.materials, type: 'MATERIAL' },
      { tags: this.types, type: 'WATCH_TYPE' },
      { tags: this.priceRanges, type: 'PRICE_RANGE' },
      { tags: this.sizes, type: 'SIZE' },
      { tags: this.styles, type: 'WATCH_STYLE' },
      { tags: this.features, type: 'FEATURES' },
    ];

    tagCategories.forEach(({ tags, type }) => {
      tags.forEach((tag) => {
        const lowerTag = tag.toLowerCase();
        if (lowerQuery.includes(lowerTag)) {
          let confidence = 0.8;
          if (lowerQuery === lowerTag) confidence = 1.0;
          else if (
            lowerQuery.startsWith(lowerTag) ||
            lowerQuery.endsWith(lowerTag)
          )
            confidence = 0.9;

          matches.push({ tag, type, confidence });
        }
      });
    });

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Create from plain object
   */
  static fromJSON(data: Partial<StoreInventoryContext>): StoreInventoryContext {
    return new StoreInventoryContext(
      data.brands || [],
      data.colors || [],
      data.materials || [],
      data.types || [],
      data.priceRanges || [],
      data.sizes || [],
      data.styles || [],
      data.features || [],
    );
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): Record<string, any> {
    return {
      brands: this.brands,
      colors: this.colors,
      materials: this.materials,
      types: this.types,
      priceRanges: this.priceRanges,
      sizes: this.sizes,
      styles: this.styles,
      features: this.features,
      totalTagCount: this.totalTagCount,
      summary: this.summary,
    };
  }
}
