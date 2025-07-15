export class AiInteraction {
  id?: string;
  sessionId?: string;
  userId: string;
  interactionType: string;
  input: Record<string, any>;
  output: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt?: Date;

  constructor(data: Partial<AiInteraction>) {
    Object.assign(this, data);
    this.createdAt = this.createdAt || new Date();
  }

  isTextGeneration(): boolean {
    return this.interactionType === 'text_generation';
  }

  isImageAnalysis(): boolean {
    return this.interactionType === 'image_analysis';
  }

  isEmbeddingGeneration(): boolean {
    return this.interactionType === 'embedding_generation';
  }

  isSemanticSearch(): boolean {
    return this.interactionType === 'semantic_search';
  }

  hasMetadata(): boolean {
    return Boolean(this.metadata && Object.keys(this.metadata).length > 0);
  }

  getMetadata<T = any>(key: string): T | undefined {
    return this.metadata?.[key];
  }

  setMetadata(key: string, value: any): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata[key] = value;
  }

  getProcessingTime(): number | undefined {
    return this.getMetadata<number>('processingTime');
  }

  getTokensUsed(): number | undefined {
    return this.output?.tokensUsed || this.getMetadata<number>('tokensUsed');
  }

  getConfidenceScore(): number | undefined {
    return this.output?.confidence || this.getMetadata<number>('confidence');
  }

  getModelUsed(): string | undefined {
    return (
      this.output?.model ||
      this.input?.model ||
      this.getMetadata<string>('model')
    );
  }
}
