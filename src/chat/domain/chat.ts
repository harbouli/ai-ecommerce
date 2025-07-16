export class Chat {
  id: string;
  userId: string;
  sessionId: string;
  title: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  lastActivity: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
