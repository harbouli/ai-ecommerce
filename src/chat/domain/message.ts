export class Message {
  id: string;
  chatId: string;
  sessionId: string;
  type: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  metadata?: MessageMetadata;
  context?: MessageContext[];
  entities?: ExtractedEntity[];
  intent?: string;
  confidence?: number;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export class MessageMetadata {
  processingTime?: number;
  tokensUsed?: number;
  userAction?: string;
  model?: string;
  temperature?: number;
  userId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export class MessageContext {
  source:
    | 'VECTOR'
    | 'GRAPH'
    | 'DOCUMENT'
    | 'PRODUCT'
    | 'KNOWLEDGE'
    | 'BRAND'
    | 'CATEGORY'
    | 'PRICE_COMPARISON'
    | 'RECOMMENDATION'
    | 'SIMILAR_PRODUCT';
  content: string;
  score: number;
  metadata: Record<string, any>;
}

export class ExtractedEntity {
  text: string;
  type:
    | 'PRODUCT'
    | 'CATEGORY'
    | 'BRAND'
    | 'PRICE'
    | 'FEATURE'
    | 'PERSON'
    | 'LOCATION';
  confidence: number;
  startIndex?: number;
  endIndex?: number;
  metadata: Record<string, any>;
}
