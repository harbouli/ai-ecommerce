export class AiAnalytics {
  userId: string;
  sessionId?: string;
  totalInteractions: number;
  totalTokensUsed: number;
  totalCost: number;
  averageResponseTime: number;
  modelUsageBreakdown: Record<
    string,
    {
      count: number;
      tokens: number;
      cost: number;
    }
  >;
  interactionTypeBreakdown: Record<string, number>;
  dailyUsage: Record<
    string,
    {
      interactions: number;
      tokens: number;
      cost: number;
    }
  >;
  successRate: number;
  userSatisfaction?: number;
  periodStart: Date;
  periodEnd: Date;

  constructor(data: Partial<AiAnalytics>) {
    Object.assign(this, data);
  }

  getMostUsedModel(): string | undefined {
    if (!this.modelUsageBreakdown) return undefined;

    let maxCount = 0;
    let mostUsedModel: string | undefined;

    Object.entries(this.modelUsageBreakdown).forEach(([model, usage]) => {
      if (usage.count > maxCount) {
        maxCount = usage.count;
        mostUsedModel = model;
      }
    });

    return mostUsedModel;
  }

  getMostUsedInteractionType(): string | undefined {
    if (!this.interactionTypeBreakdown) return undefined;

    let maxCount = 0;
    let mostUsedType: string | undefined;

    Object.entries(this.interactionTypeBreakdown).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostUsedType = type;
      }
    });

    return mostUsedType;
  }

  getAverageTokensPerInteraction(): number {
    if (this.totalInteractions === 0) return 0;
    return this.totalTokensUsed / this.totalInteractions;
  }

  getAverageCostPerInteraction(): number {
    if (this.totalInteractions === 0) return 0;
    return this.totalCost / this.totalInteractions;
  }

  getUsageGrowthRate(): number {
    if (!this.dailyUsage) return 0;

    const days = Object.keys(this.dailyUsage).sort();
    if (days.length < 2) return 0;

    const firstDay = this.dailyUsage[days[0]];
    const lastDay = this.dailyUsage[days[days.length - 1]];

    if (firstDay.interactions === 0) return 0;

    return (
      ((lastDay.interactions - firstDay.interactions) / firstDay.interactions) *
      100
    );
  }
}
