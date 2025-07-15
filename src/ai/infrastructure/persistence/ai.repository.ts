import { AiSession } from '../../domain/ai-session';
import { AiInteraction } from '../../domain/ai-interaction';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export abstract class AiRepository {
  abstract createSession(aiSession: AiSession): Promise<AiSession>;
  abstract findSessionById(id: string): Promise<AiSession | null>;
  abstract findSessionsByUserId(
    userId: string,
    paginationOptions: PaginationOptions,
  ): Promise<AiSession[]>;
  abstract updateSession(
    id: string,
    updateData: Partial<AiSession>,
  ): Promise<AiSession>;
  abstract deleteSession(id: string): Promise<void>;
  abstract addInteraction(interaction: AiInteraction): Promise<AiInteraction>;
  abstract getSessionInteractions(
    sessionId: string,
    paginationOptions: PaginationOptions,
  ): Promise<AiInteraction[]>;
  abstract getUserUsageStats(userId: string): Promise<{
    totalRequests: number;
    tokensUsed: number;
    modelsUsed: string[];
    lastActivity: Date;
    monthlyUsage: Record<string, number>;
  }>;
}
