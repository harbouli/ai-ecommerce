export class AIFeedback {
  id: string;
  responseId: string;
  userId?: string;
  sessionId?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  feedback: string;
  category: 'accuracy' | 'relevance' | 'helpfulness' | 'clarity' | 'other';
  isHelpful: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  constructor() {
    this.metadata = {};
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
