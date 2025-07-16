export class AITrainingData {
  id: string;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  category: 'intent' | 'entity' | 'response' | 'summary' | 'translation';
  quality: 'high' | 'medium' | 'low';
  isValidated: boolean;
  validatedBy?: string;
  validatedAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  constructor() {
    this.metadata = {};
    this.isValidated = false;
    this.quality = 'medium';
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
