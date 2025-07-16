import { EntityWeaviateHelper } from '../../../../../utils/weaviate-entity-helper';

export class KnowledgeWeaviateSchema extends EntityWeaviateHelper {
  id?: string;
  type: 'PRODUCT' | 'CATEGORY' | 'BRAND' | 'FEATURE' | 'CUSTOMER' | 'CONCEPT';
  name: string;
  description: string;
  properties: Record<string, any>;

  // Flattened properties for Weaviate
  propertyKeys?: string[];
  propertyValues?: string[];

  // Relationships (stored as references)
  relatedEntityIds?: string[];
  relationshipTypes?: string[];
  relationshipWeights?: number[];

  // Metadata
  confidence?: number;
  relevanceScore?: number;
  source?: string;
  tags?: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Vector and text for semantic search
  vector?: number[];
  vectorizedText?: string;
}
