import { Injectable } from '@nestjs/common';
import { Neo4jGraphService } from '../../services/neo4j-graph.service';
import { KnowledgeGraphRepository } from '../knowledge-graph.repository';
import { BaseGraphNode } from '../../../domain/knowledge-graph/nodes/base-graph-node';
import { BaseRelationship } from '../../../domain/knowledge-graph/relationships/base-relationship';
import { RelationshipType } from '../../../domain/knowledge-graph/relationships/relationship-types';

@Injectable()
export class Neo4jKnowledgeGraphRepository implements KnowledgeGraphRepository {
  constructor(private readonly neo4jService: Neo4jGraphService) {}

  async createNode(node: BaseGraphNode): Promise<BaseGraphNode> {
    return this.neo4jService.createNode(node);
  }

  async updateNode(node: BaseGraphNode): Promise<BaseGraphNode> {
    return this.neo4jService.updateNode(node);
  }

  async findNodeById(nodeType: string, id: string): Promise<any | null> {
    return this.neo4jService.findNodeById(nodeType, id);
  }

  async findNodesByType(
    nodeType: string,
    filters: Record<string, any> = {},
  ): Promise<any[]> {
    const filterClauses = Object.entries(filters)
      .map(([key]) => `n.${key} = $${key}`)
      .join(' AND ');

    const whereClause = filterClauses ? `WHERE ${filterClauses}` : '';

    const query = `
      MATCH (n:${nodeType})
      ${whereClause}
      RETURN n
      ORDER BY n.createdAt DESC
    `;

    const result = await this.neo4jService.runCypherQuery(query, filters);
    return result.map((record) => record.n);
  }

  async deleteNode(nodeType: string, id: string): Promise<boolean> {
    return this.neo4jService.deleteNode(nodeType, id);
  }

  async createRelationship(
    relationship: BaseRelationship,
  ): Promise<BaseRelationship> {
    return this.neo4jService.createRelationship(relationship);
  }

  async updateRelationship(
    relationship: BaseRelationship,
  ): Promise<BaseRelationship> {
    return this.neo4jService.updateRelationship(relationship);
  }

  async deleteRelationship(
    fromNodeType: string,
    fromId: string,
    toNodeType: string,
    toId: string,
    relationshipType: RelationshipType,
  ): Promise<boolean> {
    return this.neo4jService.deleteRelationship(
      fromNodeType,
      fromId,
      toNodeType,
      toId,
      relationshipType,
    );
  }

  async findRelationships(
    nodeType: string,
    nodeId: string,
    relationshipType?: RelationshipType,
  ): Promise<any[]> {
    return this.neo4jService.findConnectedNodes(
      nodeType,
      nodeId,
      relationshipType,
    );
  }

  async findConnectedNodes(
    nodeType: string,
    nodeId: string,
    relationshipType?: RelationshipType,
    direction: 'incoming' | 'outgoing' | 'both' = 'both',
    depth: number = 1,
  ): Promise<any[]> {
    return this.neo4jService.findConnectedNodes(
      nodeType,
      nodeId,
      relationshipType,
      direction,
      depth,
    );
  }

  async findShortestPath(
    fromNodeType: string,
    fromId: string,
    toNodeType: string,
    toId: string,
    maxDepth: number = 5,
  ): Promise<any[]> {
    return this.neo4jService.findShortestPath(
      fromNodeType,
      fromId,
      toNodeType,
      toId,
      maxDepth,
    );
  }

  async findSimilarProducts(
    productId: string,
    limit: number = 10,
  ): Promise<any[]> {
    return this.neo4jService.findSimilarProducts(productId, limit);
  }

  async getCustomerRecommendations(
    customerId: string,
    limit: number = 10,
  ): Promise<any[]> {
    return this.neo4jService.getCustomerRecommendations(customerId, limit);
  }

  async findFrequentlyBoughtTogether(
    productId: string,
    limit: number = 5,
  ): Promise<any[]> {
    return this.neo4jService.findFrequentlyBoughtTogether(productId, limit);
  }

  async getCustomerInsights(customerId: string): Promise<any> {
    return this.neo4jService.getCustomerInsights(customerId);
  }

  async getProductInsights(productId: string): Promise<any> {
    const query = `
      MATCH (p:Product {id: $productId})
      OPTIONAL MATCH (p)-[:BELONGS_TO_CATEGORY]->(categories:Category)
      OPTIONAL MATCH (p)-[:HAS_FEATURE]->(features:Feature)
      OPTIONAL MATCH (p)-[:MANUFACTURED_BY]->(brand:Brand)
      OPTIONAL MATCH (p)-[:SUPPLIED_BY]->(supplier:Supplier)
      OPTIONAL MATCH (p)-[:TAGGED_WITH]->(tags:Tag)
      OPTIONAL MATCH (customers:CustomerProfile)-[:PURCHASED]->(p)
      OPTIONAL MATCH (p)-[:SIMILAR_TO]->(similar:Product)
      OPTIONAL MATCH (p)-[:FREQUENTLY_BOUGHT_WITH]->(related:Product)
      RETURN p,
             collect(DISTINCT categories) as categories,
             collect(DISTINCT features) as features,
             brand,
             supplier,
             collect(DISTINCT tags) as tags,
             collect(DISTINCT customers) as customers,
             collect(DISTINCT similar) as similarProducts,
             collect(DISTINCT related) as relatedProducts
    `;

    const result = await this.neo4jService.runCypherQuery(query, { productId });

    if (result.length === 0) {
      return null;
    }

    const record = result[0];
    return {
      product: record.p,
      categories: record.categories,
      features: record.features,
      brand: record.brand,
      supplier: record.supplier,
      tags: record.tags,
      customers: record.customers,
      similarProducts: record.similarProducts,
      relatedProducts: record.relatedProducts,
    };
  }

  async getCategoryInsights(categoryId: string): Promise<any> {
    const query = `
      MATCH (c:Category {id: $categoryId})
      OPTIONAL MATCH (c)<-[:BELONGS_TO_CATEGORY]-(products:Product)
      OPTIONAL MATCH (c)<-[:PARENT_CATEGORY]-(children:Category)
      OPTIONAL MATCH (c)-[:PARENT_CATEGORY]->(parent:Category)
      OPTIONAL MATCH (c)-[:RELATED_CATEGORY]-(related:Category)
      OPTIONAL MATCH (customers:CustomerProfile)-[:PREFERS_CATEGORY]->(c)
      OPTIONAL MATCH (products)-[:HAS_FEATURE]->(features:Feature)
      RETURN c,
             collect(DISTINCT products) as products,
             collect(DISTINCT children) as childCategories,
             parent,
             collect(DISTINCT related) as relatedCategories,
             collect(DISTINCT customers) as customers,
             collect(DISTINCT features) as commonFeatures
    `;

    const result = await this.neo4jService.runCypherQuery(query, {
      categoryId,
    });

    if (result.length === 0) {
      return null;
    }

    const record = result[0];
    return {
      category: record.c,
      products: record.products,
      childCategories: record.childCategories,
      parentCategory: record.parent,
      relatedCategories: record.relatedCategories,
      customers: record.customers,
      commonFeatures: record.commonFeatures,
    };
  }

  async runCypherQuery(
    query: string,
    parameters: Record<string, any> = {},
  ): Promise<any[]> {
    return this.neo4jService.runCypherQuery(query, parameters);
  }

  async healthCheck(): Promise<boolean> {
    return this.neo4jService.healthCheck();
  }

  async getDatabaseStats(): Promise<any> {
    return this.neo4jService.getDatabaseStats();
  }
}
