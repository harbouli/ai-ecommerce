// src/chat/infrastructure/persistence/hybrid/hybrid-knowledge.repository.ts
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
