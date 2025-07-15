export class ChatSession {
  id?: string;
  title: string;
  userId: string;
  context?: string;
  isActive: boolean;
  messages?: Message[];
  createdAt?: Date;
  updatedAt?: Date;
  lastActivity?: Date;

  constructor(data: Partial<ChatSession>) {
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

  addMessage(message: Message): void {
    if (!this.messages) {
      this.messages = [];
    }
    this.messages.push(message);
    this.updateLastActivity();
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }
}

// domain/message.ts
export class Message {
  id?: string;
  chatId: string;
  content: string;
  role: 'user' | 'assistant';
  metadata?: Record<string, any>;
  createdAt?: Date;

  constructor(data: Partial<Message>) {
    Object.assign(this, data);
    this.createdAt = this.createdAt || new Date();
  }

  isFromUser(): boolean {
    return this.role === 'user';
  }

  isFromAssistant(): boolean {
    return this.role === 'assistant';
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
}
