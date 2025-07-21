export class Chat {
  id: string;
  userId: string;
  sessionId: string;
  title: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  lastActivity: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  tokensUsed: number;
  processingTime: number;
  model: string;
  confidence?: number;
}
