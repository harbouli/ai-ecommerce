import { AiModel, AiModelProvider } from './ai-model';

export class AiUsage {
  userId: string;
  sessionId?: string;
  interactionId?: string;
  modelId: string;
  modelProvider: AiModelProvider;
  interactionType: string;
  tokensUsed?: number;
  requestCount: number;
  processingTime?: number;
  cost?: number;
  timestamp: Date;
  metadata?: Record<string, any>;

  constructor(data: Partial<AiUsage>) {
    Object.assign(this, data);
    this.timestamp = this.timestamp || new Date();
    this.requestCount = this.requestCount || 1;
  }

  calculateCost(model: AiModel): number {
    if (!model.pricing || !this.tokensUsed) return 0;

    const { inputTokens, requests, unit } = model.pricing;

    if (unit === 'per_1k_tokens' && inputTokens) {
      return (this.tokensUsed / 1000) * inputTokens;
    }

    if (unit === 'per_request' && requests) {
      return this.requestCount * requests;
    }

    return 0;
  }

  isRecentUsage(hoursAgo: number = 24): boolean {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    return this.timestamp > cutoff;
  }

  isHighUsage(): boolean {
    return (this.tokensUsed || 0) > 1000 || this.requestCount > 10;
  }
}
