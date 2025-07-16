/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../../../../../database/neo4j/neo4j.service';
import {
  KnowledgeEntity,
  KnowledgeRelationship,
} from '../../../../domain/knowledge';

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

  async findShortestPath(
    fromEntityId: string,
    toEntityId: string,
  ): Promise<any[]> {
    const query = `
      MATCH (from:KnowledgeEntity {id: $fromEntityId})
      MATCH (to:KnowledgeEntity {id: $toEntityId})
      MATCH path = shortestPath((from)-[*]-(to))
      RETURN path, LENGTH(path) as pathLength
    `;

    try {
      const result = await this.neo4jService.read(query, {
        fromEntityId,
        toEntityId,
      });

      if (result.records.length === 0) {
        return [];
      }

      const record = result.records[0];
      const path = record.get('path');
      const pathLength = record.get('pathLength');

      const pathNodes = path.segments.map((segment: any) => ({
        entity: this.mapToKnowledgeEntity(segment.start),
        relationship: {
          type: segment.relationship.type,
          weight: segment.relationship.properties.weight,
          properties: segment.relationship.properties.properties || {},
        },
        nextEntity: this.mapToKnowledgeEntity(segment.end),
      }));

      return [
        {
          path: pathNodes,
          length: pathLength,
          entities: [
            this.mapToKnowledgeEntity(path.start),
            ...path.segments.map((segment: any) =>
              this.mapToKnowledgeEntity(segment.end),
            ),
          ],
        },
      ];
    } catch (error) {
      this.logger.error('Error finding shortest path:', error);
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

  async findEntityClusters(entityType: string): Promise<any[]> {
    const query = `
      MATCH (e:KnowledgeEntity {type: $entityType})
      MATCH (e)-[r]-(connected:KnowledgeEntity)
      WITH e, COUNT(connected) as connections, COLLECT(connected.type) as connectedTypes
      WITH e, connections, connectedTypes, 
           SIZE([type IN connectedTypes WHERE type = $entityType]) as sameTypeConnections
      ORDER BY connections DESC, sameTypeConnections DESC
      RETURN e.id as entityId, e.name as entityName, 
             connections, sameTypeConnections, connectedTypes
    `;

    try {
      const result = await this.neo4jService.read(query, { entityType });
      return result.records.map((record) => ({
        entityId: record.get('entityId'),
        entityName: record.get('entityName'),
        connections: record.get('connections').toNumber(),
        sameTypeConnections: record.get('sameTypeConnections').toNumber(),
        connectedTypes: record.get('connectedTypes'),
      }));
    } catch (error) {
      this.logger.error('Error finding entity clusters:', error);
      return [];
    }
  }

  async createProductRecommendationPath(
    userId: string,
    productId: string,
    reason: string,
  ): Promise<void> {
    const query = `
      MERGE (u:User {id: $userId})
      MERGE (p:Product {id: $productId})
      MERGE (u)-[r:RECOMMENDED]->(p)
      SET r.reason = $reason,
          r.createdAt = datetime(),
          r.score = COALESCE(r.score, 0) + 1
      RETURN r
    `;

    try {
      await this.neo4jService.write(query, { userId, productId, reason });
      this.logger.log(`Created recommendation path: ${userId} -> ${productId}`);
    } catch (error) {
      this.logger.error('Error creating recommendation path:', error);
      throw error;
    }
  }

  async findRecommendationReasons(
    userId: string,
    productId: string,
  ): Promise<string[]> {
    const query = `
      MATCH (u:User {id: $userId})-[r:RECOMMENDED]->(p:Product {id: $productId})
      RETURN r.reason as reason, r.score as score
      ORDER BY r.score DESC
    `;

    try {
      const result = await this.neo4jService.read(query, { userId, productId });
      return result.records.map((record) => record.get('reason'));
    } catch (error) {
      this.logger.error('Error finding recommendation reasons:', error);
      return [];
    }
  }

  async updateRelationshipWeight(
    relationshipId: string,
    weight: number,
  ): Promise<void> {
    const query = `
      MATCH ()-[r {id: $relationshipId}]->()
      SET r.weight = $weight,
          r.updatedAt = datetime()
      RETURN r
    `;

    try {
      await this.neo4jService.write(query, { relationshipId, weight });
      this.logger.log(`Updated relationship weight: ${relationshipId}`);
    } catch (error) {
      this.logger.error('Error updating relationship weight:', error);
      throw error;
    }
  }

  // Additional utility methods for comprehensive knowledge graph operations

  async findEntityNeighbors(
    entityId: string,
    relationshipType?: string,
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    const relationshipFilter = relationshipType
      ? `[r:${relationshipType}]`
      : '[r]';

    const query = `
      MATCH (e:KnowledgeEntity {id: $entityId})${relationshipFilter}(neighbor:KnowledgeEntity)
      RETURN neighbor, r.weight as weight
      ORDER BY weight DESC
      LIMIT $limit
    `;

    try {
      const result = await this.neo4jService.read(query, { entityId, limit });
      return result.records.map((record) =>
        this.mapToKnowledgeEntity(record.get('neighbor')),
      );
    } catch (error) {
      this.logger.error('Error finding entity neighbors:', error);
      return [];
    }
  }

  async findStronglyConnectedComponents(entityType: string): Promise<any[]> {
    const query = `
      MATCH (e:KnowledgeEntity {type: $entityType})
      CALL gds.alpha.scc.stream({
        nodeProjection: {
          KnowledgeEntity: {
            label: 'KnowledgeEntity',
            properties: ['id', 'type', 'name']
          }
        },
        relationshipProjection: '*'
      })
      YIELD nodeId, componentId
      WITH gds.util.asNode(nodeId) as node, componentId
      WHERE node.type = $entityType
      RETURN componentId, COLLECT(node.id) as entityIds, COUNT(node) as componentSize
      ORDER BY componentSize DESC
    `;

    try {
      const result = await this.neo4jService.read(query, { entityType });
      return result.records.map((record) => ({
        componentId: record.get('componentId'),
        entityIds: record.get('entityIds'),
        componentSize: record.get('componentSize').toNumber(),
      }));
    } catch (error) {
      this.logger.warn('GDS not available, using basic clustering');
      return await this.findBasicClusters(entityType);
    }
  }

  private async findBasicClusters(entityType: string): Promise<any[]> {
    const query = `
      MATCH (e:KnowledgeEntity {type: $entityType})-[r]-(connected:KnowledgeEntity)
      WITH e, COUNT(connected) as degree
      WHERE degree > 1
      RETURN e.id as entityId, degree
      ORDER BY degree DESC
    `;

    try {
      const result = await this.neo4jService.read(query, { entityType });
      return result.records.map((record) => ({
        entityId: record.get('entityId'),
        degree: record.get('degree').toNumber(),
      }));
    } catch (error) {
      this.logger.error('Error finding basic clusters:', error);
      return [];
    }
  }

  async findInfluentialEntities(
    entityType: string,
    limit: number = 10,
  ): Promise<any[]> {
    const query = `
      MATCH (e:KnowledgeEntity {type: $entityType})
      MATCH (e)-[r]-(connected:KnowledgeEntity)
      WITH e, COUNT(connected) as degree, 
           AVG(r.weight) as avgWeight,
           COUNT(DISTINCT connected.type) as typesDiversity
      WITH e, degree, avgWeight, typesDiversity,
           (degree * avgWeight * typesDiversity) as influence
      ORDER BY influence DESC
      LIMIT $limit
      RETURN e.id as entityId, e.name as entityName, 
             degree, avgWeight, typesDiversity, influence
    `;

    try {
      const result = await this.neo4jService.read(query, { entityType, limit });
      return result.records.map((record) => ({
        entityId: record.get('entityId'),
        entityName: record.get('entityName'),
        degree: record.get('degree').toNumber(),
        avgWeight: record.get('avgWeight'),
        typesDiversity: record.get('typesDiversity').toNumber(),
        influence: record.get('influence'),
      }));
    } catch (error) {
      this.logger.error('Error finding influential entities:', error);
      return [];
    }
  }

  async findEntitySimilarity(
    entityId: string,
    limit: number = 5,
  ): Promise<any[]> {
    const query = `
      MATCH (e:KnowledgeEntity {id: $entityId})-[r1]-(common:KnowledgeEntity)-[r2]-(similar:KnowledgeEntity)
      WHERE e.id <> similar.id
      WITH similar, COUNT(common) as commonNeighbors, 
           AVG(r1.weight + r2.weight) as avgConnectionWeight
      ORDER BY commonNeighbors DESC, avgConnectionWeight DESC
      LIMIT $limit
      RETURN similar, commonNeighbors, avgConnectionWeight
    `;

    try {
      const result = await this.neo4jService.read(query, { entityId, limit });
      return result.records.map((record) => ({
        entity: this.mapToKnowledgeEntity(record.get('similar')),
        commonNeighbors: record.get('commonNeighbors').toNumber(),
        avgConnectionWeight: record.get('avgConnectionWeight'),
      }));
    } catch (error) {
      this.logger.error('Error finding entity similarity:', error);
      return [];
    }
  }

  async getKnowledgeGraphStats(): Promise<any> {
    const query = `
      MATCH (e:KnowledgeEntity)
      OPTIONAL MATCH (e)-[r]-(connected:KnowledgeEntity)
      WITH e.type as entityType, COUNT(DISTINCT e) as entityCount, 
           COUNT(r) as relationshipCount
      RETURN entityType, entityCount, relationshipCount
      ORDER BY entityCount DESC
    `;

    try {
      const result = await this.neo4jService.read(query);
      return result.records.map((record) => ({
        entityType: record.get('entityType'),
        entityCount: record.get('entityCount').toNumber(),
        relationshipCount: record.get('relationshipCount').toNumber(),
      }));
    } catch (error) {
      this.logger.error('Error getting knowledge graph stats:', error);
      return [];
    }
  }

  async findConceptualPaths(
    fromConcept: string,
    toConcept: string,
    maxHops: number = 5,
  ): Promise<any[]> {
    const query = `
      MATCH (from:KnowledgeEntity)
      WHERE from.name CONTAINS $fromConcept OR from.description CONTAINS $fromConcept
      MATCH (to:KnowledgeEntity)
      WHERE to.name CONTAINS $toConcept OR to.description CONTAINS $toConcept
      MATCH path = (from)-[*1..${maxHops}]-(to)
      WHERE from.id <> to.id
      WITH path, LENGTH(path) as pathLength, 
           REDUCE(totalWeight = 0, r in relationships(path) | totalWeight + r.weight) as totalWeight
      ORDER BY pathLength ASC, totalWeight DESC
      LIMIT 10
      RETURN path, pathLength, totalWeight
    `;

    try {
      const result = await this.neo4jService.read(query, {
        fromConcept,
        toConcept,
      });
      return result.records.map((record) => ({
        path: this.mapPathToEntities(record.get('path')),
        pathLength: record.get('pathLength').toNumber(),
        totalWeight: record.get('totalWeight'),
      }));
    } catch (error) {
      this.logger.error('Error finding conceptual paths:', error);
      return [];
    }
  }

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

  private mapPathToEntities(path: any): any[] {
    const entities: any[] = [this.mapToKnowledgeEntity(path.start)];

    for (const segment of path.segments) {
      entities.push({
        relationship: {
          type: segment.relationship.type,
          weight: segment.relationship.properties.weight,
          properties: segment.relationship.properties.properties || {},
        },
        entity: this.mapToKnowledgeEntity(segment.end),
      });
    }

    return entities;
  }

  // Bulk operations for performance
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
    const query = `
      UNWIND $relationships as relData
      MATCH (from:KnowledgeEntity {id: relData.fromEntityId})
      MATCH (to:KnowledgeEntity {id: relData.toEntityId})
      CALL apoc.create.relationship(from, relData.type, {
        id: relData.id,
        weight: relData.weight,
        properties: relData.properties,
        createdAt: datetime(relData.createdAt)
      }, to) YIELD rel
      RETURN count(rel) as created
    `;

    const parameters = {
      relationships: relationships.map((rel) => ({
        id: rel.id,
        fromEntityId: rel.fromEntityId,
        toEntityId: rel.toEntityId,
        type: rel.type,
        weight: rel.weight,
        properties: rel.properties || {},
        createdAt: rel.createdAt?.toISOString() || new Date().toISOString(),
      })),
    };

    try {
      await this.neo4jService.write(query, parameters);
      this.logger.log(`Created ${relationships.length} relationships in batch`);
    } catch (error) {
      this.logger.warn('APOC not available, using basic batch creation');
      await this.createRelationshipsBatchBasic(relationships);
    }
  }

  private async createRelationshipsBatchBasic(
    relationships: KnowledgeRelationship[],
  ): Promise<void> {
    for (const relationship of relationships) {
      await this.createKnowledgeRelationship(relationship);
    }
  }
}
