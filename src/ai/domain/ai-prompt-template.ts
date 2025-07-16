export class AIPromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'system' | 'user' | 'assistant' | 'custom';
  isActive: boolean;
  version: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  constructor() {
    this.variables = [];
    this.metadata = {};
    this.isActive = true;
    this.version = '1.0.0';
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
