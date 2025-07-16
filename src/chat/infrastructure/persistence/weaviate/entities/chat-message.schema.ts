import { EntityWeaviateHelper } from '../../../../../utils/weaviate-entity-helper';

export class ChatMessageWeaviateSchema extends EntityWeaviateHelper {
  id?: string;
  chatId: string;
  sessionId: string;
  type: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  intent?: string;
  confidence?: number;
  timestamp: Date;
  userId?: string;

  // AI-specific fields
  tokensUsed?: number;
  processingTime?: number;
  model?: string;

  // Entity information (flattened for Weaviate)
  entityTexts?: string[];
  entityTypes?: string[];
  entityConfidences?: number[];

  // Context information
  contextSources?: string[];
  contextContents?: string[];
  contextScores?: number[];

  // Vector and text for semantic search
  vector?: number[];
  vectorizedText?: string;
}
