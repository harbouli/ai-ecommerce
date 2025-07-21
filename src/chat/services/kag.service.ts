import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeGraphRepository } from '../infrastructure/persistence/graph/repositories/knowledge-graph.repository';
import { KnowledgeEntity, KnowledgeRelationship } from '../domain/knowledge';
import { AIService } from '../../ai/ai.service';
import { IKagService } from '../interfaces/kag.service.interface';

@Injectable()
export class KagService implements IKagService {
  private readonly logger = new Logger(KagService.name);

  constructor(
    private readonly knowledgeGraphRepository: KnowledgeGraphRepository,
    private readonly aiService: AIService,
  ) {}

  async buildKnowledgeGraph(products: any[]): Promise<void> {
    try {
      this.logger.log(
        `Building knowledge graph for ${products.length} products`,
      );

      // Step 1: Create knowledge entities for each product
      const productEntities: KnowledgeEntity[] = [];
      const categoryEntities: Map<string, KnowledgeEntity> = new Map();
      const brandEntities: Map<string, KnowledgeEntity> = new Map();

      for (const product of products) {
        // Generate vector embedding for the product
        const productText =
          `${product.name} ${product.description || ''} ${product.category || ''} ${product.brand || ''}`.trim();
        const vector = await this.aiService.generateEmbedding(productText);

        // Create product entity
        const productEntity: KnowledgeEntity = {
          id: `product_${product.id}`,
          type: 'PRODUCT',
          name: product.name,
          description: product.description || '',
          properties: {
            originalProductId: product.id,
            price: product.price,
            category: product.category,
            brand: product.brand,
            isActive: product.isActive,
            isFeatured: product.isFeatured,
            tags: product.tags || [],
            slug: product.slug,
          },
          vector: vector,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        productEntities.push(productEntity);
        await this.knowledgeGraphRepository.createKnowledgeEntity(
          productEntity,
        );

        // Create or update category entity
        if (product.category && !categoryEntities.has(product.category)) {
          const categoryVector = await this.aiService.generateEmbedding(
            product.category,
          );
          const categoryEntity: KnowledgeEntity = {
            id: `category_${product.category.toLowerCase().replace(/\s+/g, '_')}`,
            type: 'CATEGORY',
            name: product.category,
            description: `Product category: ${product.category}`,
            properties: {
              productCount: 1,
            },
            vector: categoryVector,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          categoryEntities.set(product.category, categoryEntity);
          await this.knowledgeGraphRepository.createKnowledgeEntity(
            categoryEntity,
          );
        } else if (product.category && categoryEntities.has(product.category)) {
          // Increment product count
          const categoryEntity = categoryEntities.get(product.category)!;
          categoryEntity.properties.productCount++;
        }

        // Create or update brand entity
        if (product.brand && !brandEntities.has(product.brand)) {
          const brandVector = await this.aiService.generateEmbedding(
            product.brand,
          );
          const brandEntity: KnowledgeEntity = {
            id: `brand_${product.brand.toLowerCase().replace(/\s+/g, '_')}`,
            type: 'BRAND',
            name: product.brand,
            description: `Brand: ${product.brand}`,
            properties: {
              productCount: 1,
            },
            vector: brandVector,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          brandEntities.set(product.brand, brandEntity);
          await this.knowledgeGraphRepository.createKnowledgeEntity(
            brandEntity,
          );
        } else if (product.brand && brandEntities.has(product.brand)) {
          // Increment product count
          const brandEntity = brandEntities.get(product.brand)!;
          brandEntity.properties.productCount++;
        }
      }

      // Step 2: Create relationships between entities
      await this.createProductRelationships(
        productEntities,
        categoryEntities,
        brandEntities,
      );

      // Step 3: Create similarity relationships based on embeddings
      await this.createSimilarityRelationships(productEntities);

      this.logger.log(
        `Knowledge graph built successfully with ${productEntities.length} products, ${categoryEntities.size} categories, ${brandEntities.size} brands`,
      );
    } catch (error) {
      this.logger.error('Error building knowledge graph:', error);
      throw new Error(`Failed to build knowledge graph: ${error.message}`);
    }
  }

  async findRelatedProducts(productId: string): Promise<any[]> {
    try {
      this.logger.log(`Finding related products for: ${productId}`);

      const knowledgeEntityId = `product_${productId}`;

      // Find related entities in the knowledge graph
      const relatedEntities =
        await this.knowledgeGraphRepository.findRelatedEntities(
          knowledgeEntityId,
          2, // 2 hops: product -> category/brand -> other products
        );

      // Filter to only product entities and exclude the original product
      const relatedProductEntities = relatedEntities.filter(
        (entity) =>
          entity.type === 'PRODUCT' && entity.id !== knowledgeEntityId,
      );

      // Convert knowledge entities back to product format
      const relatedProducts = relatedProductEntities.map((entity) => ({
        id:
          entity.properties?.originalProductId ||
          entity.id.replace('product_', ''),
        name: entity.name,
        description: entity.description,
        price: entity.properties?.price,
        category: entity.properties?.category,
        brand: entity.properties?.brand,
        isActive: entity.properties?.isActive,
        isFeatured: entity.properties?.isFeatured,
        tags: entity.properties?.tags || [],
        slug: entity.properties?.slug,
        relationshipScore: this.calculateRelationshipScore(entity),
      }));

      // Sort by relationship score (strongest relationships first)
      relatedProducts.sort((a, b) => b.relationshipScore - a.relationshipScore);

      this.logger.log(`Found ${relatedProducts.length} related products`);
      return relatedProducts.slice(0, 10); // Return top 10 related products
    } catch (error) {
      this.logger.error('Error finding related products:', error);
      throw new Error(`Failed to find related products: ${error.message}`);
    }
  }

  async getProductRecommendations(productId: string): Promise<any[]> {
    try {
      this.logger.log(`Getting product recommendations for: ${productId}`);

      const knowledgeEntityId = `product_${productId}`;

      // Get the product entity to understand its characteristics
      const productEntity =
        await this.knowledgeGraphRepository.findRelatedEntities(
          knowledgeEntityId,
          0,
        );

      if (!productEntity || productEntity.length === 0) {
        this.logger.warn(`Product entity not found: ${knowledgeEntityId}`);
        return [];
      }

      const baseProduct = productEntity[0];
      const recommendations: any[] = [];

      // Strategy 1: Find products in the same category
      if (baseProduct.properties?.category) {
        const categoryEntity = `category_${baseProduct.properties.category.toLowerCase().replace(/\s+/g, '_')}`;
        const categoryProducts =
          await this.knowledgeGraphRepository.findRelatedEntities(
            categoryEntity,
            1,
          );

        const sameCategoryProducts = categoryProducts
          .filter(
            (entity) =>
              entity.type === 'PRODUCT' && entity.id !== knowledgeEntityId,
          )
          .map((entity) => ({
            ...this.mapEntityToProduct(entity),
            recommendationReason: 'Same Category',
            recommendationScore: 0.8,
          }));

        recommendations.push(...sameCategoryProducts);
      }

      // Strategy 2: Find products from the same brand
      if (baseProduct.properties?.brand) {
        const brandEntity = `brand_${baseProduct.properties.brand.toLowerCase().replace(/\s+/g, '_')}`;
        const brandProducts =
          await this.knowledgeGraphRepository.findRelatedEntities(
            brandEntity,
            1,
          );

        const sameBrandProducts = brandProducts
          .filter(
            (entity) =>
              entity.type === 'PRODUCT' && entity.id !== knowledgeEntityId,
          )
          .map((entity) => ({
            ...this.mapEntityToProduct(entity),
            recommendationReason: 'Same Brand',
            recommendationScore: 0.7,
          }));

        recommendations.push(...sameBrandProducts);
      }

      // Strategy 3: Find products with similar price ranges
      const similarPriceProducts = await this.findSimilarPriceProducts(
        baseProduct,
        knowledgeEntityId,
      );
      recommendations.push(...similarPriceProducts);

      // Strategy 4: Vector similarity-based recommendations
      if (baseProduct.vector && baseProduct.vector.length > 0) {
        const vectorSimilarProducts = await this.findVectorSimilarProducts(
          baseProduct,
          knowledgeEntityId,
        );
        recommendations.push(...vectorSimilarProducts);
      }

      // Remove duplicates and sort by recommendation score
      const uniqueRecommendations =
        this.removeDuplicateRecommendations(recommendations);
      uniqueRecommendations.sort(
        (a, b) => b.recommendationScore - a.recommendationScore,
      );

      this.logger.log(
        `Generated ${uniqueRecommendations.length} product recommendations`,
      );
      return uniqueRecommendations.slice(0, 8); // Return top 8 recommendations
    } catch (error) {
      this.logger.error('Error getting product recommendations:', error);
      throw new Error(
        `Failed to get product recommendations: ${error.message}`,
      );
    }
  }

  async updateProductRelationships(productId: string): Promise<void> {
    try {
      this.logger.log(`Updating product relationships for: ${productId}`);

      const knowledgeEntityId = `product_${productId}`;

      // Find all existing relationships for this product
      const existingRelationships =
        await this.knowledgeGraphRepository.findEntityRelationships(
          knowledgeEntityId,
        );

      // Get the updated product entity
      const relatedEntities =
        await this.knowledgeGraphRepository.findRelatedEntities(
          knowledgeEntityId,
          0,
        );

      if (!relatedEntities || relatedEntities.length === 0) {
        this.logger.warn(
          `Product entity not found for relationship update: ${knowledgeEntityId}`,
        );
        return;
      }

      const productEntity = relatedEntities[0];

      // Use existing relationships for optimization
      const existingRelationshipMap = new Map(
        existingRelationships.map((rel) => [
          `${rel.fromEntityId}_${rel.toEntityId}_${rel.type}`,
          rel,
        ]),
      );

      // Update category relationships
      if (productEntity.properties?.category) {
        await this.updateCategoryRelationship(
          productEntity,
          existingRelationshipMap,
        );
      }

      // Update brand relationships
      if (productEntity.properties?.brand) {
        await this.updateBrandRelationship(
          productEntity,
          existingRelationshipMap,
        );
      }

      // Recalculate similarity relationships with other products
      await this.updateSimilarityRelationships(
        productEntity,
        existingRelationshipMap,
      );

      // Update feature-based relationships
      await this.updateFeatureRelationships(
        productEntity,
        existingRelationshipMap,
      );

      this.logger.log(
        `Product relationships updated successfully for: ${productId}`,
      );
    } catch (error) {
      this.logger.error('Error updating product relationships:', error);
      throw new Error(
        `Failed to update product relationships: ${error.message}`,
      );
    }
  }

  // Private helper methods

  private async createProductRelationships(
    productEntities: KnowledgeEntity[],
    categoryEntities: Map<string, KnowledgeEntity>,
    brandEntities: Map<string, KnowledgeEntity>,
  ): Promise<void> {
    for (const productEntity of productEntities) {
      // Create product -> category relationship
      if (productEntity.properties?.category) {
        const categoryEntity = categoryEntities.get(
          productEntity.properties.category,
        );
        if (categoryEntity) {
          const relationship: KnowledgeRelationship = {
            id: `${productEntity.id}_belongs_to_${categoryEntity.id}`,
            fromEntityId: productEntity.id,
            toEntityId: categoryEntity.id,
            type: 'BELONGS_TO',
            weight: 1.0,
            properties: {
              relationshipType: 'category_membership',
            },
            createdAt: new Date(),
          };

          await this.knowledgeGraphRepository.createKnowledgeRelationship(
            relationship,
          );
        }
      }

      // Create product -> brand relationship
      if (productEntity.properties?.brand) {
        const brandEntity = brandEntities.get(productEntity.properties.brand);
        if (brandEntity) {
          const relationship: KnowledgeRelationship = {
            id: `${productEntity.id}_belongs_to_${brandEntity.id}`,
            fromEntityId: productEntity.id,
            toEntityId: brandEntity.id,
            type: 'BELONGS_TO',
            weight: 1.0,
            properties: {
              relationshipType: 'brand_membership',
            },
            createdAt: new Date(),
          };

          await this.knowledgeGraphRepository.createKnowledgeRelationship(
            relationship,
          );
        }
      }
    }
  }

  private async createSimilarityRelationships(
    productEntities: KnowledgeEntity[],
  ): Promise<void> {
    for (let i = 0; i < productEntities.length; i++) {
      for (let j = i + 1; j < productEntities.length; j++) {
        const product1 = productEntities[i];
        const product2 = productEntities[j];

        // Calculate similarity score based on multiple factors
        const similarityScore = this.calculateSimilarityScore(
          product1,
          product2,
        );

        // Only create relationship if similarity is above threshold
        if (similarityScore > 0.6) {
          const relationship: KnowledgeRelationship = {
            id: `${product1.id}_similar_to_${product2.id}`,
            fromEntityId: product1.id,
            toEntityId: product2.id,
            type: 'SIMILAR_TO',
            weight: similarityScore,
            properties: {
              relationshipType: 'similarity',
              calculatedScore: similarityScore,
            },
            createdAt: new Date(),
          };

          await this.knowledgeGraphRepository.createKnowledgeRelationship(
            relationship,
          );
        }
      }
    }
  }

  private calculateSimilarityScore(
    entity1: KnowledgeEntity,
    entity2: KnowledgeEntity,
  ): number {
    let score = 0;
    let factors = 0;

    // Category similarity
    if (entity1.properties?.category && entity2.properties?.category) {
      score +=
        entity1.properties.category === entity2.properties.category ? 0.4 : 0;
      factors++;
    }

    // Brand similarity
    if (entity1.properties?.brand && entity2.properties?.brand) {
      score += entity1.properties.brand === entity2.properties.brand ? 0.3 : 0;
      factors++;
    }

    // Price similarity (within 20% range)
    if (entity1.properties?.price && entity2.properties?.price) {
      const priceDiff = Math.abs(
        entity1.properties.price - entity2.properties.price,
      );
      const avgPrice =
        (entity1.properties.price + entity2.properties.price) / 2;
      const priceScore = Math.max(0, 1 - priceDiff / avgPrice);
      score += priceScore * 0.2;
      factors++;
    }

    // Vector similarity (if both have embeddings)
    if (
      entity1.vector &&
      entity2.vector &&
      entity1.vector.length === entity2.vector.length
    ) {
      const vectorSimilarity = this.calculateCosineSimilarity(
        entity1.vector,
        entity2.vector,
      );
      score += vectorSimilarity * 0.1;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  private calculateCosineSimilarity(
    vector1: number[],
    vector2: number[],
  ): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (norm1 * norm2);
  }

  private calculateRelationshipScore(entity: KnowledgeEntity): number {
    let score = 0.5; // Base score

    // Boost score for featured products
    if (entity.properties?.isFeatured) {
      score += 0.2;
    }

    // Boost score for active products
    if (entity.properties?.isActive) {
      score += 0.1;
    }

    // Boost score for products with more tags (indicates better categorization)
    if (entity.properties?.tags && entity.properties.tags.length > 0) {
      score += Math.min(0.2, entity.properties.tags.length * 0.05);
    }

    return Math.min(1.0, score);
  }

  private mapEntityToProduct(entity: KnowledgeEntity): any {
    return {
      id:
        entity.properties?.originalProductId ||
        entity.id.replace('product_', ''),
      name: entity.name,
      description: entity.description,
      price: entity.properties?.price,
      category: entity.properties?.category,
      brand: entity.properties?.brand,
      isActive: entity.properties?.isActive,
      isFeatured: entity.properties?.isFeatured,
      tags: entity.properties?.tags || [],
      slug: entity.properties?.slug,
    };
  }

  private async findSimilarPriceProducts(
    baseProduct: KnowledgeEntity,
    excludeId: string,
  ): Promise<any[]> {
    try {
      const basePrice = baseProduct.properties?.price;
      if (!basePrice) return [];

      // Define price range (±20%)
      const priceRange = basePrice * 0.2;
      const minPrice = basePrice - priceRange;
      const maxPrice = basePrice + priceRange;

      // Get all product entities and filter by price range
      const allRelatedEntities =
        await this.knowledgeGraphRepository.findRelatedEntities('', 3);
      const productEntities = allRelatedEntities.filter(
        (entity) =>
          entity.type === 'PRODUCT' &&
          entity.id !== excludeId &&
          entity.properties?.price >= minPrice &&
          entity.properties?.price <= maxPrice,
      );

      return productEntities.map((entity) => ({
        ...this.mapEntityToProduct(entity),
        recommendationReason: 'Similar Price Range',
        recommendationScore: 0.6,
        priceMatch:
          Math.abs(entity.properties?.price - basePrice) / basePrice < 0.1
            ? 'exact'
            : 'close',
      }));
    } catch (error) {
      this.logger.error('Error finding similar price products:', error);
      return [];
    }
  }

  private async findVectorSimilarProducts(
    baseProduct: KnowledgeEntity,
    excludeId: string,
  ): Promise<any[]> {
    try {
      if (!baseProduct.vector || baseProduct.vector.length === 0) return [];

      // Get all product entities with vectors
      const allRelatedEntities =
        await this.knowledgeGraphRepository.findRelatedEntities('', 3);
      const productEntities = allRelatedEntities.filter(
        (entity) =>
          entity.type === 'PRODUCT' &&
          entity.id !== excludeId &&
          entity.vector &&
          entity.vector.length > 0,
      );

      // Calculate vector similarities
      const similarProducts = productEntities
        .map((entity) => {
          const similarity = this.calculateCosineSimilarity(
            baseProduct.vector!,
            entity.vector!,
          );
          return {
            ...this.mapEntityToProduct(entity),
            recommendationReason: 'Vector Similarity',
            recommendationScore: similarity * 0.5, // Scale down vector score
            vectorSimilarity: similarity,
          };
        })
        .filter((product) => product.vectorSimilarity > 0.7) // Only high similarity
        .sort((a, b) => b.vectorSimilarity - a.vectorSimilarity);

      return similarProducts.slice(0, 5); // Top 5 vector similar products
    } catch (error) {
      this.logger.error('Error finding vector similar products:', error);
      return [];
    }
  }

  private removeDuplicateRecommendations(recommendations: any[]): any[] {
    const seen = new Set<string>();
    return recommendations.filter((product) => {
      if (seen.has(product.id)) {
        return false;
      }
      seen.add(product.id);
      return true;
    });
  }

  private async updateCategoryRelationship(
    productEntity: KnowledgeEntity,
    existingRelationships?: Map<string, KnowledgeRelationship>,
  ): Promise<void> {
    try {
      const categoryId = `category_${productEntity.properties?.category?.toLowerCase().replace(/\s+/g, '_')}`;
      const relationshipKey = `${productEntity.id}_${categoryId}_BELONGS_TO`;

      // Check if relationship already exists
      if (existingRelationships?.has(relationshipKey)) {
        this.logger.debug(
          `Category relationship already exists for ${productEntity.id}`,
        );
        return;
      }

      // Create category entity if it doesn't exist
      try {
        const categoryVector = await this.aiService.generateEmbedding(
          productEntity.properties?.category || '',
        );
        const categoryEntity: KnowledgeEntity = {
          id: categoryId,
          type: 'CATEGORY',
          name: productEntity.properties?.category || '',
          description: `Product category: ${productEntity.properties?.category}`,
          properties: {
            productCount: 1,
          },
          vector: categoryVector,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await this.knowledgeGraphRepository.createKnowledgeEntity(
          categoryEntity,
        );
      } catch (error) {
        console.log('🚀 ~ KagService ~ error:', error);
        // Category might already exist, continue with relationship creation
        this.logger.debug(`Category entity might already exist: ${categoryId}`);
      }

      // Create the relationship
      const relationship: KnowledgeRelationship = {
        id: `${productEntity.id}_belongs_to_${categoryId}`,
        fromEntityId: productEntity.id,
        toEntityId: categoryId,
        type: 'BELONGS_TO',
        weight: 1.0,
        properties: {
          relationshipType: 'category_membership',
          updatedAt: new Date(),
        },
        createdAt: new Date(),
      };

      await this.knowledgeGraphRepository.createKnowledgeRelationship(
        relationship,
      );
      this.logger.debug(
        `Updated category relationship for ${productEntity.id}`,
      );
    } catch (error) {
      this.logger.error('Error updating category relationship:', error);
    }
  }

  private async updateBrandRelationship(
    productEntity: KnowledgeEntity,
    existingRelationships?: Map<string, KnowledgeRelationship>,
  ): Promise<void> {
    try {
      const brandId = `brand_${productEntity.properties?.brand?.toLowerCase().replace(/\s+/g, '_')}`;
      const relationshipKey = `${productEntity.id}_${brandId}_BELONGS_TO`;

      // Check if relationship already exists
      if (existingRelationships?.has(relationshipKey)) {
        this.logger.debug(
          `Brand relationship already exists for ${productEntity.id}`,
        );
        return;
      }

      // Create brand entity if it doesn't exist
      try {
        const brandVector = await this.aiService.generateEmbedding(
          productEntity.properties?.brand || '',
        );
        const brandEntity: KnowledgeEntity = {
          id: brandId,
          type: 'BRAND',
          name: productEntity.properties?.brand || '',
          description: `Brand: ${productEntity.properties?.brand}`,
          properties: {
            productCount: 1,
          },
          vector: brandVector,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await this.knowledgeGraphRepository.createKnowledgeEntity(brandEntity);
      } catch (error) {
        console.log('🚀 ~ KagService ~ error:', error);
        // Brand might already exist, continue with relationship creation
        this.logger.debug(`Brand entity might already exist: ${brandId}`);
      }

      // Create the relationship
      const relationship: KnowledgeRelationship = {
        id: `${productEntity.id}_belongs_to_${brandId}`,
        fromEntityId: productEntity.id,
        toEntityId: brandId,
        type: 'BELONGS_TO',
        weight: 1.0,
        properties: {
          relationshipType: 'brand_membership',
          updatedAt: new Date(),
        },
        createdAt: new Date(),
      };

      await this.knowledgeGraphRepository.createKnowledgeRelationship(
        relationship,
      );
      this.logger.debug(`Updated brand relationship for ${productEntity.id}`);
    } catch (error) {
      this.logger.error('Error updating brand relationship:', error);
    }
  }

  private async updateSimilarityRelationships(
    productEntity: KnowledgeEntity,
    existingRelationships?: Map<string, KnowledgeRelationship>,
  ): Promise<void> {
    try {
      // Get all other product entities to compare against
      const allRelatedEntities =
        await this.knowledgeGraphRepository.findRelatedEntities('', 2);
      const otherProducts = allRelatedEntities.filter(
        (entity) => entity.type === 'PRODUCT' && entity.id !== productEntity.id,
      );

      for (const otherProduct of otherProducts) {
        const relationshipKey1 = `${productEntity.id}_${otherProduct.id}_SIMILAR_TO`;
        const relationshipKey2 = `${otherProduct.id}_${productEntity.id}_SIMILAR_TO`;

        // Skip if relationship already exists
        if (
          existingRelationships?.has(relationshipKey1) ||
          existingRelationships?.has(relationshipKey2)
        ) {
          continue;
        }

        // Calculate similarity score
        const similarityScore = this.calculateSimilarityScore(
          productEntity,
          otherProduct,
        );

        // Only create relationship if similarity is above threshold
        if (similarityScore > 0.6) {
          const relationship: KnowledgeRelationship = {
            id: `${productEntity.id}_similar_to_${otherProduct.id}`,
            fromEntityId: productEntity.id,
            toEntityId: otherProduct.id,
            type: 'SIMILAR_TO',
            weight: similarityScore,
            properties: {
              relationshipType: 'similarity',
              calculatedScore: similarityScore,
              updatedAt: new Date(),
            },
            createdAt: new Date(),
          };

          await this.knowledgeGraphRepository.createKnowledgeRelationship(
            relationship,
          );
        }
      }

      this.logger.debug(
        `Updated similarity relationships for ${productEntity.id}`,
      );
    } catch (error) {
      this.logger.error('Error updating similarity relationships:', error);
    }
  }

  private async updateFeatureRelationships(
    productEntity: KnowledgeEntity,
    existingRelationships?: Map<string, KnowledgeRelationship>,
  ): Promise<void> {
    try {
      // Create feature-based relationships based on product tags and attributes
      const productTags = productEntity.properties?.tags || [];

      if (productTags.length === 0) {
        return; // No features to process
      }

      // Find other products with similar tags/features
      const allRelatedEntities =
        await this.knowledgeGraphRepository.findRelatedEntities('', 2);
      const otherProducts = allRelatedEntities.filter(
        (entity) => entity.type === 'PRODUCT' && entity.id !== productEntity.id,
      );

      for (const otherProduct of otherProducts) {
        const otherTags = otherProduct.properties?.tags || [];

        if (otherTags.length === 0) continue;

        // Calculate tag similarity
        const commonTags = productTags.filter((tag) => otherTags.includes(tag));
        const tagSimilarity =
          commonTags.length / Math.max(productTags.length, otherTags.length);

        // Create feature-based relationship if sufficient similarity
        if (tagSimilarity > 0.3) {
          const relationshipKey = `${productEntity.id}_${otherProduct.id}_RELATED_TO`;

          // Skip if relationship already exists
          if (existingRelationships?.has(relationshipKey)) {
            continue;
          }

          const relationship: KnowledgeRelationship = {
            id: `${productEntity.id}_related_to_${otherProduct.id}`,
            fromEntityId: productEntity.id,
            toEntityId: otherProduct.id,
            type: 'RELATED_TO',
            weight: tagSimilarity,
            properties: {
              relationshipType: 'feature_similarity',
              commonFeatures: commonTags,
              featureSimilarity: tagSimilarity,
              updatedAt: new Date(),
            },
            createdAt: new Date(),
          };

          await this.knowledgeGraphRepository.createKnowledgeRelationship(
            relationship,
          );
        }
      }

      // Create relationships with feature entities (if you want to model features as separate entities)
      for (const tag of productTags) {
        const featureId = `feature_${tag.toLowerCase().replace(/\s+/g, '_')}`;
        const relationshipKey = `${productEntity.id}_${featureId}_HAS_FEATURE`;

        // Skip if relationship already exists
        if (existingRelationships?.has(relationshipKey)) {
          continue;
        }

        // Create feature entity if needed
        try {
          const featureVector = await this.aiService.generateEmbedding(tag);
          const featureEntity: KnowledgeEntity = {
            id: featureId,
            type: 'FEATURE',
            name: tag,
            description: `Product feature: ${tag}`,
            properties: {
              featureType: 'tag',
            },
            vector: featureVector,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await this.knowledgeGraphRepository.createKnowledgeEntity(
            featureEntity,
          );
        } catch (error) {
          console.log('🚀 ~ KagService ~ error:', error);
          // Feature might already exist
          this.logger.debug(`Feature entity might already exist: ${featureId}`);
        }

        // Create has_feature relationship
        const featureRelationship: KnowledgeRelationship = {
          id: `${productEntity.id}_has_${featureId}`,
          fromEntityId: productEntity.id,
          toEntityId: featureId,
          type: 'HAS_FEATURE',
          weight: 1.0,
          properties: {
            relationshipType: 'feature_ownership',
            featureName: tag,
          },
          createdAt: new Date(),
        };

        await this.knowledgeGraphRepository.createKnowledgeRelationship(
          featureRelationship,
        );
      }

      this.logger.debug(
        `Updated feature relationships for ${productEntity.id}`,
      );
    } catch (error) {
      this.logger.error('Error updating feature relationships:', error);
    }
  }
}
