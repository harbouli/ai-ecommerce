import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver } from 'neo4j-driver';
import { BaseGraphNode } from '../../domain/knowledge-graph/nodes/base-graph-node';
import { BaseRelationship } from '../../domain/knowledge-graph/relationships/base-relationship';
import { RelationshipType } from '../../domain/knowledge-graph/relationships/relationship-types';

@Injectable()
export class Neo4jGraphService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Neo4jGraphService.name);
  private driver: Driver;
  private readonly uri: string;
  private readonly username: string;
  private readonly password: string;

  constructor(private readonly configService: ConfigService) {
    this.uri = this.configService.getOrThrow<string>('NEO4J_URI');
    this.username = this.configService.getOrThrow<string>('NEO4J_USERNAME');
    this.password = this.configService.getOrThrow<string>('NEO4J_PASSWORD');
  }

  async onModuleInit(): Promise<void> {
    try {
      this.driver = neo4j.driver(
        this.uri,
        neo4j.auth.basic(this.username, this.password),
      );
      await this.verifyConnectivity();
      await this.createConstraints();
      await this.createIndexes();
      this.logger.log('Neo4j connection established successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Neo4j:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver?.close();
    this.logger.log('Neo4j connection closed');
  }

  private async verifyConnectivity(): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run('RETURN 1');
    } finally {
      await session.close();
    }
  }

  private async createConstraints(): Promise<void> {
    const session = this.driver.session();
    try {
      const constraints = [
        'CREATE CONSTRAINT IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (c:Category) REQUIRE c.id IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (f:Feature) REQUIRE f.id IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (cp:CustomerProfile) REQUIRE cp.id IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (b:Brand) REQUIRE b.id IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (t:Tag) REQUIRE t.id IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (o:Order) REQUIRE o.id IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (s:Supplier) REQUIRE s.id IS UNIQUE',
      ];

      for (const constraint of constraints) {
        await session.run(constraint);
      }
      this.logger.log('Constraints created successfully');
    } catch (error) {
      this.logger.error('Failed to create constraints:', error);
    } finally {
      await session.close();
    }
  }

  private async createIndexes(): Promise<void> {
    const session = this.driver.session();
    try {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS FOR (p:Product) ON (p.name)',
        'CREATE INDEX IF NOT EXISTS FOR (p:Product) ON (p.price)',
        'CREATE INDEX IF NOT EXISTS FOR (p:Product) ON (p.isActive)',
        'CREATE INDEX IF NOT EXISTS FOR (c:Category) ON (c.name)',
        'CREATE INDEX IF NOT EXISTS FOR (c:Category) ON (c.slug)',
        'CREATE INDEX IF NOT EXISTS FOR (cp:CustomerProfile) ON (cp.email)',
        'CREATE INDEX IF NOT EXISTS FOR (cp:CustomerProfile) ON (cp.customerSegment)',
        'CREATE INDEX IF NOT EXISTS FOR (b:Brand) ON (b.name)',
        'CREATE INDEX IF NOT EXISTS FOR (o:Order) ON (o.orderNumber)',
        'CREATE INDEX IF NOT EXISTS FOR (o:Order) ON (o.orderDate)',
      ];

      for (const index of indexes) {
        await session.run(index);
      }
      this.logger.log('Indexes created successfully');
    } catch (error) {
      this.logger.error('Failed to create indexes:', error);
    } finally {
      await session.close();
    }
  }

  // Node operations
  async createNode(node: BaseGraphNode): Promise<BaseGraphNode> {
    const session = this.driver.session();
    try {
      const properties = node.toNeo4jProperties();
      const query = `
        CREATE (n:${node.nodeType} $properties)
        RETURN n
      `;

      const result = await session.run(query, { properties });
      const createdNode = result.records[0]?.get('n');

      if (!createdNode) {
        throw new Error(`Failed to create node of type ${node.nodeType}`);
      }

      this.logger.log(`Created node: ${node.nodeType}:${node.id}`);
      return node;
    } catch (error) {
      this.logger.error(
        `Failed to create node: ${node.nodeType}:${node.id}`,
        error,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  async updateNode(node: BaseGraphNode): Promise<BaseGraphNode> {
    const session = this.driver.session();
    try {
      const properties = node.toNeo4jProperties();
      const query = `
        MATCH (n:${node.nodeType} {id: $id})
        SET n = $properties
        RETURN n
      `;

      const result = await session.run(query, { id: node.id, properties });
      const updatedNode = result.records[0]?.get('n');

      if (!updatedNode) {
        throw new Error(`Node not found: ${node.nodeType}:${node.id}`);
      }

      this.logger.log(`Updated node: ${node.nodeType}:${node.id}`);
      return node;
    } catch (error) {
      this.logger.error(
        `Failed to update node: ${node.nodeType}:${node.id}`,
        error,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  async findNodeById(nodeType: string, id: string): Promise<any | null> {
    const session = this.driver.session();
    try {
      const query = `
        MATCH (n:${nodeType} {id: $id})
        RETURN n
      `;

      const result = await session.run(query, { id });
      const node = result.records[0]?.get('n');

      return node ? node.properties : null;
    } catch (error) {
      this.logger.error(`Failed to find node: ${nodeType}:${id}`, error);
      return null;
    } finally {
      await session.close();
    }
  }

  async deleteNode(nodeType: string, id: string): Promise<boolean> {
    const session = this.driver.session();
    try {
      const query = `
        MATCH (n:${nodeType} {id: $id})
        DETACH DELETE n
        RETURN count(n) as deletedCount
      `;

      const result = await session.run(query, { id });
      const deletedCount = result.records[0]?.get('deletedCount').toNumber();

      this.logger.log(`Deleted node: ${nodeType}:${id}`);
      return deletedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to delete node: ${nodeType}:${id}`, error);
      return false;
    } finally {
      await session.close();
    }
  }

  // Relationship operations
  async createRelationship(
    relationship: BaseRelationship,
  ): Promise<BaseRelationship> {
    const session = this.driver.session();
    try {
      const properties = relationship.toNeo4jProperties();
      const query = `
        MATCH (from:${relationship.fromNodeType} {id: $fromId})
        MATCH (to:${relationship.toNodeType} {id: $toId})
        CREATE (from)-[r:${relationship.type} $properties]->(to)
        RETURN r
      `;

      const result = await session.run(query, {
        fromId: relationship.fromNodeId,
        toId: relationship.toNodeId,
        properties,
      });

      const createdRelationship = result.records[0]?.get('r');

      if (!createdRelationship) {
        throw new Error(`Failed to create relationship: ${relationship.type}`);
      }

      this.logger.log(
        `Created relationship: ${relationship.fromNodeType}:${relationship.fromNodeId} -[${relationship.type}]-> ${relationship.toNodeType}:${relationship.toNodeId}`,
      );
      return relationship;
    } catch (error) {
      this.logger.error(
        `Failed to create relationship: ${relationship.type}`,
        error,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  async updateRelationship(
    relationship: BaseRelationship,
  ): Promise<BaseRelationship> {
    const session = this.driver.session();
    try {
      const properties = relationship.toNeo4jProperties();
      const query = `
        MATCH (from:${relationship.fromNodeType} {id: $fromId})-[r:${relationship.type}]->(to:${relationship.toNodeType} {id: $toId})
        SET r = $properties
        RETURN r
      `;

      const result = await session.run(query, {
        fromId: relationship.fromNodeId,
        toId: relationship.toNodeId,
        properties,
      });

      const updatedRelationship = result.records[0]?.get('r');

      if (!updatedRelationship) {
        throw new Error(`Relationship not found: ${relationship.type}`);
      }

      this.logger.log(`Updated relationship: ${relationship.type}`);
      return relationship;
    } catch (error) {
      this.logger.error(
        `Failed to update relationship: ${relationship.type}`,
        error,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  async deleteRelationship(
    fromNodeType: string,
    fromId: string,
    toNodeType: string,
    toId: string,
    relationshipType: RelationshipType,
  ): Promise<boolean> {
    const session = this.driver.session();
    try {
      const query = `
        MATCH (from:${fromNodeType} {id: $fromId})-[r:${relationshipType}]->(to:${toNodeType} {id: $toId})
        DELETE r
        RETURN count(r) as deletedCount
      `;

      const result = await session.run(query, { fromId, toId });
      const deletedCount = result.records[0]?.get('deletedCount').toNumber();

      this.logger.log(
        `Deleted relationship: ${fromNodeType}:${fromId} -[${relationshipType}]-> ${toNodeType}:${toId}`,
      );
      return deletedCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete relationship: ${relationshipType}`,
        error,
      );
      return false;
    } finally {
      await session.close();
    }
  }

  // Graph traversal and queries
  async findConnectedNodes(
    nodeType: string,
    nodeId: string,
    relationshipType?: RelationshipType,
    direction: 'incoming' | 'outgoing' | 'both' = 'both',
    depth: number = 1,
  ): Promise<any[]> {
    const session = this.driver.session();
    try {
      let relationshipClause = '';
      if (relationshipType) {
        relationshipClause = `:${relationshipType}`;
      }

      let directionClause = '';
      switch (direction) {
        case 'incoming':
          directionClause = `<-[r${relationshipClause}]-`;
          break;
        case 'outgoing':
          directionClause = `-[r${relationshipClause}]->`;
          break;
        case 'both':
          directionClause = `-[r${relationshipClause}]-`;
          break;
      }

      const query = `
        MATCH (start:${nodeType} {id: $nodeId})
        MATCH (start)${directionClause}(connected)
        WHERE 1 <= ${depth}
        RETURN connected, r
        ORDER BY r.weight DESC, r.confidence DESC
      `;

      const result = await session.run(query, { nodeId });

      return result.records.map((record) => ({
        node: record.get('connected').properties,
        relationship: record.get('r').properties,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to find connected nodes for ${nodeType}:${nodeId}`,
        error,
      );
      return [];
    } finally {
      await session.close();
    }
  }

  async findShortestPath(
    fromNodeType: string,
    fromId: string,
    toNodeType: string,
    toId: string,
    maxDepth: number = 5,
  ): Promise<any[]> {
    const session = this.driver.session();
    try {
      const query = `
        MATCH (from:${fromNodeType} {id: $fromId}), (to:${toNodeType} {id: $toId})
        MATCH path = shortestPath((from)-[*1..${maxDepth}]-(to))
        RETURN path
      `;

      const result = await session.run(query, { fromId, toId });

      if (result.records.length === 0) {
        return [];
      }

      const path = result.records[0].get('path');
      const nodes = path.segments.map(
        (segment: any) => segment.start.properties,
      );
      nodes.push(path.end.properties);

      return nodes;
    } catch (error) {
      this.logger.error(
        `Failed to find shortest path from ${fromNodeType}:${fromId} to ${toNodeType}:${toId}`,
        error,
      );
      return [];
    } finally {
      await session.close();
    }
  }

  async findSimilarProducts(
    productId: string,
    limit: number = 10,
  ): Promise<any[]> {
    const session = this.driver.session();
    try {
      const query = `
        MATCH (p:Product {id: $productId})
        MATCH (p)-[:BELONGS_TO_CATEGORY]->(c:Category)<-[:BELONGS_TO_CATEGORY]-(similar:Product)
        WHERE p.id <> similar.id AND similar.isActive = true
        WITH similar, count(c) as sharedCategories
        MATCH (p)-[:HAS_FEATURE]->(f:Feature)<-[:HAS_FEATURE]-(similar)
        WITH similar, sharedCategories, count(f) as sharedFeatures
        RETURN similar, 
               (sharedCategories * 0.4 + sharedFeatures * 0.6) as similarityScore
        ORDER BY similarityScore DESC
        LIMIT $limit
      `;

      const result = await session.run(query, { productId, limit });

      return result.records.map((record) => ({
        product: record.get('similar').properties,
        similarityScore: record.get('similarityScore').toNumber(),
      }));
    } catch (error) {
      this.logger.error(
        `Failed to find similar products for ${productId}`,
        error,
      );
      return [];
    } finally {
      await session.close();
    }
  }

  async getCustomerRecommendations(
    customerId: string,
    limit: number = 10,
  ): Promise<any[]> {
    const session = this.driver.session();
    try {
      const query = `
        MATCH (customer:CustomerProfile {id: $customerId})
        MATCH (customer)-[:PURCHASED]->(purchased:Product)
        MATCH (purchased)-[:BELONGS_TO_CATEGORY]->(category:Category)
        MATCH (category)<-[:BELONGS_TO_CATEGORY]-(recommended:Product)
        WHERE NOT (customer)-[:PURCHASED]->(recommended)
        AND recommended.isActive = true
        WITH recommended, category, count(*) as categoryScore
        MATCH (purchased)-[:HAS_FEATURE]->(feature:Feature)<-[:HAS_FEATURE]-(recommended)
        WITH recommended, categoryScore, count(feature) as featureScore
        RETURN recommended, 
               (categoryScore * 0.3 + featureScore * 0.7) as recommendationScore
        ORDER BY recommendationScore DESC
        LIMIT $limit
      `;

      const result = await session.run(query, { customerId, limit });

      return result.records.map((record) => ({
        product: record.get('recommended').properties,
        recommendationScore: record.get('recommendationScore').toNumber(),
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get recommendations for customer ${customerId}`,
        error,
      );
      return [];
    } finally {
      await session.close();
    }
  }

  async findFrequentlyBoughtTogether(
    productId: string,
    limit: number = 5,
  ): Promise<any[]> {
    const session = this.driver.session();
    try {
      const query = `
        MATCH (p:Product {id: $productId})
        MATCH (customer:CustomerProfile)-[:PURCHASED]->(p)
        MATCH (customer)-[:PURCHASED]->(other:Product)
        WHERE p.id <> other.id AND other.isActive = true
        WITH other, count(customer) as coOccurrence
        RETURN other, coOccurrence
        ORDER BY coOccurrence DESC
        LIMIT $limit
      `;

      const result = await session.run(query, { productId, limit });

      return result.records.map((record) => ({
        product: record.get('other').properties,
        coOccurrence: record.get('coOccurrence').toNumber(),
      }));
    } catch (error) {
      this.logger.error(
        `Failed to find frequently bought together for ${productId}`,
        error,
      );
      return [];
    } finally {
      await session.close();
    }
  }

  async getCustomerInsights(customerId: string): Promise<any> {
    const session = this.driver.session();
    try {
      const query = `
        MATCH (customer:CustomerProfile {id: $customerId})
        OPTIONAL MATCH (customer)-[:PURCHASED]->(products:Product)
        OPTIONAL MATCH (customer)-[:PREFERS_CATEGORY]->(preferredCategories:Category)
        OPTIONAL MATCH (customer)-[:PREFERS_BRAND]->(preferredBrands:Brand)
        OPTIONAL MATCH (products)-[:BELONGS_TO_CATEGORY]->(categories:Category)
        OPTIONAL MATCH (products)-[:MANUFACTURED_BY]->(brands:Brand)
        RETURN customer,
               collect(DISTINCT products) as purchasedProducts,
               collect(DISTINCT preferredCategories) as preferredCategories,
               collect(DISTINCT preferredBrands) as preferredBrands,
               collect(DISTINCT categories) as purchasedCategories,
               collect(DISTINCT brands) as purchasedBrands
      `;

      const result = await session.run(query, { customerId });

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      return {
        customer: record.get('customer').properties,
        purchasedProducts: record
          .get('purchasedProducts')
          .map((p: any) => p.properties),
        preferredCategories: record
          .get('preferredCategories')
          .map((c: any) => c.properties),
        preferredBrands: record
          .get('preferredBrands')
          .map((b: any) => b.properties),
        purchasedCategories: record
          .get('purchasedCategories')
          .map((c: any) => c.properties),
        purchasedBrands: record
          .get('purchasedBrands')
          .map((b: any) => b.properties),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get customer insights for ${customerId}`,
        error,
      );
      return null;
    } finally {
      await session.close();
    }
  }

  async runCypherQuery(
    query: string,
    parameters: Record<string, any> = {},
  ): Promise<any[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(query, parameters);
      return result.records.map((record) => record.toObject());
    } catch (error) {
      this.logger.error('Failed to run Cypher query', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const session = this.driver.session();
      const result = await session.run('RETURN 1 as health');
      await session.close();
      return result.records.length > 0;
    } catch (error) {
      this.logger.error('Neo4j health check failed', error);
      return false;
    }
  }

  async getDatabaseStats(): Promise<any> {
    const session = this.driver.session();
    try {
      const query = `
        CALL db.stats.retrieve('GRAPH COUNTS') YIELD section, data
        RETURN section, data
      `;

      const result = await session.run(query);
      const stats: any = {};

      result.records.forEach((record) => {
        const section = record.get('section');
        const data = record.get('data');
        stats[section] = data;
      });

      return stats;
    } catch (error) {
      this.logger.error('Failed to get database stats', error);
      return {};
    } finally {
      await session.close();
    }
  }
}
