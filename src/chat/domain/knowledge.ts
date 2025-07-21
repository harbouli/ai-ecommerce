// src/chat/domain/knowledge.ts
export class KnowledgeEntity {
  id: string;
  type: 'PRODUCT' | 'CATEGORY' | 'BRAND' | 'FEATURE' | 'CUSTOMER' | 'CONCEPT';
  name: string;
  description: string;
  properties: Record<string, any>;
  vector?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export class KnowledgeRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type:
    | 'BELONGS_TO'
    | 'SIMILAR_TO'
    | 'PURCHASED_WITH'
    | 'HAS_FEATURE'
    | 'RECOMMENDED_FOR'
    | 'RELATED_TO';
  weight: number;
  properties: Record<string, any>;
  createdAt: Date;
}
