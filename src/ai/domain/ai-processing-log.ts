export class AIProcessingLog {
  id: string;
  operation:
    | 'generate'
    | 'embed'
    | 'classify'
    | 'extract'
    | 'summarize'
    | 'translate'
    | 'analyze';
  input: string;
  output: any;
  model: string;
  processingTime: number;
  tokensUsed: number;
  userId?: string;
  sessionId?: string;
  success: boolean;
  error?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor() {
    this.success = true;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
