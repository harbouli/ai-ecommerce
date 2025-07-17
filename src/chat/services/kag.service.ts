/* eslint-disable @typescript-eslint/no-unused-vars */
// src/chat/services/kag.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeRepository } from '../infrastructure/persistence/knowledge.repository';
import { KnowledgeEntity } from '../domain/knowledge';
import { Message, ExtractedEntity } from '../domain/message';
import { AIService } from '../../ai/ai.service';

export interface KnowledgeContext {
  primaryEntities: KnowledgeEntity[];
  relatedEntities: KnowledgeEntity[];
  relationships: EntityRelationship[];
  contextScore: number;
  contextSummary: string;
}

export interface EntityRelationship {
  fromEntity: KnowledgeEntity;
  toEntity: KnowledgeEntity;
  relationshipType: string;
  strength: number;
  metadata: Record<string, any>;
}

export interface KnowledgeRecommendation {
  entity: KnowledgeEntity;
  reason: string;
  confidence: number;
  source: 'GRAPH' | 'SEMANTIC' | 'HYBRID';
  metadata: Record<string, any>;
}

@Injectable()
export class KagService {
  private readonly logger = new Logger(KagService.name);

  constructor(
    private readonly knowledgeRepository: KnowledgeRepository,
    private readonly aiService: AIService,
  ) {}

  // ===== CORE KAG METHODS =====

  async enhanceQueryWithKnowledge(
    query: string,
    entities: ExtractedEntity[],
  ): Promise<string> {
    try {
      this.logger.log(
        `Enhancing query with knowledge: "${query.substring(0, 50)}..."`,
      );

      if (entities.length === 0) {
        return query;
      }

      // Build comprehensive knowledge context
      const knowledgeContext = await this.buildKnowledgeContext(entities);

      if (knowledgeContext.primaryEntities.length === 0) {
        return query;
      }

      // Create enhanced query with structured knowledge
      const enhancedQuery = this.constructEnhancedQuery(
        query,
        knowledgeContext,
      );

      this.logger.log(
        `Enhanced query with ${knowledgeContext.primaryEntities.length} primary entities`,
      );
      return enhancedQuery;
    } catch (error) {
      this.logger.error('Failed to enhance query with knowledge:', error);
      return query;
    }
  }

  async buildKnowledgeContext(
    entities: ExtractedEntity[],
  ): Promise<KnowledgeContext> {
    try {
      this.logger.log(
        `Building knowledge context for ${entities.length} entities`,
      );

      const primaryEntities: KnowledgeEntity[] = [];
      const relatedEntities: KnowledgeEntity[] = [];
      const relationships: EntityRelationship[] = [];

      // 1. Find primary knowledge entities
      for (const entity of entities) {
        const foundEntities = await this.findKnowledgeEntitiesByEntity(entity);
        primaryEntities.push(...foundEntities);
      }

      // Remove duplicates
      const uniquePrimaryEntities = this.deduplicateEntities(primaryEntities);

      // 2. Find related entities through graph traversal
      for (const primaryEntity of uniquePrimaryEntities) {
        const related = await this.knowledgeRepository.findRelated(
          primaryEntity.id,
          2,
        );
        relatedEntities.push(...related);

        // Find relationships
        const entityRelationships = await this.extractEntityRelationships(
          primaryEntity,
          related,
        );
        relationships.push(...entityRelationships);
      }

      // Remove duplicates from related entities
      const uniqueRelatedEntities = this.deduplicateEntities(
        relatedEntities,
      ).filter(
        (entity) => !uniquePrimaryEntities.find((pe) => pe.id === entity.id),
      );

      // 3. Calculate context score
      const contextScore = this.calculateContextScore(
        uniquePrimaryEntities,
        uniqueRelatedEntities,
        relationships,
      );

      // 4. Generate context summary
      const contextSummary = await this.generateContextSummary(
        uniquePrimaryEntities,
        uniqueRelatedEntities,
      );

      const knowledgeContext: KnowledgeContext = {
        primaryEntities: uniquePrimaryEntities,
        relatedEntities: uniqueRelatedEntities.slice(0, 10), // Limit for performance
        relationships: relationships.slice(0, 20),
        contextScore,
        contextSummary,
      };

      this.logger.log(
        `Built knowledge context with score: ${contextScore.toFixed(2)}`,
      );
      return knowledgeContext;
    } catch (error) {
      this.logger.error('Failed to build knowledge context:', error);
      return {
        primaryEntities: [],
        relatedEntities: [],
        relationships: [],
        contextScore: 0,
        contextSummary: '',
      };
    }
  }

  async updateKnowledgeGraph(message: Message): Promise<void> {
    try {
      if (!message.entities || message.entities.length === 0) {
        this.logger.debug('No entities to process in message');
        return;
      }

      this.logger.log(`Updating knowledge graph from message: ${message.id}`);

      // 1. Process entities and create/update knowledge nodes
      const processedEntities = await this.processMessageEntities(message);

      // 2. Create relationships between entities
      await this.createEntityRelationships(processedEntities, message);

      // 3. Update user interaction patterns
      await this.updateUserInteractionPatterns(message, processedEntities);

      // 4. Update entity popularity and trends
      await this.updateEntityMetrics(processedEntities, message);

      this.logger.log(
        `Knowledge graph updated with ${processedEntities.length} entities`,
      );
    } catch (error) {
      this.logger.error('Failed to update knowledge graph:', error);
      // Don't throw to avoid breaking main conversation flow
    }
  }
  private updateUserInteractionPatterns(
    message: Message,
    entities: KnowledgeEntity[],
  ): void {
    try {
      // This would update user interaction patterns for personalization
      // Implementation depends on your user behavior tracking requirements
      this.logger.debug(
        `Updating user interaction patterns for session: ${message.sessionId}`,
      );
    } catch (error) {
      this.logger.warn('Failed to update user interaction patterns:', error);
    }
  }
  private async updateEntityMetrics(
    entities: KnowledgeEntity[],
    message: Message,
  ): Promise<void> {
    try {
      for (const entity of entities) {
        // Update popularity metrics, trending scores, etc.
        const updatedProperties = {
          ...entity.properties,
          lastInteraction: new Date(),
          recentInteractions: [
            ...(entity.properties?.recentInteractions || []),
            {
              messageId: message.id,
              sessionId: message.sessionId,
              timestamp: new Date(),
            },
          ].slice(-10), // Keep last 10 interactions
        };

        await this.knowledgeRepository.update(entity.id, {
          properties: updatedProperties,
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      this.logger.warn('Failed to update entity metrics:', error);
    }
  }
  async findKnowledgeRecommendations(
    userId: string,
    entities: ExtractedEntity[],
  ): Promise<KnowledgeRecommendation[]> {
    try {
      this.logger.log(`Finding knowledge recommendations for user: ${userId}`);

      const recommendations: KnowledgeRecommendation[] = [];

      // 1. Graph-based recommendations
      const graphRecs = await this.getGraphBasedRecommendations(entities);
      recommendations.push(...graphRecs);

      // 2. Semantic similarity recommendations
      const semanticRecs = await this.getSemanticRecommendations(entities);
      recommendations.push(...semanticRecs);

      // 3. User behavior-based recommendations
      const behaviorRecs = await this.getUserBehaviorRecommendations(
        userId,
        entities,
      );
      recommendations.push(...behaviorRecs);

      // 4. Trending/popular recommendations
      const trendingRecs = await this.getTrendingRecommendations(entities);
      recommendations.push(...trendingRecs);

      // Deduplicate and score recommendations
      const uniqueRecommendations =
        this.deduplicateRecommendations(recommendations);
      const scoredRecommendations = this.scoreRecommendations(
        uniqueRecommendations,
      );

      // Sort by confidence and limit results
      const finalRecommendations = scoredRecommendations
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10);

      this.logger.log(
        `Generated ${finalRecommendations.length} knowledge recommendations`,
      );
      return finalRecommendations;
    } catch (error) {
      this.logger.error('Failed to find knowledge recommendations:', error);
      return [];
    }
  }
  private async getSemanticRecommendations(
    entities: ExtractedEntity[],
  ): Promise<KnowledgeRecommendation[]> {
    const recommendations: KnowledgeRecommendation[] = [];

    for (const entity of entities) {
      try {
        const semanticMatches = await this.knowledgeRepository.semanticSearch(
          entity.text,
          5,
        );

        for (const match of semanticMatches) {
          recommendations.push({
            entity: match,
            reason: `Semantically similar to "${entity.text}"`,
            confidence: 0.6,
            source: 'SEMANTIC',
            metadata: {
              queryText: entity.text,
              entityType: entity.type,
            },
          });
        }
      } catch (error) {
        this.logger.warn(
          `Failed to get semantic recommendations for ${entity.text}:`,
          error,
        );
      }
    }

    return recommendations;
  }

  private async getUserBehaviorRecommendations(
    userId: string,
    entities: ExtractedEntity[],
  ): Promise<KnowledgeRecommendation[]> {
    const recommendations: KnowledgeRecommendation[] = [];

    try {
      // Get user's interaction history (simplified - would need user behavior tracking)
      const userEntity = await this.knowledgeRepository.findById(userId);

      if (userEntity && userEntity.type === 'CUSTOMER') {
        const userRelatedEntities = await this.knowledgeRepository.findRelated(
          userId,
          2,
        );

        for (const related of userRelatedEntities) {
          if (related.type === 'PRODUCT') {
            recommendations.push({
              entity: related,
              reason: 'Based on your previous interactions and preferences',
              confidence: 0.8,
              source: 'HYBRID',
              metadata: {
                userId,
                personalized: true,
              },
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to get user behavior recommendations for ${userId}:`,
        error,
      );
    }

    return recommendations;
  }
  private async getGraphBasedRecommendations(
    entities: ExtractedEntity[],
  ): Promise<KnowledgeRecommendation[]> {
    const recommendations: KnowledgeRecommendation[] = [];

    for (const entity of entities) {
      try {
        const knowledgeEntities = await this.knowledgeRepository.findByName(
          entity.text,
        );

        for (const knowledgeEntity of knowledgeEntities) {
          const relatedEntities = await this.knowledgeRepository.findRelated(
            knowledgeEntity.id,
            2,
          );

          for (const related of relatedEntities) {
            recommendations.push({
              entity: related,
              reason: `Related to ${knowledgeEntity.name} through knowledge graph`,
              confidence: 0.7,
              source: 'GRAPH',
              metadata: {
                sourceEntity: knowledgeEntity.name,
                relationshipDepth: 2,
              },
            });
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to get graph recommendations for ${entity.text}:`,
          error,
        );
      }
    }

    return recommendations;
  }

  private async getTrendingRecommendations(
    entities: ExtractedEntity[],
  ): Promise<KnowledgeRecommendation[]> {
    const recommendations: KnowledgeRecommendation[] = [];

    try {
      // Get trending products (simplified - would need popularity tracking)
      const trendingProducts =
        await this.knowledgeRepository.findByType('PRODUCT');

      // Filter trending products that are relevant to the entities
      const relevantTrending = trendingProducts
        .filter((product) =>
          entities.some(
            (entity) =>
              product.name.toLowerCase().includes(entity.text.toLowerCase()) ||
              product.description
                .toLowerCase()
                .includes(entity.text.toLowerCase()),
          ),
        )
        .slice(0, 3);

      for (const trending of relevantTrending) {
        recommendations.push({
          entity: trending,
          reason: 'Currently trending and relevant to your interests',
          confidence: 0.6,
          source: 'HYBRID',
          metadata: {
            trending: true,
            popularity: trending.properties?.mentionCount || 1,
          },
        });
      }
    } catch (error) {
      this.logger.warn('Failed to get trending recommendations:', error);
    }

    return recommendations;
  }

  async getContextualKnowledge(
    sessionId: string,
    query: string,
  ): Promise<KnowledgeEntity[]> {
    try {
      this.logger.log(`Getting contextual knowledge for session: ${sessionId}`);

      const contextualEntities: KnowledgeEntity[] = [];

      // 1. Semantic search based on query
      const semanticResults = await this.knowledgeRepository.semanticSearch(
        query,
        8,
      );
      contextualEntities.push(...semanticResults);

      // 2. Hybrid search for comprehensive coverage
      const hybridResults = await this.knowledgeRepository.hybridSearch(query, {
        limit: 8,
      });
      contextualEntities.push(...hybridResults);

      // 4. Find related entities for top results
      const enrichedEntities =
        await this.enrichWithRelatedEntities(contextualEntities);

      // Deduplicate and score by relevance
      const uniqueEntities = this.deduplicateEntities(enrichedEntities);
      const scoredEntities = await this.scoreEntitiesByRelevance(
        uniqueEntities,
        query,
      );

      const finalResults = scoredEntities
        .sort(
          (a, b) =>
            (b.properties?.relevanceScore || 0) -
            (a.properties?.relevanceScore || 0),
        )
        .slice(0, 12);

      this.logger.log(
        `Retrieved ${finalResults.length} contextual knowledge entities`,
      );
      return finalResults;
    } catch (error) {
      this.logger.error('Failed to get contextual knowledge:', error);
      return [];
    }
  }
  private deduplicateRecommendations(
    recommendations: KnowledgeRecommendation[],
  ): KnowledgeRecommendation[] {
    const seen = new Set<string>();
    return recommendations.filter((rec) => {
      if (seen.has(rec.entity.id)) {
        return false;
      }
      seen.add(rec.entity.id);
      return true;
    });
  }
  private scoreRecommendations(
    recommendations: KnowledgeRecommendation[],
  ): KnowledgeRecommendation[] {
    return recommendations.map((rec) => {
      let adjustedConfidence = rec.confidence;

      // Boost confidence for products with more interactions
      const mentionCount = rec.entity.properties?.mentionCount || 1;
      adjustedConfidence += Math.min(mentionCount * 0.01, 0.2);

      // Boost confidence for entities with descriptions
      if (rec.entity.description && rec.entity.description.length > 20) {
        adjustedConfidence += 0.05;
      }

      // Boost confidence for entities with vectors (semantic richness)
      if (rec.entity.vector && rec.entity.vector.length > 0) {
        adjustedConfidence += 0.1;
      }

      // Source-based adjustments
      switch (rec.source) {
        case 'GRAPH':
          adjustedConfidence += 0.05; // Graph relationships are valuable
          break;
        case 'SEMANTIC':
          adjustedConfidence += 0.03; // Semantic similarity is good
          break;
        case 'HYBRID':
          adjustedConfidence += 0.08; // Hybrid approaches are often best
          break;
      }

      return {
        ...rec,
        confidence: Math.min(adjustedConfidence, 1.0),
      };
    });
  }

  private scoreEntitiesByRelevance(
    entities: KnowledgeEntity[],
    query: string,
  ): KnowledgeEntity[] {
    return entities.map((entity) => {
      let relevanceScore = 0;

      // Text similarity score
      const queryLower = query.toLowerCase();
      const nameLower = entity.name.toLowerCase();
      const descLower = entity.description.toLowerCase();

      if (nameLower.includes(queryLower)) relevanceScore += 0.4;
      if (descLower.includes(queryLower)) relevanceScore += 0.2;

      // Query terms overlap
      const queryTerms = queryLower
        .split(' ')
        .filter((term) => term.length > 2);
      const nameTerms = nameLower.split(' ');
      const overlap = queryTerms.filter((term) =>
        nameTerms.some((nt) => nt.includes(term)),
      ).length;
      relevanceScore += (overlap / Math.max(queryTerms.length, 1)) * 0.3;

      // Entity quality bonus
      if (entity.vector && entity.vector.length > 0) relevanceScore += 0.1;
      if (entity.properties?.mentionCount && entity.properties.mentionCount > 5)
        relevanceScore += 0.1;

      return {
        ...entity,
        properties: {
          ...entity.properties,
          relevanceScore: Math.min(relevanceScore, 1.0),
        },
      };
    });
  }
  private async enrichWithRelatedEntities(
    entities: KnowledgeEntity[],
  ): Promise<KnowledgeEntity[]> {
    const enrichedEntities = [...entities];

    for (const entity of entities.slice(0, 3)) {
      // Limit to prevent too many API calls
      try {
        const relatedEntities = await this.knowledgeRepository.findRelated(
          entity.id,
          1,
        );
        enrichedEntities.push(...relatedEntities.slice(0, 2)); // Add top 2 related
      } catch (error) {
        this.logger.warn(
          `Failed to enrich entity ${entity.id} with related entities:`,
          error,
        );
      }
    }

    return enrichedEntities;
  }

  // ===== SPECIALIZED KAG METHODS =====

  async getProductRecommendationContext(
    productId: string,
  ): Promise<KnowledgeContext> {
    try {
      const product = await this.knowledgeRepository.findById(productId);
      if (!product || product.type !== 'PRODUCT') {
        return this.createEmptyContext();
      }

      // Get product-specific knowledge context
      const relatedProducts = await this.knowledgeRepository.findRelated(
        productId,
        2,
      );
      const recommendations =
        await this.knowledgeRepository.findRecommendations(productId, 8);

      // Build relationships
      const relationships = await this.extractEntityRelationships(product, [
        ...relatedProducts,
        ...recommendations,
      ]);

      return {
        primaryEntities: [product],
        relatedEntities: [...relatedProducts, ...recommendations],
        relationships,
        contextScore: this.calculateContextScore(
          [product],
          relatedProducts,
          relationships,
        ),
        contextSummary: await this.generateProductContextSummary(
          product,
          relatedProducts,
        ),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get product recommendation context for ${productId}:`,
        error,
      );
      return this.createEmptyContext();
    }
  }
  private generateProductContextSummary(
    product: KnowledgeEntity,
    relatedProducts: KnowledgeEntity[],
  ): string {
    try {
      const relatedNames = relatedProducts
        .slice(0, 3)
        .map((p) => p.name)
        .join(', ');
      return `Product context for ${product.name} with related products: ${relatedNames}`;
    } catch (error) {
      return `Product context for ${product.name}`;
    }
  }
  async getCategoryKnowledge(categoryId: string): Promise<KnowledgeEntity[]> {
    try {
      const category = await this.knowledgeRepository.findById(categoryId);
      if (!category || category.type !== 'CATEGORY') {
        return [];
      }

      // Get all products in category and related categories
      const categoryProducts = await this.knowledgeRepository.findByCategory(
        category.name,
      );
      const relatedCategories = await this.knowledgeRepository.findRelated(
        categoryId,
        1,
      );

      return [...categoryProducts, ...relatedCategories];
    } catch (error) {
      this.logger.error(
        `Failed to get category knowledge for ${categoryId}:`,
        error,
      );
      return [];
    }
  }

  async getBrandKnowledge(brandId: string): Promise<KnowledgeEntity[]> {
    try {
      const brand = await this.knowledgeRepository.findById(brandId);
      if (!brand || brand.type !== 'BRAND') {
        return [];
      }

      // Get all products from brand and related brands
      const brandProducts = await this.knowledgeRepository.findByBrand(
        brand.name,
      );
      const relatedBrands = await this.knowledgeRepository.findRelated(
        brandId,
        1,
      );

      return [...brandProducts, ...relatedBrands];
    } catch (error) {
      this.logger.error(`Failed to get brand knowledge for ${brandId}:`, error);
      return [];
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private async findKnowledgeEntitiesByEntity(
    entity: ExtractedEntity,
  ): Promise<KnowledgeEntity[]> {
    try {
      const entities: KnowledgeEntity[] = [];

      // 1. Direct name match
      const nameMatches = await this.knowledgeRepository.findByName(
        entity.text,
      );
      entities.push(...nameMatches);

      // 2. Type-based search with text filtering
      if (this.isProductRelatedEntity(entity.type)) {
        const knowledgeType = this.mapEntityTypeToKnowledgeType(entity.type);
        const typeEntities =
          await this.knowledgeRepository.findByType(knowledgeType);

        const relevantTypeEntities = typeEntities.filter((ke) =>
          this.isEntityRelevant(ke, entity.text),
        );
        entities.push(...relevantTypeEntities);
      }

      // 3. Semantic search for entity text
      const semanticMatches = await this.knowledgeRepository.semanticSearch(
        entity.text,
        3,
      );
      entities.push(...semanticMatches);

      return entities;
    } catch (error) {
      this.logger.error(
        `Failed to find knowledge entities for ${entity.text}:`,
        error,
      );
      return [];
    }
  }
  private isEntityRelevant(
    knowledgeEntity: KnowledgeEntity,
    entityText: string,
  ): boolean {
    const entityTextLower = entityText.toLowerCase();
    const nameLower = knowledgeEntity.name.toLowerCase();
    const descLower = knowledgeEntity.description.toLowerCase();

    return (
      nameLower.includes(entityTextLower) ||
      entityTextLower.includes(nameLower) ||
      descLower.includes(entityTextLower) ||
      this.calculateTextSimilarity(entityTextLower, nameLower) > 0.7
    );
  }
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity
    const set1 = new Set(text1.split(' '));
    const set2 = new Set(text2.split(' '));
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }
  private async processMessageEntities(
    message: Message,
  ): Promise<KnowledgeEntity[]> {
    const processedEntities: KnowledgeEntity[] = [];

    for (const entity of message.entities || []) {
      try {
        const knowledgeEntity = await this.createOrUpdateKnowledgeEntity(
          entity,
          message,
        );
        if (knowledgeEntity) {
          processedEntities.push(knowledgeEntity);
        }
      } catch (error) {
        this.logger.warn(`Failed to process entity ${entity.text}:`, error);
      }
    }

    return processedEntities;
  }

  private async createOrUpdateKnowledgeEntity(
    entity: ExtractedEntity,
    message: Message,
  ): Promise<KnowledgeEntity | null> {
    try {
      // Check if entity already exists
      const existingEntities = await this.knowledgeRepository.findByName(
        entity.text,
      );

      if (existingEntities.length > 0) {
        // Update existing entity
        return await this.updateExistingEntity(
          existingEntities[0],
          entity,
          message,
        );
      } else {
        // Create new entity
        return await this.createNewKnowledgeEntity(entity, message);
      }
    } catch (error) {
      this.logger.error(
        `Failed to create/update entity ${entity.text}:`,
        error,
      );
      return null;
    }
  }

  private async updateExistingEntity(
    existingEntity: KnowledgeEntity,
    newEntity: ExtractedEntity,
    message: Message,
  ): Promise<KnowledgeEntity> {
    const updatedProperties = {
      ...existingEntity.properties,
      lastMentioned: new Date(),
      mentionCount: (existingEntity.properties?.mentionCount || 0) + 1,
      totalConfidence:
        (existingEntity.properties?.totalConfidence || 0) +
        newEntity.confidence,
      averageConfidence:
        ((existingEntity.properties?.totalConfidence || 0) +
          newEntity.confidence) /
        ((existingEntity.properties?.mentionCount || 0) + 1),
      recentContexts: [
        ...(existingEntity.properties?.recentContexts || []),
        {
          messageId: message.id,
          sessionId: message.sessionId,
          confidence: newEntity.confidence,
          timestamp: new Date(),
          context: message.content.substring(
            Math.max(0, (newEntity.startIndex || 0) - 50),
            Math.min(message.content.length, (newEntity.endIndex || 0) + 50),
          ),
        },
      ].slice(-5), // Keep last 5 contexts
    };

    const updatedEntity = await this.knowledgeRepository.update(
      existingEntity.id,
      {
        properties: updatedProperties,
        updatedAt: new Date(),
      },
    );

    return updatedEntity || existingEntity;
  }

  private async createNewKnowledgeEntity(
    entity: ExtractedEntity,
    message: Message,
  ): Promise<KnowledgeEntity> {
    // Generate vector embedding
    let vector: number[] | undefined;
    try {
      const embeddingText = `${entity.text} ${entity.metadata?.context || ''} ${entity.type}`;
      const embedding = await this.aiService.generateEmbedding(embeddingText);
      vector = embedding.vector;
    } catch (error) {
      this.logger.warn(
        `Failed to generate embedding for ${entity.text}:`,
        error,
      );
    }

    const knowledgeType = this.mapEntityTypeToKnowledgeType(entity.type);

    const newEntity = {
      type: knowledgeType,
      name: entity.text,
      description: this.generateEntityDescription(entity),
      properties: {
        originalEntityType: entity.type,
        confidence: entity.confidence,
        firstMentioned: new Date(),
        lastMentioned: new Date(),
        mentionCount: 1,
        totalConfidence: entity.confidence,
        averageConfidence: entity.confidence,
        startIndex: entity.startIndex,
        endIndex: entity.endIndex,
        recentContexts: [
          {
            messageId: message.id,
            sessionId: message.sessionId,
            confidence: entity.confidence,
            timestamp: new Date(),
            context: message.content.substring(
              Math.max(0, (entity.startIndex || 0) - 50),
              Math.min(message.content.length, (entity.endIndex || 0) + 50),
            ),
          },
        ],
        metadata: entity.metadata,
      },
      vector,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await this.knowledgeRepository.create(newEntity);
  }

  private async createEntityRelationships(
    entities: KnowledgeEntity[],
    message: Message,
  ): Promise<void> {
    if (entities.length < 2) return;

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        await this.createRelationshipBetweenEntities(
          entities[i],
          entities[j],
          message,
        );
      }
    }
  }

  private async createRelationshipBetweenEntities(
    entity1: KnowledgeEntity,
    entity2: KnowledgeEntity,
    message: Message,
  ): Promise<void> {
    try {
      const relationshipType = this.determineRelationshipType(
        entity1.type,
        entity2.type,
      );
      const relationshipStrength = this.calculateRelationshipStrength(
        entity1,
        entity2,
      );

      // Update entity1 with relationship to entity2
      await this.addRelationshipToEntity(
        entity1,
        entity2.id,
        relationshipType,
        relationshipStrength,
        message,
      );

      // Update entity2 with relationship to entity1 (bidirectional)
      const reverseType = this.getReverseRelationshipType(relationshipType);
      await this.addRelationshipToEntity(
        entity2,
        entity1.id,
        reverseType,
        relationshipStrength,
        message,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to create relationship between ${entity1.name} and ${entity2.name}:`,
        error,
      );
    }
  }
  private calculateRelationshipStrength(
    entity1: KnowledgeEntity,
    entity2: KnowledgeEntity,
  ): number {
    let strength = 0.3; // Base strength for co-occurrence

    // Bonus for proximity in text
    if (entity1.properties?.startIndex && entity2.properties?.startIndex) {
      const distance = Math.abs(
        entity1.properties.startIndex - entity2.properties.startIndex,
      );
      if (distance < 50)
        strength += 0.3; // Close proximity
      else if (distance < 100) strength += 0.2;
      else if (distance < 200) strength += 0.1;
    }

    // Bonus for complementary types
    if (this.areComplementaryTypes(entity1.type, entity2.type)) {
      strength += 0.2;
    }

    return Math.min(strength, 1.0);
  }
  private areComplementaryTypes(
    type1: KnowledgeEntity['type'],
    type2: KnowledgeEntity['type'],
  ): boolean {
    const complementaryPairs = [
      ['PRODUCT', 'CATEGORY'],
      ['PRODUCT', 'BRAND'],
      ['PRODUCT', 'FEATURE'],
      ['CATEGORY', 'BRAND'],
    ];

    return complementaryPairs.some(
      (pair) =>
        (pair[0] === type1 && pair[1] === type2) ||
        (pair[0] === type2 && pair[1] === type1),
    );
  }

  private getReverseRelationshipType(relationshipType: string): string {
    const reverseMap: Record<string, string> = {
      BELONGS_TO: 'CONTAINS',
      CONTAINS: 'BELONGS_TO',
      MADE_BY: 'MAKES',
      MAKES: 'MADE_BY',
      HAS_FEATURE: 'FEATURED_IN',
      FEATURED_IN: 'HAS_FEATURE',
      INTERESTED_IN: 'ATTRACTS',
      ATTRACTS: 'INTERESTED_IN',
      RELATED_TO: 'RELATED_TO',
      CO_MENTIONED: 'CO_MENTIONED',
    };

    return reverseMap[relationshipType] || relationshipType;
  }

  private async addRelationshipToEntity(
    entity: KnowledgeEntity,
    relatedEntityId: string,
    relationshipType: string,
    strength: number,
    message: Message,
  ): Promise<void> {
    const relationships = entity.properties?.relationships || [];

    const existingRelationship = relationships.find(
      (rel: any) =>
        rel.entityId === relatedEntityId && rel.type === relationshipType,
    );

    if (existingRelationship) {
      // Update existing relationship
      existingRelationship.strength = Math.min(
        existingRelationship.strength + strength,
        10,
      ); // Cap at 10
      existingRelationship.lastUpdated = new Date();
      existingRelationship.coOccurrences =
        (existingRelationship.coOccurrences || 1) + 1;
    } else {
      // Create new relationship
      relationships.push({
        entityId: relatedEntityId,
        type: relationshipType,
        strength,
        coOccurrences: 1,
        createdAt: new Date(),
        lastUpdated: new Date(),
        metadata: {
          firstMessageId: message.id,
          sessionId: message.sessionId,
        },
      });
    }

    await this.knowledgeRepository.update(entity.id, {
      properties: {
        ...entity.properties,
        relationships: relationships.slice(-30), // Keep last 30 relationships
      },
      updatedAt: new Date(),
    });
  }

  private constructEnhancedQuery(
    query: string,
    context: KnowledgeContext,
  ): string {
    if (context.contextScore < 0.3) {
      return query; // Low confidence context, return original
    }

    const contextInfo = context.primaryEntities
      .map((entity) => `${entity.name} (${entity.type}): ${entity.description}`)
      .join('\n');

    const relatedInfo = context.relatedEntities
      .slice(0, 5) // Top 5 related entities
      .map((entity) => `- ${entity.name}: ${entity.description}`)
      .join('\n');

    return `
Query: ${query}

Knowledge Context (Score: ${context.contextScore.toFixed(2)}):
${contextInfo}

Related Knowledge:
${relatedInfo}

Context Summary: ${context.contextSummary}

Enhanced Understanding: Use the above knowledge context to provide more accurate and comprehensive responses about the mentioned entities and their relationships.
    `.trim();
  }

  // Utility methods
  private deduplicateEntities(entities: KnowledgeEntity[]): KnowledgeEntity[] {
    return entities.filter(
      (entity, index, self) =>
        index === self.findIndex((e) => e.id === entity.id),
    );
  }

  private isProductRelatedEntity(entityType: string): boolean {
    return ['PRODUCT', 'CATEGORY', 'BRAND', 'FEATURE', 'PRICE'].includes(
      entityType,
    );
  }

  private mapEntityTypeToKnowledgeType(
    entityType: string,
  ): KnowledgeEntity['type'] {
    const typeMap: Record<string, KnowledgeEntity['type']> = {
      PRODUCT: 'PRODUCT',
      CATEGORY: 'CATEGORY',
      BRAND: 'BRAND',
      FEATURE: 'FEATURE',
      PRICE: 'PRODUCT',
      PERSON: 'CUSTOMER',
      LOCATION: 'CONCEPT',
    };
    return typeMap[entityType] || 'CONCEPT';
  }

  private createEmptyContext(): KnowledgeContext {
    return {
      primaryEntities: [],
      relatedEntities: [],
      relationships: [],
      contextScore: 0,
      contextSummary: '',
    };
  }
  private extractEntityRelationships(
    primaryEntity: KnowledgeEntity,
    relatedEntities: KnowledgeEntity[],
  ): EntityRelationship[] {
    const relationships: EntityRelationship[] = [];

    for (const relatedEntity of relatedEntities) {
      const relationshipType = this.determineRelationshipType(
        primaryEntity.type,
        relatedEntity.type,
      );
      const strength = this.calculateEntityRelationshipStrength(
        primaryEntity,
        relatedEntity,
      );

      relationships.push({
        fromEntity: primaryEntity,
        toEntity: relatedEntity,
        relationshipType,
        strength,
        metadata: {
          automatic: true,
          confidence: strength,
          timestamp: new Date(),
        },
      });
    }

    return relationships;
  }
  private determineRelationshipType(
    type1: KnowledgeEntity['type'],
    type2: KnowledgeEntity['type'],
  ): string {
    const relationshipMap: Record<string, string> = {
      'PRODUCT-CATEGORY': 'BELONGS_TO',
      'CATEGORY-PRODUCT': 'CONTAINS',
      'PRODUCT-BRAND': 'MADE_BY',
      'BRAND-PRODUCT': 'MAKES',
      'PRODUCT-FEATURE': 'HAS_FEATURE',
      'FEATURE-PRODUCT': 'FEATURED_IN',
      'PRODUCT-PRODUCT': 'RELATED_TO',
      'CUSTOMER-PRODUCT': 'INTERESTED_IN',
      'PRODUCT-CUSTOMER': 'ATTRACTS',
      'CATEGORY-CATEGORY': 'RELATED_CATEGORY',
      'BRAND-BRAND': 'COMPETING_BRAND',
    };

    const key = `${type1}-${type2}`;
    return relationshipMap[key] || 'CO_MENTIONED';
  }
  private calculateEntityRelationshipStrength(
    entity1: KnowledgeEntity,
    entity2: KnowledgeEntity,
  ): number {
    let strength = 0.5; // Base strength

    // Same type entities have lower strength
    if (entity1.type === entity2.type) {
      strength += 0.2;
    } else {
      strength += 0.3; // Different types are more interesting
    }

    // Bonus for entities with more mentions
    const mentionBonus = Math.min(
      ((entity1.properties?.mentionCount || 1) +
        (entity2.properties?.mentionCount || 1)) *
        0.01,
      0.2,
    );
    strength += mentionBonus;

    return Math.min(strength, 1.0);
  }
  private calculateContextScore(
    primaryEntities: KnowledgeEntity[],
    relatedEntities: KnowledgeEntity[],
    relationships: EntityRelationship[],
  ): number {
    if (primaryEntities.length === 0) return 0;

    let score = 0;

    // Base score from primary entities
    score += primaryEntities.length * 0.3;

    // Bonus for related entities
    score += Math.min(relatedEntities.length * 0.1, 0.5);

    // Bonus for relationships
    score += Math.min(relationships.length * 0.05, 0.3);

    // Quality bonus based on entity completeness
    const qualityBonus =
      primaryEntities.reduce((acc, entity) => {
        if (entity.vector && entity.vector.length > 0) acc += 0.1;
        if (entity.description && entity.description.length > 10) acc += 0.1;
        if (entity.properties && Object.keys(entity.properties).length > 3)
          acc += 0.1;
        return acc;
      }, 0) / primaryEntities.length;

    score += qualityBonus;

    return Math.min(score, 1.0); // Cap at 1.0
  }
  private async generateContextSummary(
    primaryEntities: KnowledgeEntity[],
    relatedEntities: KnowledgeEntity[],
  ): Promise<string> {
    if (primaryEntities.length === 0) return '';

    try {
      const primaryNames = primaryEntities.map((e) => e.name).join(', ');
      const relatedNames = relatedEntities
        .slice(0, 5)
        .map((e) => e.name)
        .join(', ');

      const summaryPrompt = `
Generate a brief context summary for these entities:
Primary: ${primaryNames}
Related: ${relatedNames}

Provide a 1-2 sentence summary explaining their relationship and relevance.
      `;

      const response = await this.aiService.generateResponse(summaryPrompt);
      return response.content.trim();
    } catch (error) {
      this.logger.warn('Failed to generate context summary:', error);
      return `Context includes ${primaryEntities.length} primary entities and ${relatedEntities.length} related entities.`;
    }
  }
  private generateEntityDescription(entity: ExtractedEntity): string {
    try {
      const entityType = entity.type;
      const entityText = entity.text;
      const confidence = entity.confidence;
      const metadata = entity.metadata || {};
      const context = metadata.context || '';

      // Base description templates by entity type
      const descriptionTemplates: Record<string, string> = {
        PRODUCT: `Product: ${entityText}`,
        CATEGORY: `Product category: ${entityText}`,
        BRAND: `Brand: ${entityText}`,
        FEATURE: `Product feature: ${entityText}`,
        PRICE: `Price point: ${entityText}`,
        PERSON: `Person: ${entityText}`,
        LOCATION: `Location: ${entityText}`,
      };

      let description =
        descriptionTemplates[entityType] || `Entity: ${entityText}`;

      // Enhance description based on confidence level
      if (confidence >= 0.9) {
        description += ' (high confidence)';
      } else if (confidence >= 0.7) {
        description += ' (medium confidence)';
      } else if (confidence < 0.5) {
        description += ' (low confidence)';
      }

      // Add context information if available
      if (context && context.trim().length > 0) {
        // Clean and truncate context
        const cleanContext = context.trim().substring(0, 100);
        description += `. Context: "${cleanContext}"`;

        if (context.length > 100) {
          description += '...';
        }
      }

      // Add specific enhancements based on entity type
      switch (entityType) {
        case 'PRODUCT':
          description += this.enhanceProductDescription(entityText, metadata);
          break;
        case 'CATEGORY':
          description += this.enhanceCategoryDescription(entityText, metadata);
          break;
        case 'BRAND':
          description += this.enhanceBrandDescription(entityText, metadata);
          break;
        case 'FEATURE':
          description += this.enhanceFeatureDescription(entityText, metadata);
          break;
        case 'PRICE':
          description += this.enhancePriceDescription(entityText, metadata);
          break;
      }

      // Add metadata information if relevant
      if (
        metadata.startIndex !== undefined &&
        metadata.endIndex !== undefined
      ) {
        description += ` (position: ${metadata.startIndex}-${metadata.endIndex})`;
      }

      // Add extraction timestamp
      description += `. Extracted: ${new Date().toISOString()}`;

      return description;
    } catch (error) {
      // Fallback description in case of error
      return `${entity.type} entity: ${entity.text}. Confidence: ${entity.confidence}`;
    }
  }

  private enhanceProductDescription(
    productName: string,
    metadata: Record<string, any>,
  ): string {
    let enhancement = '';

    // Add product-specific details from metadata
    if (metadata.price) {
      enhancement += `. Price: ${metadata.price}`;
    }

    if (metadata.category) {
      enhancement += `. Category: ${metadata.category}`;
    }

    if (metadata.brand) {
      enhancement += `. Brand: ${metadata.brand}`;
    }

    if (metadata.features && Array.isArray(metadata.features)) {
      const features = metadata.features.slice(0, 3).join(', ');
      enhancement += `. Key features: ${features}`;
    }

    if (metadata.rating) {
      enhancement += `. Rating: ${metadata.rating}`;
    }

    // Infer product type from name patterns
    const productType = this.inferProductType(productName);
    if (productType) {
      enhancement += `. Type: ${productType}`;
    }

    return enhancement;
  }

  private enhanceCategoryDescription(
    categoryName: string,
    metadata: Record<string, any>,
  ): string {
    let enhancement = '';

    if (metadata.parentCategory) {
      enhancement += `. Parent category: ${metadata.parentCategory}`;
    }

    if (metadata.subcategories && Array.isArray(metadata.subcategories)) {
      const subcats = metadata.subcategories.slice(0, 3).join(', ');
      enhancement += `. Subcategories: ${subcats}`;
    }

    if (metadata.productCount) {
      enhancement += `. Contains ${metadata.productCount} products`;
    }

    // Add category classification
    const categoryType = this.inferCategoryType(categoryName);
    if (categoryType) {
      enhancement += `. Classification: ${categoryType}`;
    }

    return enhancement;
  }

  private enhanceBrandDescription(
    brandName: string,
    metadata: Record<string, any>,
  ): string {
    let enhancement = '';

    if (metadata.industry) {
      enhancement += `. Industry: ${metadata.industry}`;
    }

    if (metadata.founded) {
      enhancement += `. Founded: ${metadata.founded}`;
    }

    if (metadata.country) {
      enhancement += `. Origin: ${metadata.country}`;
    }

    if (metadata.specialties && Array.isArray(metadata.specialties)) {
      const specialties = metadata.specialties.slice(0, 3).join(', ');
      enhancement += `. Specializes in: ${specialties}`;
    }

    // Infer brand category
    const brandCategory = this.inferBrandCategory(brandName);
    if (brandCategory) {
      enhancement += `. Category: ${brandCategory}`;
    }

    return enhancement;
  }

  private enhanceFeatureDescription(
    featureName: string,
    metadata: Record<string, any>,
  ): string {
    let enhancement = '';

    if (metadata.featureType) {
      enhancement += `. Type: ${metadata.featureType}`;
    }

    if (metadata.benefit) {
      enhancement += `. Benefit: ${metadata.benefit}`;
    }

    if (metadata.technicalSpec) {
      enhancement += `. Specification: ${metadata.technicalSpec}`;
    }

    if (metadata.compatibility && Array.isArray(metadata.compatibility)) {
      const compat = metadata.compatibility.slice(0, 3).join(', ');
      enhancement += `. Compatible with: ${compat}`;
    }

    // Classify feature type
    const featureType = this.inferFeatureType(featureName);
    if (featureType) {
      enhancement += `. Classification: ${featureType}`;
    }

    return enhancement;
  }

  private enhancePriceDescription(
    priceText: string,
    metadata: Record<string, any>,
  ): string {
    let enhancement = '';

    // Extract numeric price if possible
    const priceMatch = priceText.match(/[\d,]+\.?\d*/);
    if (priceMatch) {
      const numericPrice = parseFloat(priceMatch[0].replace(/,/g, ''));

      // Add price range classification
      if (numericPrice < 50) {
        enhancement += '. Range: Budget';
      } else if (numericPrice < 200) {
        enhancement += '. Range: Mid-range';
      } else if (numericPrice < 500) {
        enhancement += '. Range: Premium';
      } else {
        enhancement += '. Range: Luxury';
      }
    }

    if (metadata.currency) {
      enhancement += `. Currency: ${metadata.currency}`;
    }

    if (metadata.priceType) {
      enhancement += `. Type: ${metadata.priceType}`;
    }

    if (metadata.discount) {
      enhancement += `. Discount: ${metadata.discount}`;
    }

    return enhancement;
  }

  // Helper methods for type inference
  private inferProductType(productName: string): string | null {
    const productName_lower = productName.toLowerCase();

    const typePatterns: Record<string, string[]> = {
      Electronics: [
        'phone',
        'laptop',
        'computer',
        'tv',
        'tablet',
        'headphones',
        'speaker',
        'camera',
      ],
      Clothing: [
        'shirt',
        'pants',
        'dress',
        'shoes',
        'jacket',
        'hoodie',
        'jeans',
        'sneakers',
      ],
      'Home & Garden': [
        'furniture',
        'lamp',
        'chair',
        'table',
        'bed',
        'sofa',
        'plant',
        'tool',
      ],
      Books: ['book', 'novel', 'guide', 'manual', 'textbook', 'cookbook'],
      Sports: ['ball', 'equipment', 'gear', 'bike', 'fitness', 'exercise'],
      Beauty: [
        'makeup',
        'skincare',
        'perfume',
        'cosmetics',
        'shampoo',
        'lotion',
      ],
      Food: ['snack', 'beverage', 'coffee', 'tea', 'chocolate', 'organic'],
    };

    for (const [type, patterns] of Object.entries(typePatterns)) {
      if (patterns.some((pattern) => productName_lower.includes(pattern))) {
        return type;
      }
    }

    return null;
  }

  private inferCategoryType(categoryName: string): string | null {
    const categoryName_lower = categoryName.toLowerCase();

    if (
      ['electronics', 'technology', 'gadgets'].some((term) =>
        categoryName_lower.includes(term),
      )
    ) {
      return 'Technology';
    }
    if (
      ['clothing', 'fashion', 'apparel', 'wear'].some((term) =>
        categoryName_lower.includes(term),
      )
    ) {
      return 'Fashion';
    }
    if (
      ['home', 'furniture', 'decor', 'kitchen'].some((term) =>
        categoryName_lower.includes(term),
      )
    ) {
      return 'Home & Living';
    }
    if (
      ['health', 'beauty', 'personal', 'care'].some((term) =>
        categoryName_lower.includes(term),
      )
    ) {
      return 'Health & Beauty';
    }
    if (
      ['sports', 'fitness', 'outdoor', 'recreation'].some((term) =>
        categoryName_lower.includes(term),
      )
    ) {
      return 'Sports & Recreation';
    }

    return null;
  }

  private inferBrandCategory(brandName: string): string | null {
    const brandName_lower = brandName.toLowerCase();

    const techBrands = [
      'apple',
      'samsung',
      'google',
      'microsoft',
      'sony',
      'lg',
      'hp',
      'dell',
    ];
    const fashionBrands = [
      'nike',
      'adidas',
      'zara',
      'h&m',
      'uniqlo',
      'gap',
      'levis',
    ];
    const luxuryBrands = [
      'louis vuitton',
      'gucci',
      'prada',
      'chanel',
      'rolex',
      'tiffany',
    ];

    if (techBrands.some((brand) => brandName_lower.includes(brand))) {
      return 'Technology';
    }
    if (fashionBrands.some((brand) => brandName_lower.includes(brand))) {
      return 'Fashion';
    }
    if (luxuryBrands.some((brand) => brandName_lower.includes(brand))) {
      return 'Luxury';
    }

    return null;
  }

  private inferFeatureType(featureName: string): string | null {
    const featureName_lower = featureName.toLowerCase();

    if (
      ['camera', 'photo', 'video', 'lens'].some((term) =>
        featureName_lower.includes(term),
      )
    ) {
      return 'Camera/Media';
    }
    if (
      ['battery', 'power', 'charging'].some((term) =>
        featureName_lower.includes(term),
      )
    ) {
      return 'Power';
    }
    if (
      ['display', 'screen', 'resolution'].some((term) =>
        featureName_lower.includes(term),
      )
    ) {
      return 'Display';
    }
    if (
      ['storage', 'memory', 'ram', 'ssd'].some((term) =>
        featureName_lower.includes(term),
      )
    ) {
      return 'Storage/Memory';
    }
    if (
      ['wireless', 'bluetooth', 'wifi', 'connectivity'].some((term) =>
        featureName_lower.includes(term),
      )
    ) {
      return 'Connectivity';
    }
    if (
      ['waterproof', 'durable', 'protection'].some((term) =>
        featureName_lower.includes(term),
      )
    ) {
      return 'Protection';
    }

    return null;
  }
}
