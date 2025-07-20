import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Product } from '../../products/domain/product';
import { QueryAnalysis } from './query-analysis';

export class ProductContext {
  @ApiProperty({
    type: [Product],
    description: 'Array of relevant products found from semantic search',
    isArray: true,
  })
  products: Product[];

  @ApiProperty({
    type: String,
    example: 'luxury Rolex Submariner',
    description: 'Original search query used to find products',
  })
  searchQuery: string;

  @ApiProperty({
    type: Number,
    example: 0.85,
    description: 'Relevance score indicating how well products match the query',
    minimum: 0,
    maximum: 1,
  })
  relevanceScore: number;

  @ApiProperty({
    type: String,
    enum: ['semantic', 'hybrid', 'filtered'],
    example: 'semantic',
    description: 'Search method used to find the products',
  })
  searchMethod: 'semantic' | 'hybrid' | 'filtered';

  constructor(
    products: Product[],
    searchQuery: string,
    relevanceScore: number,
    searchMethod: 'semantic' | 'hybrid' | 'filtered',
  ) {
    this.products = products;
    this.searchQuery = searchQuery;
    this.relevanceScore = relevanceScore;
    this.searchMethod = searchMethod;
  }

  /**
   * Get the number of products found
   */
  getProductCount(): number {
    return this.products.length;
  }

  /**
   * Check if any products were found
   */
  hasProducts(): boolean {
    return this.products.length > 0;
  }

  /**
   * Get products within a specific price range
   */
  getProductsInPriceRange(minPrice?: number, maxPrice?: number): Product[] {
    return this.products.filter((product) => {
      const price = product.salePrice || product.price;
      if (!price) return false;

      if (minPrice && price < minPrice) return false;
      if (maxPrice && price > maxPrice) return false;

      return true;
    });
  }

  /**
   * Get featured products from the search results
   */
  getFeaturedProducts(): Product[] {
    return this.products.filter((product) => product.isFeatured);
  }

  /**
   * Get products that are currently in stock
   */
  getInStockProducts(): Product[] {
    return this.products.filter(
      (product) => product.stock && product.stock > 0,
    );
  }

  /**
   * Get product names as a formatted string
   */
  getProductNamesString(): string {
    return this.products.map((p) => p.name).join(', ');
  }

  /**
   * Check if the search was successful (high relevance)
   */
  isHighRelevance(threshold: number = 0.7): boolean {
    return this.relevanceScore >= threshold;
  }
}

export class QueryAnalysisWithProducts extends QueryAnalysis {
  @ApiPropertyOptional({
    type: () => ProductContext,
    description: 'Product context with relevant products from the store',
  })
  productContext?: ProductContext;

  constructor(
    intent: any,
    entities: any[],
    processingTime: number,
    productContext?: ProductContext,
  ) {
    super(intent, entities, processingTime);
    this.productContext = productContext;
  }

  /**
   * Check if product context is available
   */
  hasProductContext(): boolean {
    return Boolean(this.productContext && this.productContext.hasProducts());
  }

  /**
   * Get the number of relevant products found
   */
  getRelevantProductCount(): number {
    return this.productContext?.getProductCount() || 0;
  }

  /**
   * Get summary including product information
   */
  getEnhancedSummary(): {
    intent: string;
    intentConfidence: number;
    entityCount: number;
    entityTypes: string[];
    productCount: number;
    searchMethod?: string;
    relevanceScore?: number;
    processingTime: number;
  } {
    const baseSummary = this.getSummary();

    return {
      ...baseSummary,
      productCount: this.getRelevantProductCount(),
      searchMethod: this.productContext?.searchMethod,
      relevanceScore: this.productContext?.relevanceScore,
    };
  }
}
