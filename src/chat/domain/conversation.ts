import { Product } from '../../products/domain/product';
import { User } from '../../users/domain/user';
import { ExtractedEntity, MessageContext } from './message';

// src/chat/domain/conversation.ts
export class Conversation {
  id: string;
  userId: string;
  sessionId: string;
  context: ConversationContext;
  summary?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  createdAt: Date;
  updatedAt: Date;
}

export class ConversationContext {
  sessionId: string;
  userId: string;
  userProfile?: User;
  currentIntent: string;
  extractedEntities: ExtractedEntity[];
  conversationHistory: ConversationTurn[];
  recommendations: Product[];
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}
export class ConversationTurn {
  userMessage: string;
  assistantResponse: string;
  timestamp: Date;
  context: MessageContext[];
}
