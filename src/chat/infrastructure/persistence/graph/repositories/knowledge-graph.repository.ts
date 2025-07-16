import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../../../../../database/neo4j/neo4j.service';
import {
  KnowledgeEntity,
  KnowledgeRelationship,
} from '../../../../domain/knowledge';

export interface CustomerPurchasePattern {
  customerId: string;
  productId: string;
  categoryId: string;
  purchaseDate: Date;
  amount: number;
  frequency: number;
}

export interface ProductRecommendationPath {
  fromProductId: string;
  toProductId: string;
  reason: string;
  strength: number;
  conversionRate: number;
}

@Injectable()
export class KnowledgeGraphRepository {
  private readonly logger = new Logger(KnowledgeGraphRepository.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  async createKnowledgeEntity(entity: KnowledgeEntity): Promise<void> {
    const query = `
      CREATE (e:KnowledgeEntity {
        id: $id,
        type: $type,
        name: $name,
        description: $description,
        properties: $properties,
        vector: $vector,
        createdAt: datetime($createdAt),
        updatedAt: datetime($updatedAt)
      })
      RETURN e
    `;

    const parameters = {
      id: entity.id,
      type: entity.type,
      name: entity.name,
      description: entity.description,
      properties: entity.properties || {},
      vector: entity.vector || [],
      createdAt: entity.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: entity.updatedAt?.toISOString() || new Date().toISOString(),
    };

    try {
      await this.neo4jService.write(query, parameters);
      this.logger.log(`Created knowledge entity: ${entity.id}`);
    } catch (error) {
      this.logger.error('Error creating knowledge entity:', error);
      throw error;
    }
  }

  async createKnowledgeRelationship(
    relationship: KnowledgeRelationship,
  ): Promise<void> {
    const query = `
      MATCH (from:KnowledgeEntity {id: $fromEntityId})
      MATCH (to:KnowledgeEntity {id: $toEntityId})
      CREATE (from)-[r:${relationship.type} {
        id: $id,
        weight: $weight,
        properties: $properties,
        createdAt: datetime($createdAt)
      }]->(to)
      RETURN r
    `;

    const parameters = {
      id: relationship.id,
      fromEntityId: relationship.fromEntityId,
      toEntityId: relationship.toEntityId,
      weight: relationship.weight,
      properties: relationship.properties || {},
      createdAt:
        relationship.createdAt?.toISOString() || new Date().toISOString(),
    };

    try {
      await this.neo4jService.write(query, parameters);
      this.logger.log(
        `Created relationship: ${relationship.fromEntityId} -> ${relationship.toEntityId}`,
      );
    } catch (error) {
      this.logger.error('Error creating knowledge relationship:', error);
      throw error;
    }
  }

  // ===== COMMERCE-SPECIFIC METHODS =====

  /**
   * Creates customer purchase behavior nodes and relationships
   */
  async createCustomerPurchasePattern(
    pattern: CustomerPurchasePattern,
  ): Promise<void> {
    const query = `
      MERGE (c:Customer {id: $customerId})
      MERGE (p:Product {id: $productId})
      MERGE (cat:Category {id: $categoryId})
      
      // Create purchase relationship
      CREATE (c)-[purchase:PURCHASED {
        date: datetime($purchaseDate),
        amount: $amount,
        frequency: $frequency,
        createdAt: datetime()
      }]->(p)
      
      // Connect product to category
      MERGE (p)-[:BELONGS_TO]->(cat)
      
      // Track customer category affinity
      MERGE (c)-[affinity:INTERESTED_IN]->(cat)
      ON CREATE SET affinity.strength = 1, affinity.purchases = 1
      ON MATCH SET affinity.strength = affinity.strength + 1, 
                   affinity.purchases = affinity.purchases + 1
      
      RETURN purchase
    `;

    try {
      await this.neo4jService.write(query, {
        customerId: pattern.customerId,
        productId: pattern.productId,
        categoryId: pattern.categoryId,
        purchaseDate: pattern.purchaseDate.toISOString(),
        amount: pattern.amount,
        frequency: pattern.frequency,
      });

      this.logger.log(
        `Created purchase pattern: ${pattern.customerId} -> ${pattern.productId}`,
      );
    } catch (error) {
      this.logger.error('Error creating customer purchase pattern:', error);
      throw error;
    }
  }

  /**
   * Finds products frequently bought together for cross-selling
   */
  async findFrequentlyBoughtTogether(
    productId: string,
    limit: number = 5,
  ): Promise<any[]> {
    const query = `
      MATCH (p1:Product {id: $productId})<-[:PURCHASED]-(c:Customer)-[:PURCHASED]->(p2:Product)
      WHERE p1.id <> p2.id
      WITH p2, COUNT(c) as coOccurrence
      ORDER BY coOccurrence DESC
      LIMIT $limit
      
      MATCH (p2)<-[purchase:PURCHASED]-(customer:Customer)
      WITH p2, coOccurrence, 
           AVG(purchase.amount) as avgPurchaseAmount,
           COUNT(DISTINCT customer) as totalCustomers
      
      RETURN p2.id as productId, p2.name as productName,
             coOccurrence, avgPurchaseAmount, totalCustomers,
             (coOccurrence * 1.0 / totalCustomers) as affinity
      ORDER BY affinity DESC, coOccurrence DESC
    `;

    try {
      const result = await this.neo4jService.read(query, { productId, limit });
      return result.records.map((record) => ({
        productId: record.get('productId'),
        productName: record.get('productName'),
        coOccurrence: record.get('coOccurrence').toNumber(),
        avgPurchaseAmount: record.get('avgPurchaseAmount'),
        totalCustomers: record.get('totalCustomers').toNumber(),
        affinity: record.get('affinity'),
      }));
    } catch (error) {
      this.logger.error('Error finding frequently bought together:', error);
      return [];
    }
  }

  /**
   * Gets personalized product recommendations based on customer behavior
   */
  async getPersonalizedRecommendations(
    customerId: string,
    limit: number = 10,
  ): Promise<any[]> {
    const query = `
      // Find customer's purchase history and preferences
      MATCH (c:Customer {id: $customerId})-[:PURCHASED]->(purchased:Product)-[:BELONGS_TO]->(cat:Category)
      WITH c, COLLECT(DISTINCT cat.id) as preferredCategories, 
           COLLECT(DISTINCT purchased.id) as purchasedProducts
      
      // Find products in preferred categories not yet purchased
      MATCH (rec:Product)-[:BELONGS_TO]->(prefCat:Category)
      WHERE prefCat.id IN preferredCategories 
        AND NOT rec.id IN purchasedProducts
      
      // Calculate recommendation score based on category affinity and product popularity
      MATCH (c)-[affinity:INTERESTED_IN]->(prefCat)
      MATCH (rec)<-[otherPurchases:PURCHASED]-(otherCustomers:Customer)
      
      WITH rec, prefCat, affinity.strength as categoryAffinity,
           COUNT(otherPurchases) as popularity,
           AVG(otherPurchases.amount) as avgPrice
      
      // Also consider customers with similar purchase patterns
      MATCH (c)-[:PURCHASED]->(commonProduct:Product)<-[:PURCHASED]-(similar:Customer)
      MATCH (similar)-[:PURCHASED]->(rec)
      WITH rec, categoryAffinity, popularity, avgPrice,
           COUNT(DISTINCT similar) as similarCustomers
      
      // Calculate final recommendation score
      WITH rec, categoryAffinity, popularity, avgPrice, similarCustomers,
           (categoryAffinity * 0.4 + popularity * 0.3 + similarCustomers * 0.3) as score
      
      RETURN rec.id as productId, rec.name as productName,
             score, categoryAffinity, popularity, similarCustomers, avgPrice
      ORDER BY score DESC
      LIMIT $limit
    `;

    try {
      const result = await this.neo4jService.read(query, { customerId, limit });
      return result.records.map((record) => ({
        productId: record.get('productId'),
        productName: record.get('productName'),
        score: record.get('score'),
        categoryAffinity: record.get('categoryAffinity'),
        popularity: record.get('popularity').toNumber(),
        similarCustomers: record.get('similarCustomers').toNumber(),
        avgPrice: record.get('avgPrice'),
      }));
    } catch (error) {
      this.logger.error('Error getting personalized recommendations:', error);
      return [];
    }
  }

  /**
   * Creates product-to-product recommendation relationships
   */
  async createProductRecommendationPath(
    fromProductId: string,
    toProductId: string,
    reason: string,
    strength: number = 1.0,
    conversionRate: number = 0.0,
  ): Promise<void> {
    const query = `
      MATCH (from:Product {id: $fromProductId})
      MATCH (to:Product {id: $toProductId})
      MERGE (from)-[r:RECOMMENDS]->(to)
      ON CREATE SET r.reason = $reason, 
                    r.strength = $strength,
                    r.conversionRate = $conversionRate,
                    r.timesRecommended = 1,
                    r.timesAccepted = 0,
                    r.createdAt = datetime()
      ON MATCH SET r.strength = (r.strength + $strength) / 2,
                   r.timesRecommended = r.timesRecommended + 1,
                   r.updatedAt = datetime()
      RETURN r
    `;

    try {
      await this.neo4jService.write(query, {
        fromProductId,
        toProductId,
        reason,
        strength,
        conversionRate,
      });

      this.logger.log(
        `Created recommendation path: ${fromProductId} -> ${toProductId}`,
      );
    } catch (error) {
      this.logger.error('Error creating recommendation path:', error);
      throw error;
    }
  }

  /**
   * Updates recommendation success when a customer follows a recommendation
   */
  async updateRecommendationSuccess(
    fromProductId: string,
    toProductId: string,
  ): Promise<void> {
    const query = `
      MATCH (from:Product {id: $fromProductId})-[r:RECOMMENDS]->(to:Product {id: $toProductId})
      SET r.timesAccepted = r.timesAccepted + 1,
          r.conversionRate = (r.timesAccepted * 1.0) / r.timesRecommended,
          r.updatedAt = datetime()
      RETURN r.conversionRate as newConversionRate
    `;

    try {
      const result = await this.neo4jService.write(query, {
        fromProductId,
        toProductId,
      });
      const conversionRate = result.records[0]?.get('newConversionRate') || 0;
      this.logger.log(
        `Updated recommendation success: ${fromProductId} -> ${toProductId}, conversion: ${conversionRate}`,
      );
    } catch (error) {
      this.logger.error('Error updating recommendation success:', error);
    }
  }

  /**
   * Finds trending products based on recent purchase patterns
   */
  async findTrendingProducts(
    timeframe: 'day' | 'week' | 'month' = 'week',
    limit: number = 10,
  ): Promise<any[]> {
    const timeframeDays =
      timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;

    const query = `
      MATCH (p:Product)<-[purchase:PURCHASED]-(c:Customer)
      WHERE purchase.date >= datetime() - duration({days: $timeframeDays})
      
      WITH p, COUNT(purchase) as recentPurchases,
           AVG(purchase.amount) as avgAmount,
           COUNT(DISTINCT c) as uniqueCustomers
      
      // Calculate trend score based on purchase velocity and customer reach
      WITH p, recentPurchases, avgAmount, uniqueCustomers,
           (recentPurchases * uniqueCustomers * avgAmount) as trendScore
      
      RETURN p.id as productId, p.name as productName,
             recentPurchases, uniqueCustomers, avgAmount, trendScore
      ORDER BY trendScore DESC
      LIMIT $limit
    `;

    try {
      const result = await this.neo4jService.read(query, {
        timeframeDays,
        limit,
      });
      return result.records.map((record) => ({
        productId: record.get('productId'),
        productName: record.get('productName'),
        recentPurchases: record.get('recentPurchases').toNumber(),
        uniqueCustomers: record.get('uniqueCustomers').toNumber(),
        avgAmount: record.get('avgAmount'),
        trendScore: record.get('trendScore'),
      }));
    } catch (error) {
      this.logger.error('Error finding trending products:', error);
      return [];
    }
  }

  /**
   * Finds customers similar to a given customer for collaborative filtering
   */
  async findSimilarCustomers(
    customerId: string,
    limit: number = 10,
  ): Promise<any[]> {
    const query = `
      MATCH (c1:Customer {id: $customerId})-[:PURCHASED]->(p:Product)<-[:PURCHASED]-(c2:Customer)
      WHERE c1.id <> c2.id
      
      WITH c1, c2, COUNT(p) as commonProducts
      
      // Get total products purchased by each customer
      MATCH (c1)-[:PURCHASED]->(p1:Product)
      WITH c1, c2, commonProducts, COUNT(p1) as c1TotalProducts
      
      MATCH (c2)-[:PURCHASED]->(p2:Product)  
      WITH c1, c2, commonProducts, c1TotalProducts, COUNT(p2) as c2TotalProducts
      
      // Calculate Jaccard similarity
      WITH c1, c2, commonProducts, c1TotalProducts, c2TotalProducts,
           (commonProducts * 1.0) / (c1TotalProducts + c2TotalProducts - commonProducts) as similarity
      
      WHERE similarity > 0.1
      RETURN c2.id as customerId, similarity, commonProducts
      ORDER BY similarity DESC
      LIMIT $limit
    `;

    try {
      const result = await this.neo4jService.read(query, { customerId, limit });
      return result.records.map((record) => ({
        customerId: record.get('customerId'),
        similarity: record.get('similarity'),
        commonProducts: record.get('commonProducts').toNumber(),
      }));
    } catch (error) {
      this.logger.error('Error finding similar customers:', error);
      return [];
    }
  }

  /**
   * Tracks customer objections and successful responses for sales optimization
   */
  async trackCustomerObjection(
    customerId: string,
    productId: string,
    objection: string,
    response: string,
    successful: boolean,
  ): Promise<void> {
    const query = `
      MATCH (c:Customer {id: $customerId})
      MATCH (p:Product {id: $productId})
      
      CREATE (c)-[obj:HAD_OBJECTION {
        objection: $objection,
        response: $response,
        successful: $successful,
        timestamp: datetime()
      }]->(p)
      
      // Update objection statistics
      MERGE (p)-[stat:OBJECTION_STATS {type: $objection}]->(os:ObjectionSummary {type: $objection})
      ON CREATE SET stat.total = 1, 
                    stat.successful = CASE WHEN $successful THEN 1 ELSE 0 END
      ON MATCH SET stat.total = stat.total + 1,
                   stat.successful = stat.successful + CASE WHEN $successful THEN 1 ELSE 0 END
      
      RETURN obj
    `;

    try {
      await this.neo4jService.write(query, {
        customerId,
        productId,
        objection,
        response,
        successful,
      });

      this.logger.log(
        `Tracked objection: ${objection} for product ${productId}`,
      );
    } catch (error) {
      this.logger.error('Error tracking customer objection:', error);
    }
  }

  /**
   * Gets successful objection handling strategies for a product
   */
  async getSuccessfulObjectionResponses(
    productId: string,
    objectionType?: string,
  ): Promise<any[]> {
    const objectionFilter = objectionType
      ? 'AND obj.objection = $objectionType'
      : '';

    const query = `
      MATCH (p:Product {id: $productId})<-[obj:HAD_OBJECTION]-(c:Customer)
      WHERE obj.successful = true ${objectionFilter}
      
      WITH obj.objection as objection, obj.response as response, 
           COUNT(*) as successCount
      
      RETURN objection, response, successCount
      ORDER BY successCount DESC, objection
    `;

    try {
      const params: any = { productId };
      if (objectionType) params.objectionType = objectionType;

      const result = await this.neo4jService.read(query, params);
      return result.records.map((record) => ({
        objection: record.get('objection'),
        response: record.get('response'),
        successCount: record.get('successCount').toNumber(),
      }));
    } catch (error) {
      this.logger.error('Error getting successful objection responses:', error);
      return [];
    }
  }

  /**
   * Creates customer journey tracking
   */
  async trackCustomerJourneyStep(
    customerId: string,
    step: string,
    productId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const query = `
      MATCH (c:Customer {id: $customerId})
      CREATE (c)-[journey:JOURNEY_STEP {
        step: $step,
        productId: $productId,
        metadata: $metadata,
        timestamp: datetime()
      }]->(js:JourneyStep {step: $step})
      
      RETURN journey
    `;

    try {
      await this.neo4jService.write(query, {
        customerId,
        step,
        productId: productId || null,
        metadata: metadata || {},
      });

      this.logger.log(
        `Tracked journey step: ${step} for customer ${customerId}`,
      );
    } catch (error) {
      this.logger.error('Error tracking customer journey step:', error);
    }
  }

  /**
   * Gets customer journey analysis for conversion optimization
   */
  async analyzeCustomerJourney(customerId: string): Promise<any> {
    const query = `
      MATCH (c:Customer {id: $customerId})-[journey:JOURNEY_STEP]->(step:JourneyStep)
      
      WITH journey, step
      ORDER BY journey.timestamp
      
      WITH COLLECT({
        step: step.step,
        productId: journey.productId,
        metadata: journey.metadata,
        timestamp: journey.timestamp
      }) as journeySteps
      
      // Analyze conversion funnel
      WITH journeySteps,
           SIZE([s IN journeySteps WHERE s.step = 'BROWSING']) as browsingSteps,
           SIZE([s IN journeySteps WHERE s.step = 'PRODUCT_VIEW']) as productViews,
           SIZE([s IN journeySteps WHERE s.step = 'CART_ADD']) as cartAdds,
           SIZE([s IN journeySteps WHERE s.step = 'PURCHASE']) as purchases
      
      RETURN journeySteps, browsingSteps, productViews, cartAdds, purchases,
             CASE WHEN productViews > 0 THEN (cartAdds * 1.0 / productViews) ELSE 0 END as viewToCartRate,
             CASE WHEN cartAdds > 0 THEN (purchases * 1.0 / cartAdds) ELSE 0 END as cartToPurchaseRate
    `;

    try {
      const result = await this.neo4jService.read(query, { customerId });
      if (result.records.length === 0) return null;

      const record = result.records[0];
      return {
        journeySteps: record.get('journeySteps'),
        browsingSteps: record.get('browsingSteps').toNumber(),
        productViews: record.get('productViews').toNumber(),
        cartAdds: record.get('cartAdds').toNumber(),
        purchases: record.get('purchases').toNumber(),
        viewToCartRate: record.get('viewToCartRate'),
        cartToPurchaseRate: record.get('cartToPurchaseRate'),
      };
    } catch (error) {
      this.logger.error('Error analyzing customer journey:', error);
      return null;
    }
  }

  // ===== ENHANCED KNOWLEDGE GRAPH METHODS =====

  async findRelatedEntities(
    entityId: string,
    hops: number = 2,
  ): Promise<KnowledgeEntity[]> {
    const query = `
      MATCH (start:KnowledgeEntity {id: $entityId})
      MATCH path = (start)-[*1..${hops}]-(related:KnowledgeEntity)
      WHERE related.id <> $entityId
      WITH related, MIN(LENGTH(path)) as distance
      ORDER BY distance ASC, related.name
      RETURN DISTINCT related
    `;

    try {
      const result = await this.neo4jService.read(query, { entityId });
      return result.records.map((record) =>
        this.mapToKnowledgeEntity(record.get('related')),
      );
    } catch (error) {
      this.logger.error('Error finding related entities:', error);
      return [];
    }
  }

  async findEntityRelationships(
    entityId: string,
  ): Promise<KnowledgeRelationship[]> {
    const query = `
      MATCH (e:KnowledgeEntity {id: $entityId})
      MATCH (e)-[r]-(related:KnowledgeEntity)
      RETURN r, startNode(r) as fromNode, endNode(r) as toNode
    `;

    try {
      const result = await this.neo4jService.read(query, { entityId });
      return result.records.map((record) => {
        const relationship = record.get('r');
        const fromNode = record.get('fromNode');
        const toNode = record.get('toNode');

        return {
          id: relationship.properties.id,
          fromEntityId: fromNode.properties.id,
          toEntityId: toNode.properties.id,
          type: relationship.type,
          weight: relationship.properties.weight,
          properties: relationship.properties.properties || {},
          createdAt: new Date(relationship.properties.createdAt),
        };
      });
    } catch (error) {
      this.logger.error('Error finding entity relationships:', error);
      return [];
    }
  }

  async findEntitiesByType(type: string): Promise<KnowledgeEntity[]> {
    const query = `
      MATCH (e:KnowledgeEntity {type: $type})
      RETURN e
      ORDER BY e.name
    `;

    try {
      const result = await this.neo4jService.read(query, { type });
      return result.records.map((record) =>
        this.mapToKnowledgeEntity(record.get('e')),
      );
    } catch (error) {
      this.logger.error('Error finding entities by type:', error);
      return [];
    }
  }

  async updateEntityProperties(
    entityId: string,
    properties: Record<string, any>,
  ): Promise<void> {
    const query = `
      MATCH (e:KnowledgeEntity {id: $entityId})
      SET e.properties = $properties,
          e.updatedAt = datetime()
      RETURN e
    `;

    try {
      await this.neo4jService.write(query, { entityId, properties });
      this.logger.log(`Updated entity properties: ${entityId}`);
    } catch (error) {
      this.logger.error('Error updating entity properties:', error);
      throw error;
    }
  }

  async deleteEntity(entityId: string): Promise<void> {
    const query = `
      MATCH (e:KnowledgeEntity {id: $entityId})
      DETACH DELETE e
      RETURN count(e) as deletedCount
    `;

    try {
      const result = await this.neo4jService.write(query, { entityId });
      const deletedCount =
        result.records[0]?.get('deletedCount').toNumber() || 0;

      if (deletedCount > 0) {
        this.logger.log(`Deleted entity: ${entityId}`);
      } else {
        this.logger.warn(`Entity not found: ${entityId}`);
      }
    } catch (error) {
      this.logger.error('Error deleting entity:', error);
      throw error;
    }
  }

  // ===== UTILITY METHODS =====

  private mapToKnowledgeEntity(node: any): KnowledgeEntity {
    return {
      id: node.properties.id,
      type: node.properties.type,
      name: node.properties.name,
      description: node.properties.description,
      properties: node.properties.properties || {},
      vector: node.properties.vector || [],
      createdAt: new Date(node.properties.createdAt),
      updatedAt: new Date(node.properties.updatedAt),
    };
  }

  // ===== BULK OPERATIONS =====

  async createEntitiesBatch(entities: KnowledgeEntity[]): Promise<void> {
    const query = `
      UNWIND $entities as entityData
      CREATE (e:KnowledgeEntity {
        id: entityData.id,
        type: entityData.type,
        name: entityData.name,
        description: entityData.description,
        properties: entityData.properties,
        vector: entityData.vector,
        createdAt: datetime(entityData.createdAt),
        updatedAt: datetime(entityData.updatedAt)
      })
    `;

    const parameters = {
      entities: entities.map((entity) => ({
        id: entity.id,
        type: entity.type,
        name: entity.name,
        description: entity.description,
        properties: entity.properties || {},
        vector: entity.vector || [],
        createdAt: entity.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: entity.updatedAt?.toISOString() || new Date().toISOString(),
      })),
    };

    try {
      await this.neo4jService.write(query, parameters);
      this.logger.log(`Created ${entities.length} entities in batch`);
    } catch (error) {
      this.logger.error('Error creating entities batch:', error);
      throw error;
    }
  }

  async createRelationshipsBatch(
    relationships: KnowledgeRelationship[],
  ): Promise<void> {
    // Use basic batch creation since we can't assume APOC is available
    for (const relationship of relationships) {
      await this.createKnowledgeRelationship(relationship);
    }

    this.logger.log(`Created ${relationships.length} relationships in batch`);
  }
}
