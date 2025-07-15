import { BaseGraphNode } from '../../domain/knowledge-graph/nodes/base-graph-node';
import { BaseRelationship } from '../../domain/knowledge-graph/relationships/base-relationship';
import { RelationshipType } from '../../domain/knowledge-graph/relationships/relationship-types';

export abstract class KnowledgeGraphRepository {
  // Node operations
  abstract createNode(node: BaseGraphNode): Promise<BaseGraphNode>;
  abstract updateNode(node: BaseGraphNode): Promise<BaseGraphNode>;
  abstract findNodeById(nodeType: string, id: string): Promise<any | null>;
  abstract findNodesByType(
    nodeType: string,
    filters?: Record<string, any>,
  ): Promise<any[]>;
  abstract deleteNode(nodeType: string, id: string): Promise<boolean>;

  // Relationship operations
  abstract createRelationship(
    relationship: BaseRelationship,
  ): Promise<BaseRelationship>;
  abstract updateRelationship(
    relationship: BaseRelationship,
  ): Promise<BaseRelationship>;
  abstract deleteRelationship(
    fromNodeType: string,
    fromId: string,
    toNodeType: string,
    toId: string,
    relationshipType: RelationshipType,
  ): Promise<boolean>;
  abstract findRelationships(
    nodeType: string,
    nodeId: string,
    relationshipType?: RelationshipType,
  ): Promise<any[]>;

  // Graph traversal
  abstract findConnectedNodes(
    nodeType: string,
    nodeId: string,
    relationshipType?: RelationshipType,
    direction?: 'incoming' | 'outgoing' | 'both',
    depth?: number,
  ): Promise<any[]>;
  abstract findShortestPath(
    fromNodeType: string,
    fromId: string,
    toNodeType: string,
    toId: string,
    maxDepth?: number,
  ): Promise<any[]>;

  // Business logic queries
  abstract findSimilarProducts(
    productId: string,
    limit?: number,
  ): Promise<any[]>;
  abstract getCustomerRecommendations(
    customerId: string,
    limit?: number,
  ): Promise<any[]>;
  abstract findFrequentlyBoughtTogether(
    productId: string,
    limit?: number,
  ): Promise<any[]>;
  abstract getCustomerInsights(customerId: string): Promise<any>;
  abstract getProductInsights(productId: string): Promise<any>;
  abstract getCategoryInsights(categoryId: string): Promise<any>;

  // Analytics
  abstract runCypherQuery(
    query: string,
    parameters?: Record<string, any>,
  ): Promise<any[]>;
  abstract healthCheck(): Promise<boolean>;
  abstract getDatabaseStats(): Promise<any>;
}
