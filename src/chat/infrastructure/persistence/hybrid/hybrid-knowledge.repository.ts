import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeEntity } from '../../../domain/knowledge';
import { KnowledgeRepository } from '../knowledge.repository';
import { KnowledgeDocumentRepository } from '../document/repositories/knowledge.repository';
import { KnowledgeVectorRepository } from '../weaviate/repositories/knowledge-vector.repository';
import { KnowledgeGraphRepository } from '../graph/repositories/knowledge-graph.repository';
import { NullableType } from '../../../../utils/types/nullable.type';

@Injectable()
export class HybridKnowledgeRepository implements KnowledgeRepository {
  private readonly logger = new Logger(HybridKnowledgeRepository.name);

  constructor(
    private readonly mongoRepository: KnowledgeDocumentRepository,
    private readonly vectorRepository: KnowledgeVectorRepository,
    private readonly graphRepository: KnowledgeGraphRepository,
  ) {}
  async searchProducts(
    searchTerm: string,
    filters?: Record<string, any>,
  ): Promise<KnowledgeEntity[]> {
    try {
      this.logger.debug(`Hybrid product search for: "${searchTerm}"`);

      const results: KnowledgeEntity[] = [];

      // 1. Use MongoDB for traditional product search
      const mongoResults = await this.mongoRepository.searchProducts(
        searchTerm,
        filters,
      );
      results.push(...mongoResults);

      // 2. Use semantic search for better matching (RAG)
      try {
        const semanticResults =
          await this.vectorRepository.semanticKnowledgeSearch(
            `product ${searchTerm}`, // Enhance query for product context
            10,
          );

        // Filter semantic results to only products
        const productSemanticResults = semanticResults.filter(
          (entity) => entity.type === 'PRODUCT',
        );

        results.push(...productSemanticResults);
      } catch (semanticError) {
        this.logger.warn(
          'Semantic product search failed, using MongoDB only:',
          semanticError,
        );
      }

      // 3. Apply additional filters if provided
      let filteredResults = results;
      if (filters) {
        filteredResults = this.applyProductFilters(results, filters);
      }

      // 4. Remove duplicates
      const uniqueResults = this.removeDuplicates(filteredResults);

      // 5. Sort by relevance (prioritize exact matches, then semantic matches)
      const sortedResults = this.sortProductSearchResults(
        uniqueResults,
        searchTerm,
      );

      this.logger.debug(
        `Hybrid product search returned ${sortedResults.length} results`,
      );
      return sortedResults.slice(0, 20); // Limit to top 20 results
    } catch (error) {
      this.logger.error('Hybrid product search failed:', error);
      // Fallback to MongoDB only
      return this.mongoRepository.searchProducts(searchTerm, filters);
    }
  }
  private sortProductSearchResults(
    results: KnowledgeEntity[],
    searchTerm: string,
  ): KnowledgeEntity[] {
    const searchTermLower = searchTerm.toLowerCase();

    return results.sort((a, b) => {
      // 1. Prioritize exact name matches
      const aExactMatch = a.name.toLowerCase() === searchTermLower;
      const bExactMatch = b.name.toLowerCase() === searchTermLower;
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // 2. Prioritize name starts with search term
      const aStartsWith = a.name.toLowerCase().startsWith(searchTermLower);
      const bStartsWith = b.name.toLowerCase().startsWith(searchTermLower);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // 3. Prioritize products with vectors (semantic search results)
      if (a.vector && !b.vector) return -1;
      if (!a.vector && b.vector) return 1;

      // 4. Sort by rating if available
      const aRating = a.properties?.rating || 0;
      const bRating = b.properties?.rating || 0;
      if (aRating !== bRating) return bRating - aRating;

      // 5. Sort by name alphabetically
      return a.name.localeCompare(b.name);
    });
  }

  private removeDuplicates(results: KnowledgeEntity[]): KnowledgeEntity[] {
    const seen = new Set<string>();
    return results.filter((entity) => {
      if (seen.has(entity.id)) {
        return false;
      }
      seen.add(entity.id);
      return true;
    });
  }

  // ===== PRODUCT SEARCH HELPER METHODS =====
  private applyProductFilters(
    results: KnowledgeEntity[],
    filters: Record<string, any>,
  ): KnowledgeEntity[] {
    let filtered = results;

    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(
        (entity) => entity.properties?.category === filters.category,
      );
    }

    // Apply brand filter
    if (filters.brand) {
      filtered = filtered.filter(
        (entity) => entity.properties?.brand === filters.brand,
      );
    }

    // Apply price range filter
    if (filters.minPrice !== undefined) {
      filtered = filtered.filter(
        (entity) =>
          entity.properties?.price !== undefined &&
          entity.properties.price >= filters.minPrice,
      );
    }

    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter(
        (entity) =>
          entity.properties?.price !== undefined &&
          entity.properties.price <= filters.maxPrice,
      );
    }

    // Apply type filter (should be PRODUCT for product searches)
    if (filters.type) {
      filtered = filtered.filter((entity) => entity.type === filters.type);
    }

    return filtered;
  }

  async findTopProducts(
    category?: string,
    limit = 10,
  ): Promise<KnowledgeEntity[]> {
    try {
      this.logger.debug(
        `Finding top products${category ? ` in category: ${category}` : ''}`,
      );

      // 1. Get top products from MongoDB (primary source)
      const mongoTopProducts = await this.mongoRepository.findTopProducts(
        category,
        limit * 2,
      );

      // 2. Enhance with graph relationships (KAG) - find highly connected products
      const enhancedProducts: KnowledgeEntity[] = [];

      for (const product of mongoTopProducts) {
        try {
          // Get relationship count as a popularity indicator
          const relatedEntities =
            await this.graphRepository.findRelatedEntities(product.id, 1);

          // Add relationship score to the product
          const enhancedProduct = {
            ...product,
            properties: {
              ...product.properties,
              relationshipScore: relatedEntities.length, // More relationships = more popular
            },
          };

          enhancedProducts.push(enhancedProduct);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (graphError) {
          // If graph lookup fails, use original product
          enhancedProducts.push(product);
        }
      }

      // 3. Sort by combined score (rating + relationship score)
      const sortedProducts = enhancedProducts.sort((a, b) => {
        const scoreA = this.calculateProductScore(a);
        const scoreB = this.calculateProductScore(b);
        return scoreB - scoreA;
      });

      const topProducts = sortedProducts.slice(0, limit);

      this.logger.debug(`Found ${topProducts.length} top products`);
      return topProducts;
    } catch (error) {
      this.logger.error('Finding top products failed:', error);
      // Fallback to MongoDB only
      return this.mongoRepository.findTopProducts(category, limit);
    }
  }
  private calculateProductScore(product: KnowledgeEntity): number {
    let score = 0;

    // Base score from rating
    const rating = product.properties?.rating || 0;
    score += rating * 2; // Rating contributes 0-10 points

    // Score from sales count
    const salesCount = product.properties?.salesCount || 0;
    score += Math.min(salesCount / 100, 5); // Sales contribute 0-5 points

    // Score from relationships (popularity in graph)
    const relationshipScore = product.properties?.relationshipScore || 0;
    score += Math.min(relationshipScore * 0.1, 3); // Relationships contribute 0-3 points

    // Bonus for featured products
    if (product.properties?.isFeatured) {
      score += 2;
    }

    // Bonus for active products
    if (product.properties?.isActive !== false) {
      score += 1;
    }

    return score;
  }

  findByProperties(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    properties: Record<string, any>,
  ): Promise<KnowledgeEntity[]> {
    throw new Error('Method not implemented.');
  }

  // ===== BASIC CRUD OPERATIONS =====
  async create(data: Omit<KnowledgeEntity, 'id'>): Promise<KnowledgeEntity> {
    try {
      // 1. Create in MongoDB (primary storage)
      const entity = await this.mongoRepository.create(data);

      // 2. Store vector for RAG (semantic search)
      this.storeVector(entity).catch((error) =>
        this.logger.warn(`Vector storage failed for ${entity.id}:`, error),
      );

      // 3. Create graph relationships for KAG
      this.createGraphNode(entity).catch((error) =>
        this.logger.warn(`Graph creation failed for ${entity.id}:`, error),
      );

      return entity;
    } catch (error) {
      this.logger.error('Failed to create knowledge entity:', error);
      throw error;
    }
  }

  async findById(
    id: KnowledgeEntity['id'],
  ): Promise<NullableType<KnowledgeEntity>> {
    return this.mongoRepository.findById(id);
  }

  async update(
    id: KnowledgeEntity['id'],
    payload: Partial<KnowledgeEntity>,
  ): Promise<KnowledgeEntity | null> {
    try {
      const entity = await this.mongoRepository.update(id, payload);

      if (entity) {
        // Update vector and graph asynchronously
        this.storeVector(entity).catch((error) =>
          this.logger.warn(`Vector update failed for ${id}:`, error),
        );
        this.updateGraphNode(entity).catch((error) =>
          this.logger.warn(`Graph update failed for ${id}:`, error),
        );
      }

      return entity;
    } catch (error) {
      this.logger.error(`Failed to update knowledge entity ${id}:`, error);
      throw error;
    }
  }

  async remove(id: KnowledgeEntity['id']): Promise<void> {
    try {
      await this.mongoRepository.remove(id);

      // Cleanup vector and graph asynchronously
      this.vectorRepository
        .deleteKnowledgeVector(id)
        .catch((error) =>
          this.logger.warn(`Vector cleanup failed for ${id}:`, error),
        );
      this.graphRepository
        .deleteEntity(id)
        .catch((error) =>
          this.logger.warn(`Graph cleanup failed for ${id}:`, error),
        );
    } catch (error) {
      this.logger.error(`Failed to remove knowledge entity ${id}:`, error);
      throw error;
    }
  }

  // ===== SHOPPING-FOCUSED QUERIES =====
  async findByType(type: KnowledgeEntity['type']): Promise<KnowledgeEntity[]> {
    return this.mongoRepository.findByType(type);
  }

  async findByName(name: string): Promise<KnowledgeEntity[]> {
    return this.mongoRepository.findByName(name);
  }

  async findByCategory(category: string): Promise<KnowledgeEntity[]> {
    return this.mongoRepository.findByProperties({ category });
  }

  async findByBrand(brand: string): Promise<KnowledgeEntity[]> {
    return this.mongoRepository.findByProperties({ brand });
  }

  // ===== RAG OPERATIONS (SEMANTIC SEARCH) =====
  async findSimilar(vector: number[], limit = 10): Promise<KnowledgeEntity[]> {
    try {
      return await this.vectorRepository.findSimilarKnowledge(vector, limit);
    } catch (error) {
      this.logger.error('Semantic similarity search failed:', error);
      return [];
    }
  }

  async semanticSearch(query: string, limit = 10): Promise<KnowledgeEntity[]> {
    try {
      return await this.vectorRepository.semanticKnowledgeSearch(query, limit);
    } catch (error) {
      this.logger.error('Semantic search failed:', error);
      return [];
    }
  }

  // ===== KAG OPERATIONS (GRAPH RELATIONSHIPS) =====
  async findRelated(entityId: string, hops = 2): Promise<KnowledgeEntity[]> {
    try {
      const relatedEntities = await this.graphRepository.findRelatedEntities(
        entityId,
        hops,
      );

      // Enrich with full entity data from MongoDB
      const enrichedEntities: KnowledgeEntity[] = [];
      for (const entity of relatedEntities) {
        const fullEntity = await this.mongoRepository.findById(entity.id);
        if (fullEntity) {
          enrichedEntities.push(fullEntity);
        }
      }

      return enrichedEntities;
    } catch (error) {
      this.logger.error('Graph relationship search failed:', error);
      return [];
    }
  }

  async findRecommendations(
    entityId: string,
    limit = 5,
  ): Promise<KnowledgeEntity[]> {
    try {
      const entity = await this.findById(entityId);
      if (!entity) return [];

      const recommendations: KnowledgeEntity[] = [];

      // 1. Get graph-based recommendations (KAG)
      const relatedEntities = await this.findRelated(entityId, 1);
      recommendations.push(...relatedEntities.slice(0, Math.floor(limit / 2)));

      // 2. Get vector-based recommendations (RAG)
      if (entity.vector && entity.vector.length > 0) {
        const similarEntities = await this.findSimilar(
          entity.vector,
          Math.ceil(limit / 2),
        );
        recommendations.push(
          ...similarEntities.filter((e) => e.id !== entityId),
        );
      }

      // Remove duplicates and limit results
      const uniqueRecommendations = recommendations.filter(
        (item, index, self) =>
          index === self.findIndex((e) => e.id === item.id),
      );

      return uniqueRecommendations.slice(0, limit);
    } catch (error) {
      this.logger.error('Recommendation generation failed:', error);
      return [];
    }
  }

  // ===== HYBRID SEARCH (RAG + KAG) =====
  async hybridSearch(
    query: string,
    filters: Record<string, any> = {},
  ): Promise<KnowledgeEntity[]> {
    try {
      const results: KnowledgeEntity[] = [];

      // 1. RAG: Semantic search using vectors
      const semanticResults = await this.semanticSearch(query, 15);
      results.push(...semanticResults);

      // 2. Traditional text search in MongoDB
      if (filters.type) {
        const typeResults = await this.findByType(filters.type);
        const filteredResults = typeResults.filter(
          (entity) =>
            entity.name.toLowerCase().includes(query.toLowerCase()) ||
            entity.description.toLowerCase().includes(query.toLowerCase()),
        );
        results.push(...filteredResults);
      }

      // 3. Apply additional filters
      let filteredResults = results;
      if (filters.category) {
        filteredResults = results.filter(
          (entity) => entity.properties?.category === filters.category,
        );
      }
      if (filters.brand) {
        filteredResults = results.filter(
          (entity) => entity.properties?.brand === filters.brand,
        );
      }

      // Remove duplicates
      const uniqueResults = filteredResults.filter(
        (entity, index, self) =>
          index === self.findIndex((e) => e.id === entity.id),
      );

      // Sort by relevance (entities with vectors first)
      uniqueResults.sort((a, b) => {
        if (a.vector && !b.vector) return -1;
        if (!a.vector && b.vector) return 1;
        return a.name.localeCompare(b.name);
      });

      this.logger.log(
        `Hybrid search returned ${uniqueResults.length} results for: ${query}`,
      );
      return uniqueResults.slice(0, 20); // Limit to top 20 results
    } catch (error) {
      this.logger.error('Hybrid search failed:', error);
      return [];
    }
  }

  // ===== PRIVATE HELPER METHODS =====
  private async storeVector(entity: KnowledgeEntity): Promise<void> {
    try {
      await this.vectorRepository.storeKnowledgeVector(entity);
      this.logger.debug(`Vector stored for entity: ${entity.id}`);
    } catch (error) {
      this.logger.error(`Vector storage failed for ${entity.id}:`, error);
    }
  }

  private async createGraphNode(entity: KnowledgeEntity): Promise<void> {
    try {
      await this.graphRepository.createKnowledgeEntity(entity);
      this.logger.debug(`Graph node created for entity: ${entity.id}`);
    } catch (error) {
      this.logger.error(`Graph node creation failed for ${entity.id}:`, error);
    }
  }

  private async updateGraphNode(entity: KnowledgeEntity): Promise<void> {
    try {
      if (entity.properties) {
        await this.graphRepository.updateEntityProperties(
          entity.id,
          entity.properties,
        );
        this.logger.debug(`Graph node updated for entity: ${entity.id}`);
      }
    } catch (error) {
      this.logger.error(`Graph node update failed for ${entity.id}:`, error);
    }
  }
}
