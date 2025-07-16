/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WeaviateService } from '../../../../../database/weaviate/weaviate.service';
import { WeaviateClient } from 'weaviate-ts-client';
import { KnowledgeEntity } from '../../../../domain/knowledge';
import { KnowledgeWeaviateMapper } from '../mappers/knowledge.mapper';

@Injectable()
export class KnowledgeVectorRepository implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeVectorRepository.name);
  private readonly className = 'Knowledge';
  private client: WeaviateClient;

  constructor(private readonly weaviateService: WeaviateService) {}

  async onModuleInit() {
    this.client = await this.weaviateService.getClient();
    await this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    try {
      const schema = await this.client.schema.getter().do();
      const existingClasses = schema.classes?.map((cls) => cls.class) || [];

      if (!existingClasses.includes(this.className)) {
        await this.createKnowledgeSchema();
        this.logger.log(`${this.className} schema created in Weaviate`);
      }
    } catch (error) {
      this.logger.error('Error initializing Knowledge schema:', error);
    }
  }

  private async createKnowledgeSchema(): Promise<void> {
    const classDefinition = {
      class: this.className,
      description:
        'Knowledge entities for semantic search and graph relationships',
      vectorizer: 'text2vec-transformers',
      properties: [
        {
          name: 'type',
          dataType: ['string'],
          description: 'Knowledge entity type',
          tokenization: 'keyword',
        },
        {
          name: 'name',
          dataType: ['string'],
          description: 'Knowledge entity name',
          tokenization: 'word',
        },
        {
          name: 'description',
          dataType: ['text'],
          description: 'Knowledge entity description',
          tokenization: 'word',
        },
        {
          name: 'propertyKeys',
          dataType: ['string[]'],
          description: 'Property keys',
          tokenization: 'keyword',
        },
        {
          name: 'propertyValues',
          dataType: ['string[]'],
          description: 'Property values',
          tokenization: 'word',
        },
        {
          name: 'relatedEntityIds',
          dataType: ['string[]'],
          description: 'Related entity IDs',
          tokenization: 'keyword',
        },
        {
          name: 'relationshipTypes',
          dataType: ['string[]'],
          description: 'Relationship types',
          tokenization: 'keyword',
        },
        {
          name: 'relationshipWeights',
          dataType: ['number[]'],
          description: 'Relationship weights',
        },
        {
          name: 'confidence',
          dataType: ['number'],
          description: 'Entity confidence score',
        },
        {
          name: 'relevanceScore',
          dataType: ['number'],
          description: 'Relevance score',
        },
        {
          name: 'source',
          dataType: ['string'],
          description: 'Knowledge source',
          tokenization: 'keyword',
        },
        {
          name: 'tags',
          dataType: ['string[]'],
          description: 'Entity tags',
          tokenization: 'keyword',
        },
        {
          name: 'createdAt',
          dataType: ['date'],
          description: 'Creation timestamp',
        },
        {
          name: 'updatedAt',
          dataType: ['date'],
          description: 'Last update timestamp',
        },
      ],
    };

    await this.client.schema.classCreator().withClass(classDefinition).do();
  }

  private async ensureClientReady(): Promise<void> {
    if (!this.client) {
      this.client = await this.weaviateService.getClient();
    }
  }

  async storeKnowledgeVector(knowledge: KnowledgeEntity): Promise<void> {
    await this.ensureClientReady();

    try {
      const persistenceModel = KnowledgeWeaviateMapper.toPersistence(knowledge);
      const { vector, vectorizedText, id, ...weaviateProperties } =
        persistenceModel;

      const result = await this.client.data
        .creator()
        .withClassName(this.className)
        .withId(knowledge.id)
        .withProperties(weaviateProperties)
        .do();

      this.logger.log(
        `Knowledge vector stored in Weaviate with ID: ${result.id}`,
      );
    } catch (error) {
      this.logger.error('Error storing knowledge vector:', error);
      throw error;
    }
  }

  async findSimilarKnowledge(
    vector: number[],
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id certainty } type name description propertyKeys propertyValues relatedEntityIds relationshipTypes relationshipWeights confidence relevanceScore source tags createdAt updatedAt',
        )
        .withNearVector({
          vector,
        })
        .withLimit(limit)
        .do();

      const knowledgeEntities = result.data?.Get?.[this.className] || [];

      return knowledgeEntities.map((entity: any) =>
        KnowledgeWeaviateMapper.toDomain({
          ...entity,
          id: entity._additional.id,
        }),
      );
    } catch (error) {
      this.logger.error('Error finding similar knowledge:', error);
      return [];
    }
  }

  async semanticKnowledgeSearch(
    query: string,
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id certainty } type name description propertyKeys propertyValues relatedEntityIds relationshipTypes relationshipWeights confidence relevanceScore source tags createdAt updatedAt',
        )
        .withNearText({
          concepts: [query],
        })
        .withLimit(limit)
        .do();

      const knowledgeEntities = result.data?.Get?.[this.className] || [];

      return knowledgeEntities.map((entity: any) =>
        KnowledgeWeaviateMapper.toDomain({
          ...entity,
          id: entity._additional.id,
        }),
      );
    } catch (error) {
      this.logger.error('Error in semantic knowledge search:', error);
      return [];
    }
  }

  async findKnowledgeByType(
    type: string,
    query: string,
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id certainty } type name description propertyKeys propertyValues relatedEntityIds relationshipTypes relationshipWeights confidence relevanceScore source tags createdAt updatedAt',
        )
        .withNearText({
          concepts: [query],
        })
        .withWhere({
          path: ['type'],
          operator: 'Equal',
          valueString: type,
        })
        .withLimit(limit)
        .do();

      const knowledgeEntities = result.data?.Get?.[this.className] || [];

      return knowledgeEntities.map((entity: any) =>
        KnowledgeWeaviateMapper.toDomain({
          ...entity,
          id: entity._additional.id,
        }),
      );
    } catch (error) {
      this.logger.error('Error finding knowledge by type:', error);
      return [];
    }
  }

  async updateKnowledgeVector(id: string, vector: number[]): Promise<void> {
    await this.ensureClientReady();

    try {
      // Get existing entity
      const existingEntity = await this.getKnowledgeById(id);
      if (!existingEntity) {
        throw new Error(`Knowledge entity with ID ${id} not found`);
      }

      // Update the entity with new vector
      const persistenceModel = KnowledgeWeaviateMapper.toPersistence({
        ...existingEntity,
        vector,
        updatedAt: new Date(),
      });

      const {
        vector: entityVector,
        vectorizedText,
        id: entityId,
        ...weaviateProperties
      } = persistenceModel;

      await this.client.data
        .updater()
        .withId(id)
        .withClassName(this.className)
        .withProperties(weaviateProperties)
        .do();

      this.logger.log(`Knowledge vector updated in Weaviate with ID: ${id}`);
    } catch (error) {
      this.logger.error('Error updating knowledge vector:', error);
      throw error;
    }
  }

  async deleteKnowledgeVector(id: string): Promise<void> {
    await this.ensureClientReady();

    try {
      await this.client.data
        .deleter()
        .withClassName(this.className)
        .withId(id)
        .do();

      this.logger.log(`Knowledge vector deleted from Weaviate with ID: ${id}`);
    } catch (error) {
      this.logger.error(`Error deleting knowledge vector ${id}:`, error);
      throw error;
    }
  }

  async findRelatedConcepts(
    entityId: string,
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    await this.ensureClientReady();

    try {
      // First get the entity to find its related concepts
      const entity = await this.getKnowledgeById(entityId);
      if (!entity) {
        return [];
      }

      // Use the entity's vector to find similar entities
      if (entity.vector) {
        return await this.findSimilarKnowledge(entity.vector, limit + 1);
      }

      // Fallback to semantic search using entity name and description
      const searchQuery = `${entity.name} ${entity.description}`;
      const results = await this.semanticKnowledgeSearch(
        searchQuery,
        limit + 1,
      );

      // Filter out the original entity
      return results.filter((result) => result.id !== entityId).slice(0, limit);
    } catch (error) {
      this.logger.error('Error finding related concepts:', error);
      return [];
    }
  }

  async hybridKnowledgeSearch(
    query: string,
    filters: Record<string, any>,
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    await this.ensureClientReady();

    try {
      let queryBuilder = this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id certainty } type name description propertyKeys propertyValues relatedEntityIds relationshipTypes relationshipWeights confidence relevanceScore source tags createdAt updatedAt',
        )
        .withNearText({
          concepts: [query],
        })
        .withLimit(limit);

      // Apply filters
      const whereConditions: any[] = [];

      if (filters.type) {
        whereConditions.push({
          path: ['type'],
          operator: 'Equal',
          valueString: filters.type,
        });
      }

      if (filters.source) {
        whereConditions.push({
          path: ['source'],
          operator: 'Equal',
          valueString: filters.source,
        });
      }

      if (filters.tags && Array.isArray(filters.tags)) {
        whereConditions.push({
          path: ['tags'],
          operator: 'ContainsAny',
          valueTextArray: filters.tags,
        });
      }

      if (filters.minConfidence) {
        whereConditions.push({
          path: ['confidence'],
          operator: 'GreaterThanEqual',
          valueNumber: filters.minConfidence,
        });
      }

      if (filters.startDate || filters.endDate) {
        if (filters.startDate) {
          whereConditions.push({
            path: ['createdAt'],
            operator: 'GreaterThanEqual',
            valueDate: filters.startDate,
          });
        }

        if (filters.endDate) {
          whereConditions.push({
            path: ['createdAt'],
            operator: 'LessThanEqual',
            valueDate: filters.endDate,
          });
        }
      }

      if (filters.relatedEntityId) {
        whereConditions.push({
          path: ['relatedEntityIds'],
          operator: 'ContainsAny',
          valueTextArray: [filters.relatedEntityId],
        });
      }

      if (whereConditions.length > 0) {
        queryBuilder = queryBuilder.withWhere({
          operator: 'And',
          operands: whereConditions,
        });
      }

      const result = await queryBuilder.do();
      const knowledgeEntities = result.data?.Get?.[this.className] || [];

      return knowledgeEntities.map((entity: any) =>
        KnowledgeWeaviateMapper.toDomain({
          ...entity,
          id: entity._additional.id,
        }),
      );
    } catch (error) {
      this.logger.error('Error in hybrid knowledge search:', error);
      return [];
    }
  }

  // Additional utility methods
  async getKnowledgeById(id: string): Promise<KnowledgeEntity | null> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id } type name description propertyKeys propertyValues relatedEntityIds relationshipTypes relationshipWeights confidence relevanceScore source tags createdAt updatedAt',
        )
        .withWhere({
          path: ['id'],
          operator: 'Equal',
          valueString: id,
        })
        .withLimit(1)
        .do();

      const knowledgeEntities = result.data?.Get?.[this.className] || [];

      if (knowledgeEntities.length === 0) {
        return null;
      }

      return KnowledgeWeaviateMapper.toDomain({
        ...knowledgeEntities[0],
        id: knowledgeEntities[0]._additional.id,
      });
    } catch (error) {
      this.logger.error('Error getting knowledge by ID:', error);
      return null;
    }
  }

  async searchByPropertyKey(
    propertyKey: string,
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id certainty } type name description propertyKeys propertyValues relatedEntityIds relationshipTypes relationshipWeights confidence relevanceScore source tags createdAt updatedAt',
        )
        .withWhere({
          path: ['propertyKeys'],
          operator: 'ContainsAny',
          valueTextArray: [propertyKey],
        })
        .withLimit(limit)
        .do();

      const knowledgeEntities = result.data?.Get?.[this.className] || [];

      return knowledgeEntities.map((entity: any) =>
        KnowledgeWeaviateMapper.toDomain({
          ...entity,
          id: entity._additional.id,
        }),
      );
    } catch (error) {
      this.logger.error('Error searching by property key:', error);
      return [];
    }
  }

  async findEntitiesByRelationshipType(
    relationshipType: string,
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id certainty } type name description propertyKeys propertyValues relatedEntityIds relationshipTypes relationshipWeights confidence relevanceScore source tags createdAt updatedAt',
        )
        .withWhere({
          path: ['relationshipTypes'],
          operator: 'ContainsAny',
          valueTextArray: [relationshipType],
        })
        .withLimit(limit)
        .do();

      const knowledgeEntities = result.data?.Get?.[this.className] || [];

      return knowledgeEntities.map((entity: any) =>
        KnowledgeWeaviateMapper.toDomain({
          ...entity,
          id: entity._additional.id,
        }),
      );
    } catch (error) {
      this.logger.error('Error finding entities by relationship type:', error);
      return [];
    }
  }

  async aggregateKnowledgeByType(): Promise<any[]> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .aggregate()
        .withClassName(this.className)
        .withFields('groupedBy { path value } meta { count }')
        .withGroupBy(['type'])
        .do();

      return result.data?.Aggregate?.[this.className] || [];
    } catch (error) {
      this.logger.error('Error aggregating knowledge by type:', error);
      return [];
    }
  }

  async findHighConfidenceEntities(
    minConfidence: number = 0.8,
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id certainty } type name description propertyKeys propertyValues relatedEntityIds relationshipTypes relationshipWeights confidence relevanceScore source tags createdAt updatedAt',
        )
        .withWhere({
          path: ['confidence'],
          operator: 'GreaterThanEqual',
          valueNumber: minConfidence,
        })
        .withLimit(limit)
        .do();

      const knowledgeEntities = result.data?.Get?.[this.className] || [];

      return knowledgeEntities.map((entity: any) =>
        KnowledgeWeaviateMapper.toDomain({
          ...entity,
          id: entity._additional.id,
        }),
      );
    } catch (error) {
      this.logger.error('Error finding high confidence entities:', error);
      return [];
    }
  }

  async getVectorStats(): Promise<any> {
    await this.ensureClientReady();

    try {
      // Get basic class information
      const classInfo = await this.client.schema
        .classGetter()
        .withClassName(this.className)
        .do();

      // Get aggregate statistics
      const aggregateResult = await this.client.graphql
        .aggregate()
        .withClassName(this.className)
        .withFields('meta { count }')
        .do();

      const totalObjects =
        aggregateResult.data?.Aggregate?.[this.className]?.[0]?.meta?.count ||
        0;

      // Get type distribution
      const typeDistribution = await this.client.graphql
        .aggregate()
        .withClassName(this.className)
        .withFields('groupedBy { path value } meta { count }')
        .withGroupBy(['type'])
        .do();

      const typeStats =
        typeDistribution.data?.Aggregate?.[this.className] || [];

      // Get confidence distribution
      const confidenceStats = await this.client.graphql
        .aggregate()
        .withClassName(this.className)
        .withFields('confidence { mean median maximum minimum count }')
        .do();

      const confidence =
        confidenceStats.data?.Aggregate?.[this.className]?.[0]?.confidence ||
        {};

      // Get recent activity (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const recentActivity = await this.client.graphql
        .aggregate()
        .withClassName(this.className)
        .withFields('meta { count }')
        .withWhere({
          path: ['createdAt'],
          operator: 'GreaterThan',
          valueDate: yesterday.toISOString(),
        })
        .do();

      const recentCount =
        recentActivity.data?.Aggregate?.[this.className]?.[0]?.meta?.count || 0;

      return {
        className: this.className,
        totalObjects,
        typeDistribution: typeStats.map((stat: any) => ({
          type: stat.groupedBy.value,
          count: stat.meta.count,
        })),
        confidence: {
          mean: confidence.mean || 0,
          median: confidence.median || 0,
          maximum: confidence.maximum || 0,
          minimum: confidence.minimum || 0,
          count: confidence.count || 0,
        },
        recentActivity: {
          last24Hours: recentCount,
          percentage: totalObjects > 0 ? (recentCount / totalObjects) * 100 : 0,
        },
        vectorDimensions:
          classInfo?.vectorizer === 'text2vec-transformers' ? 384 : 'unknown',
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error('Error getting vector stats:', error);
      return {
        className: this.className,
        totalObjects: 0,
        error: 'Failed to retrieve stats',
        lastUpdated: new Date(),
      };
    }
  }
}
