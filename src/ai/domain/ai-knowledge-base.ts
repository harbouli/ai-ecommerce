import { EmbeddingResult } from './embedding-result';

export class AIKnowledgeBase {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  embedding?: EmbeddingResult;
  isActive: boolean;
  priority: number;
  lastUpdated: Date;
  version: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  constructor() {
    this.tags = [];
    this.metadata = {};
    this.isActive = true;
    this.priority = 0;
    this.version = '1.0.0';
    this.lastUpdated = new Date();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
