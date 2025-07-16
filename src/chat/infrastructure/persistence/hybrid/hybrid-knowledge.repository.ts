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
    private mongoRepository: KnowledgeDocumentRepository,
    private vectorRepository: KnowledgeVectorRepository,
    private graphRepository: KnowledgeGraphRepository,
  ) {}

  async create(data: Omit<KnowledgeEntity, 'id'>): Promise<KnowledgeEntity> {
    try {
      // 1. Create in MongoDB first (primary storage)
      const createdEntity = await this.mongoRepository.create(data);
      this.logger.log(
        `Knowledge entity created in MongoDB: ${createdEntity.id}`,
      );

      // 2. Store in Weaviate for vector search
      try {
        await this.vectorRepository.storeKnowledgeVector(createdEntity);
        this.logger.log(
          `Knowledge vector stored in Weaviate: ${createdEntity.id}`,
        );
      } catch (vectorError) {
        this.logger.error(
          `Failed to store knowledge vector: ${createdEntity.id}`,
          vectorError,
        );
        // Don't fail the entire operation
      }

      // 3. Create in Neo4j for graph relationships
      try {
        await this.graphRepository.createKnowledgeEntity(createdEntity);
        this.logger.log(
          `Knowledge entity created in Neo4j: ${createdEntity.id}`,
        );
      } catch (graphError) {
        this.logger.error(
          `Failed to create knowledge entity in Neo4j: ${createdEntity.id}`,
          graphError,
        );
        // Don't fail the entire operation
      }

      return createdEntity;
    } catch (error) {
      this.logger.error('Failed to create knowledge entity:', error);
      throw error;
    }
  }

  async findById(
    id: KnowledgeEntity['id'],
  ): Promise<NullableType<KnowledgeEntity>> {
    // Use MongoDB as primary source for individual lookups
    return await this.mongoRepository.findById(id);
  }

  async findByType(type: string): Promise<KnowledgeEntity[]> {
    // Use MongoDB for type-based queries
    return await this.mongoRepository.findByType(type);
  }

  async findByName(name: string): Promise<KnowledgeEntity[]> {
    // Use MongoDB for name-based queries
    return await this.mongoRepository.findByName(name);
  }

  async update(
    id: KnowledgeEntity['id'],
    payload: Partial<KnowledgeEntity>,
  ): Promise<KnowledgeEntity | null> {
    try {
      // 1. Update in MongoDB
      const updatedEntity = await this.mongoRepository.update(id, payload);

      if (updatedEntity) {
        this.logger.log(`Knowledge entity updated in MongoDB: ${id}`);

        // 2. Update in Weaviate
        try {
          await this.vectorRepository.storeKnowledgeVector(updatedEntity);
          this.logger.log(`Knowledge vector updated in Weaviate: ${id}`);
        } catch (vectorError) {
          this.logger.error(
            `Failed to update knowledge vector: ${id}`,
            vectorError,
          );
        }

        // 3. Update in Neo4j
        try {
          if (payload.properties) {
            await this.graphRepository.updateEntityProperties(
              id,
              payload.properties,
            );
          }
          this.logger.log(`Knowledge entity updated in Neo4j: ${id}`);
        } catch (graphError) {
          this.logger.error(
            `Failed to update knowledge entity in Neo4j: ${id}`,
            graphError,
          );
        }
      }

      return updatedEntity;
    } catch (error) {
      this.logger.error(`Failed to update knowledge entity: ${id}`, error);
      throw error;
    }
  }

  async remove(id: KnowledgeEntity['id']): Promise<void> {
    try {
      // Get entity details before deletion
      const entity = await this.findById(id);

      if (!entity) {
        this.logger.warn(`Knowledge entity not found for deletion: ${id}`);
        return;
      }

      // 1. Remove from MongoDB
      await this.mongoRepository.remove(id);
      this.logger.log(`Knowledge entity removed from MongoDB: ${id}`);

      // 2. Remove from Weaviate
      try {
        await this.vectorRepository.deleteKnowledgeVector(id);
        this.logger.log(`Knowledge vector removed from Weaviate: ${id}`);
      } catch (vectorError) {
        this.logger.error(
          `Failed to remove knowledge vector: ${id}`,
          vectorError,
        );
      }

      // 3. Remove from Neo4j
      try {
        await this.graphRepository.deleteEntity(id);
        this.logger.log(`Knowledge entity removed from Neo4j: ${id}`);
      } catch (graphError) {
        this.logger.error(
          `Failed to remove knowledge entity from Neo4j: ${id}`,
          graphError,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to remove knowledge entity: ${id}`, error);
      throw error;
    }
  }

  async findSimilar(
    vector: number[],
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    try {
      // Use Weaviate for vector similarity search
      return await this.vectorRepository.findSimilarKnowledge(vector, limit);
    } catch (error) {
      this.logger.error('Failed to find similar knowledge entities:', error);
      return [];
    }
  }

  async findByProperties(
    properties: Record<string, any>,
  ): Promise<KnowledgeEntity[]> {
    try {
      // Use MongoDB for property-based queries
      return await this.mongoRepository.findByProperties(properties);
    } catch (error) {
      this.logger.error(
        'Failed to find knowledge entities by properties:',
        error,
      );
      return [];
    }
  }

  // Hybrid-specific methods
  async semanticKnowledgeSearch(
    query: string,
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    try {
      // Use Weaviate for semantic search
      return await this.vectorRepository.semanticKnowledgeSearch(query, limit);
    } catch (error) {
      this.logger.error('Failed to perform semantic knowledge search:', error);
      return [];
    }
  }

  async findRelatedKnowledge(
    entityId: string,
    hops: number = 2,
  ): Promise<KnowledgeEntity[]> {
    try {
      // Use Neo4j for graph traversal
      const relatedEntities = await this.graphRepository.findRelatedEntities(
        entityId,
        hops,
      );

      // Optionally enrich with MongoDB data for complete entity information
      const enrichedEntities: KnowledgeEntity[] = [];
      for (const entity of relatedEntities) {
        const fullEntity = await this.mongoRepository.findById(entity.id);
        if (fullEntity) {
          enrichedEntities.push(fullEntity);
        }
      }

      return enrichedEntities;
    } catch (error) {
      this.logger.error('Failed to find related knowledge:', error);
      return [];
    }
  }

  async getKnowledgeGraph(entityId: string): Promise<any> {
    try {
      const result: any = {};

      // 1. Get the main entity from MongoDB
      const entity = await this.mongoRepository.findById(entityId);
      if (!entity) {
        return null;
      }
      result.entity = entity;

      // 2. Get relationships from Neo4j
      try {
        const relationships =
          await this.graphRepository.findEntityRelationships(entityId);
        result.relationships = relationships;
      } catch (graphError) {
        this.logger.error(
          `Failed to get relationships for entity: ${entityId}`,
          graphError,
        );
        result.relationships = [];
      }

      // 3. Get related entities from graph
      try {
        const relatedEntities = await this.graphRepository.findRelatedEntities(
          entityId,
          2,
        );
        result.relatedEntities = relatedEntities;
      } catch (graphError) {
        this.logger.error(
          `Failed to get related entities for: ${entityId}`,
          graphError,
        );
        result.relatedEntities = [];
      }

      // 4. Get similar entities from vector search
      try {
        if (entity.vector && entity.vector.length > 0) {
          const similarEntities =
            await this.vectorRepository.findSimilarKnowledge(entity.vector, 5);
          result.similarEntities = similarEntities.filter(
            (e) => e.id !== entityId,
          );
        } else {
          result.similarEntities = [];
        }
      } catch (vectorError) {
        this.logger.error(
          `Failed to get similar entities for: ${entityId}`,
          vectorError,
        );
        result.similarEntities = [];
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get knowledge graph for: ${entityId}`,
        error,
      );
      return null;
    }
  }

  async hybridKnowledgeSearch(
    query: string,
    filters: Record<string, any> = {},
  ): Promise<KnowledgeEntity[]> {
    try {
      const results: KnowledgeEntity[] = [];

      // 1. Semantic search from Weaviate
      const semanticResults = await this.vectorRepository.hybridKnowledgeSearch(
        query,
        filters,
      );
      results.push(...semanticResults);

      // 2. If we have type filter, also search by type in MongoDB
      if (filters.type) {
        const typeResults = await this.mongoRepository.findByType(filters.type);
        const filteredTypeResults = typeResults.filter(
          (entity) =>
            entity.name.toLowerCase().includes(query.toLowerCase()) ||
            entity.description.toLowerCase().includes(query.toLowerCase()),
        );
        results.push(...filteredTypeResults);
      }

      // 3. Remove duplicates based on ID
      const uniqueResults = results.filter(
        (entity, index, self) =>
          index === self.findIndex((e) => e.id === entity.id),
      );

      // 4. Sort by relevance (entities with vectors first, then by name)
      uniqueResults.sort((a, b) => {
        if (a.vector && !b.vector) return -1;
        if (!a.vector && b.vector) return 1;
        return a.name.localeCompare(b.name);
      });

      this.logger.log(
        `Hybrid search returned ${uniqueResults.length} results for query: ${query}`,
      );
      return uniqueResults;
    } catch (error) {
      this.logger.error('Failed to perform hybrid knowledge search:', error);
      return [];
    }
  }

  async findKnowledgePath(
    fromEntityId: string,
    toEntityId: string,
  ): Promise<any[]> {
    try {
      // Use Neo4j for path finding
      return await this.graphRepository.findShortestPath(
        fromEntityId,
        toEntityId,
      );
    } catch (error) {
      this.logger.error('Failed to find knowledge path:', error);
      return [];
    }
  }

  async getEntityRecommendations(
    entityId: string,
    limit: number = 5,
  ): Promise<KnowledgeEntity[]> {
    try {
      const recommendations: KnowledgeEntity[] = [];

      // 1. Get similar entities from vector search
      const entity = await this.mongoRepository.findById(entityId);
      if (entity && entity.vector && entity.vector.length > 0) {
        const similarEntities =
          await this.vectorRepository.findSimilarKnowledge(
            entity.vector,
            limit,
          );
        recommendations.push(
          ...similarEntities.filter((e) => e.id !== entityId),
        );
      }

      // 2. Get related entities from graph
      const relatedEntities = await this.graphRepository.findRelatedEntities(
        entityId,
        2,
      );
      recommendations.push(...relatedEntities.filter((e) => e.id !== entityId));

      // 3. Get entities of the same type
      if (entity) {
        const sameTypeEntities = await this.mongoRepository.findByType(
          entity.type,
        );
        recommendations.push(
          ...sameTypeEntities.filter((e) => e.id !== entityId),
        );
      }

      // 4. Remove duplicates and limit results
      const uniqueRecommendations = recommendations.filter(
        (entity, index, self) =>
          index === self.findIndex((e) => e.id === entity.id),
      );

      // 5. Sort by relevance and limit
      uniqueRecommendations.sort((a, b) => {
        // Prioritize entities with vectors (more semantic information)
        if (a.vector && !b.vector) return -1;
        if (!a.vector && b.vector) return 1;
        return a.name.localeCompare(b.name);
      });

      const limitedRecommendations = uniqueRecommendations.slice(0, limit);
      this.logger.log(
        `Generated ${limitedRecommendations.length} recommendations for entity: ${entityId}`,
      );

      return limitedRecommendations;
    } catch (error) {
      this.logger.error('Failed to get entity recommendations:', error);
      return [];
    }
  }

  // Additional utility methods for comprehensive knowledge management
  async bulkCreate(
    entities: Omit<KnowledgeEntity, 'id'>[],
  ): Promise<KnowledgeEntity[]> {
    try {
      const createdEntities: KnowledgeEntity[] = [];

      // Create in MongoDB first
      for (const entityData of entities) {
        const createdEntity = await this.mongoRepository.create(entityData);
        createdEntities.push(createdEntity);
      }

      // Batch operations for better performance
      try {
        await this.graphRepository.createEntitiesBatch(createdEntities);
        this.logger.log(
          `Batch created ${createdEntities.length} entities in Neo4j`,
        );
      } catch (graphError) {
        this.logger.error(
          'Failed to batch create entities in Neo4j:',
          graphError,
        );
      }

      // Store vectors in Weaviate
      for (const entity of createdEntities) {
        try {
          await this.vectorRepository.storeKnowledgeVector(entity);
        } catch (vectorError) {
          this.logger.error(
            `Failed to store vector for entity: ${entity.id}`,
            vectorError,
          );
        }
      }

      return createdEntities;
    } catch (error) {
      this.logger.error('Failed to bulk create knowledge entities:', error);
      throw error;
    }
  }

  async findInfluentialEntities(
    entityType: string,
    limit: number = 10,
  ): Promise<any[]> {
    try {
      // Use Neo4j for influence analysis
      return await this.graphRepository.findInfluentialEntities(
        entityType,
        limit,
      );
    } catch (error) {
      this.logger.error('Failed to find influential entities:', error);
      return [];
    }
  }

  async getKnowledgeStats(): Promise<any> {
    try {
      const stats: any = {};

      // Get basic stats from MongoDB
      try {
        const mongoStats = await this.mongoRepository.getKnowledgeStats?.();
        stats.mongodb = mongoStats;
      } catch (mongoError) {
        this.logger.error('Failed to get MongoDB stats:', mongoError);
      }

      // Get graph stats from Neo4j
      try {
        const graphStats = await this.graphRepository.getKnowledgeGraphStats();
        stats.neo4j = graphStats;
      } catch (graphError) {
        this.logger.error('Failed to get Neo4j stats:', graphError);
      }

      // Get vector stats from Weaviate
      try {
        const vectorStats = await this.vectorRepository.getVectorStats?.();
        stats.weaviate = vectorStats;
      } catch (vectorError) {
        this.logger.error('Failed to get Weaviate stats:', vectorError);
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get knowledge stats:', error);
      return {};
    }
  }

  async findConceptualConnections(
    concept1: string,
    concept2: string,
    maxHops: number = 5,
  ): Promise<any[]> {
    try {
      // Use Neo4j for conceptual path finding
      return await this.graphRepository.findConceptualPaths(
        concept1,
        concept2,
        maxHops,
      );
    } catch (error) {
      this.logger.error('Failed to find conceptual connections:', error);
      return [];
    }
  }

  async getEntityClusters(entityType: string): Promise<any[]> {
    try {
      // Use Neo4j for clustering analysis
      return await this.graphRepository.findEntityClusters(entityType);
    } catch (error) {
      this.logger.error('Failed to get entity clusters:', error);
      return [];
    }
  }

  async findEntitySimilarity(
    entityId: string,
    limit: number = 5,
  ): Promise<any[]> {
    try {
      // Use Neo4j for similarity analysis based on graph structure
      return await this.graphRepository.findEntitySimilarity(entityId, limit);
    } catch (error) {
      this.logger.error('Failed to find entity similarity:', error);
      return [];
    }
  }

  async searchKnowledgeByContent(
    content: string,
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    try {
      const results: KnowledgeEntity[] = [];

      // 1. Semantic search from Weaviate
      const semanticResults =
        await this.vectorRepository.semanticKnowledgeSearch(
          content,
          Math.floor(limit / 2),
        );
      results.push(...semanticResults);

      // 2. Text search from MongoDB
      const textResults = await this.mongoRepository.searchByContent?.(
        content,
        Math.floor(limit / 2),
      );
      if (textResults) {
        results.push(...textResults);
      }

      // Remove duplicates
      const uniqueResults = results.filter(
        (entity, index, self) =>
          index === self.findIndex((e) => e.id === entity.id),
      );

      return uniqueResults.slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to search knowledge by content:', error);
      return [];
    }
  }
}
