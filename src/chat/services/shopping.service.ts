import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeRepository } from '../infrastructure/persistence/knowledge.repository';
import { KnowledgeEntity } from '../domain/knowledge';

export interface SearchFilters {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  type?: KnowledgeEntity['type'];
  limit?: number;
}

export interface ShoppingRecommendation {
  entity: KnowledgeEntity;
  reason: string;
  confidence: number;
}

@Injectable()
export class ShoppingService {
  private readonly logger = new Logger(ShoppingService.name);

  constructor(private readonly knowledgeRepository: KnowledgeRepository) {}

  // ===== RAG-POWERED SEARCH =====
  async semanticProductSearch(
    query: string,
    filters?: SearchFilters,
  ): Promise<KnowledgeEntity[]> {
    try {
      this.logger.log(`Semantic search for: ${query}`);

      // Use hybrid search combining semantic and traditional search
      const searchFilters = {
        type: 'PRODUCT' as const,
        ...filters,
      };

      const results = await this.knowledgeRepository.hybridSearch(
        query,
        searchFilters,
      );

      this.logger.log(`Found ${results.length} products for semantic search`);
      return results;
    } catch (error) {
      this.logger.error('Semantic product search failed:', error);
      return [];
    }
  }

  async findSimilarProducts(
    productId: string,
    limit = 5,
  ): Promise<KnowledgeEntity[]> {
    try {
      const product = await this.knowledgeRepository.findById(productId);
      if (!product || product.type !== 'PRODUCT') {
        return [];
      }

      // Use vector similarity if available
      if (product.vector && product.vector.length > 0) {
        const similarProducts = await this.knowledgeRepository.findSimilar(
          product.vector,
          limit + 1,
        );
        return similarProducts
          .filter((p) => p.id !== productId)
          .slice(0, limit);
      }

      // Fallback to recommendations
      return this.knowledgeRepository.findRecommendations(productId, limit);
    } catch (error) {
      this.logger.error(
        `Failed to find similar products for ${productId}:`,
        error,
      );
      return [];
    }
  }

  // ===== KAG-POWERED RECOMMENDATIONS =====
  async getPersonalizedRecommendations(
    userId: string,
    preferences: string[],
    limit = 10,
  ): Promise<ShoppingRecommendation[]> {
    try {
      this.logger.log(`Generating recommendations for user: ${userId}`);

      const recommendations: ShoppingRecommendation[] = [];

      // 1. Get recommendations based on user preferences using semantic search
      for (const preference of preferences) {
        const products = await this.semanticProductSearch(preference, {
          limit: 3,
        });
        recommendations.push(
          ...products.map((product) => ({
            entity: product,
            reason: `Matches your interest in ${preference}`,
            confidence: 0.8,
          })),
        );
      }

      // 2. Find related products through graph relationships
      const userEntity = await this.knowledgeRepository.findById(userId);
      if (userEntity) {
        const relatedProducts = await this.knowledgeRepository.findRelated(
          userId,
          2,
        );
        const productRecommendations = relatedProducts
          .filter((entity) => entity.type === 'PRODUCT')
          .map((product) => ({
            entity: product,
            reason: 'Based on your browsing history',
            confidence: 0.7,
          }));

        recommendations.push(...productRecommendations);
      }

      // Remove duplicates and sort by confidence
      const uniqueRecommendations = recommendations.filter(
        (rec, index, self) =>
          index === self.findIndex((r) => r.entity.id === rec.entity.id),
      );

      return uniqueRecommendations
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, limit);
    } catch (error) {
      this.logger.error(
        `Failed to get personalized recommendations for ${userId}:`,
        error,
      );
      return [];
    }
  }

  async getProductRecommendations(
    productId: string,
    limit = 5,
  ): Promise<ShoppingRecommendation[]> {
    try {
      const recommendations =
        await this.knowledgeRepository.findRecommendations(productId, limit);

      return recommendations.map((product) => ({
        entity: product,
        reason: 'Customers who viewed this item also viewed',
        confidence: 0.75,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get product recommendations for ${productId}:`,
        error,
      );
      return [];
    }
  }

  // ===== CATEGORY AND BRAND BROWSING =====
  async getProductsByCategory(category: string): Promise<KnowledgeEntity[]> {
    try {
      return this.knowledgeRepository.findByCategory(category);
    } catch (error) {
      this.logger.error(
        `Failed to get products by category ${category}:`,
        error,
      );
      return [];
    }
  }

  async getProductsByBrand(brand: string): Promise<KnowledgeEntity[]> {
    try {
      return this.knowledgeRepository.findByBrand(brand);
    } catch (error) {
      this.logger.error(`Failed to get products by brand ${brand}:`, error);
      return [];
    }
  }

  async getCategories(): Promise<KnowledgeEntity[]> {
    try {
      return this.knowledgeRepository.findByType('CATEGORY');
    } catch (error) {
      this.logger.error('Failed to get categories:', error);
      return [];
    }
  }

  async getBrands(): Promise<KnowledgeEntity[]> {
    try {
      return this.knowledgeRepository.findByType('BRAND');
    } catch (error) {
      this.logger.error('Failed to get brands:', error);
      return [];
    }
  }

  // ===== CONVERSATIONAL SHOPPING ASSISTANCE =====
  async processShoppingQuery(
    query: string,
    userId?: string,
  ): Promise<{
    products: KnowledgeEntity[];
    recommendations: ShoppingRecommendation[];
    suggestions: string[];
  }> {
    try {
      this.logger.log(`Processing watch query: ${query}`);

      let products: KnowledgeEntity[] = [];
      let recommendations: ShoppingRecommendation[] = [];
      const suggestions: string[] = [];

      // Simple search logic
      if (query.toLowerCase().includes('smartwatch')) {
        products = await this.semanticProductSearch(query, {
          category: 'smartwatch',
          limit: 8,
        });
        suggestions.push(
          'Compare battery life',
          'Check phone compatibility',
          'See fitness features',
        );
      } else if (
        query.toLowerCase().includes('luxury') ||
        query.toLowerCase().includes('rolex')
      ) {
        products = await this.semanticProductSearch(query, {
          category: 'luxury',
          limit: 8,
        });
        suggestions.push(
          'View similar luxury watches',
          'Check availability',
          'Learn about the brand',
        );
      } else if (
        query.toLowerCase().includes('band') ||
        query.toLowerCase().includes('strap')
      ) {
        products = await this.getProductsByCategory('watch-bands');
        suggestions.push(
          'Check watch compatibility',
          'See different materials',
          'View size options',
        );
      } else {
        // General watch search
        products = await this.semanticProductSearch(query, { limit: 10 });
        suggestions.push(
          'Filter by price',
          'See similar styles',
          'Check our bestsellers',
        );
      }

      // Get simple recommendations
      if (products.length > 0 && userId) {
        recommendations = await this.getPersonalizedRecommendations(
          userId,
          [query],
          3,
        );
      }

      return { products, recommendations, suggestions };
    } catch (error) {
      this.logger.error('Failed to process watch query:', error);
      return {
        products: [],
        recommendations: [],
        suggestions: [
          'Browse smartwatches',
          'See luxury collection',
          'Check watch bands',
        ],
      };
    }
  }

  async getShoppingContext(userId: string): Promise<{
    recentlyViewed: KnowledgeEntity[];
    recommendations: ShoppingRecommendation[];
    trendingProducts: KnowledgeEntity[];
  }> {
    try {
      // Get user's recently viewed products through graph relationships
      const recentlyViewed = await this.knowledgeRepository.findRelated(
        userId,
        1,
      );
      const viewedProducts = recentlyViewed.filter(
        (entity) => entity.type === 'PRODUCT',
      );

      // Get personalized recommendations
      const recommendations = await this.getPersonalizedRecommendations(
        userId,
        [],
        5,
      );

      // Get trending products (simplified - could be based on recent popularity)
      const trendingProducts =
        await this.knowledgeRepository.findByType('PRODUCT');
      const trending = trendingProducts
        .filter((p) => p.properties?.rating >= 4.0)
        .sort(
          (a, b) =>
            (b.properties?.salesCount || 0) - (a.properties?.salesCount || 0),
        )
        .slice(0, 5);

      return {
        recentlyViewed: viewedProducts.slice(0, 5),
        recommendations,
        trendingProducts: trending,
      };
    } catch (error) {
      this.logger.error(`Failed to get shopping context for ${userId}:`, error);
      return { recentlyViewed: [], recommendations: [], trendingProducts: [] };
    }
  }

  // ===== HELPER METHODS =====
  private extractIntent(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('recommend') || lowerQuery.includes('suggest')) {
      return 'RECOMMENDATION';
    }
    if (lowerQuery.includes('category') || lowerQuery.includes('browse')) {
      return 'BROWSE_CATEGORY';
    }
    if (lowerQuery.includes('brand')) {
      return 'BROWSE_BRAND';
    }
    if (
      lowerQuery.includes('search') ||
      lowerQuery.includes('find') ||
      lowerQuery.includes('looking for')
    ) {
      return 'SEARCH';
    }

    return 'SEARCH'; // Default intent
  }

  private extractEntities(
    query: string,
  ): Array<{ type: string; value: string }> {
    const entities: Array<{ type: string; value: string }> = [];
    const lowerQuery = query.toLowerCase();

    // Simple entity extraction (in real implementation, use NLP)
    const commonCategories = [
      'electronics',
      'clothing',
      'books',
      'shoes',
      'phones',
      'laptops',
    ];
    const commonBrands = ['apple', 'samsung', 'nike', 'adidas', 'sony', 'hp'];

    commonCategories.forEach((category) => {
      if (lowerQuery.includes(category)) {
        entities.push({ type: 'CATEGORY', value: category });
      }
    });

    commonBrands.forEach((brand) => {
      if (lowerQuery.includes(brand)) {
        entities.push({ type: 'BRAND', value: brand });
      }
    });

    return entities;
  }
}
