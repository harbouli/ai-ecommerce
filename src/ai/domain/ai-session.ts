import { AiInteraction } from './ai-interaction';

export enum AiSessionType {
  TEXT_GENERATION = 'text_generation',
  IMAGE_ANALYSIS = 'image_analysis',
  EMBEDDINGS = 'embeddings',
  SEMANTIC_SEARCH = 'semantic_search',
  MULTIMODAL = 'multimodal',
  GENERAL = 'general',
}

export class AiSession {
  id?: string;
  title: string;
  userId: string;
  sessionType: AiSessionType;
  context?: string;
  configuration?: Record<string, any>;
  isActive: boolean;
  interactions?: AiInteraction[];
  createdAt?: Date;
  updatedAt?: Date;
  lastActivity?: Date;

  constructor(data: Partial<AiSession>) {
    Object.assign(this, data);
    this.createdAt = this.createdAt || new Date();
    this.updatedAt = this.updatedAt || new Date();
    this.lastActivity = this.lastActivity || new Date();
    this.isActive = this.isActive ?? true;
  }

  updateLastActivity(): void {
    this.lastActivity = new Date();
    this.updatedAt = new Date();
  }

  addInteraction(interaction: AiInteraction): void {
    if (!this.interactions) {
      this.interactions = [];
    }
    this.interactions.push(interaction);
    this.updateLastActivity();
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  getTotalTokensUsed(): number {
    if (!this.interactions) return 0;

    return this.interactions.reduce((total, interaction) => {
      const tokensUsed = interaction.getMetadata<number>('tokensUsed') || 0;
      return total + tokensUsed;
    }, 0);
  }

  getInteractionsByType(type: string): AiInteraction[] {
    if (!this.interactions) return [];
    return this.interactions.filter(
      (interaction) => interaction.interactionType === type,
    );
  }

  getLastInteraction(): AiInteraction | undefined {
    if (!this.interactions || this.interactions.length === 0) return undefined;
    return this.interactions[this.interactions.length - 1];
  }
}
