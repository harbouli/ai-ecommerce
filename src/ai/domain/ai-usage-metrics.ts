export class AIUsageMetrics {
  id: string;
  userId?: string;
  sessionId?: string;
  operation: string;
  model: string;
  tokensUsed: number;
  processingTime: number;
  cost: number;
  timestamp: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  constructor() {
    this.metadata = {};
    this.timestamp = new Date();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
