import { EntityWeaviateHelper } from '../../../../../utils/weaviate-entity-helper';

export class ConversationContextWeaviateSchema extends EntityWeaviateHelper {
  id?: string;
  sessionId: string;
  userId: string;
  contextType: 'SUMMARY' | 'INTENT_HISTORY' | 'ENTITY_CONTEXT' | 'PREFERENCE';
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  relevanceScore?: number;

  // Vector and text for semantic search
  vector?: number[];
  vectorizedText?: string;
}
