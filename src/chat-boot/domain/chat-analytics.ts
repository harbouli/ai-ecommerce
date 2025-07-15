import { ProductInteraction } from './product-interaction';

export class ChatAnalytics {
  chatId: string;
  userId: string;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  averageResponseTime?: number;
  sessionDuration?: number;
  topicCategories?: string[];
  productInteractions?: ProductInteraction[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  satisfaction?: number;

  constructor(data: Partial<ChatAnalytics>) {
    Object.assign(this, data);
  }

  calculateEngagementScore(): number {
    // Simple engagement score based on message count and session duration
    const messageScore = Math.min(this.totalMessages / 20, 1); // Max score at 20 messages
    const durationScore = this.sessionDuration
      ? Math.min(this.sessionDuration / (30 * 60 * 1000), 1)
      : 0; // Max score at 30 minutes

    return (messageScore + durationScore) / 2;
  }

  getUserEngagementLevel(): 'low' | 'medium' | 'high' {
    const score = this.calculateEngagementScore();
    if (score >= 0.7) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }
}
