import { NullableType } from '../../../utils/types/nullable.type';
import { Message } from '../../domain/message';

export abstract class MessageRepository {
  // Core CRUD operations
  abstract create(data: Omit<Message, 'id'>): Promise<Message>;
  abstract findById(id: Message['id']): Promise<NullableType<Message>>;
  abstract update(
    id: Message['id'],
    payload: Partial<Message>,
  ): Promise<Message | null>;
  abstract remove(id: Message['id']): Promise<void>;

  // Chat and session operations
  abstract findByChatId(chatId: string): Promise<Message[]>;
  abstract findBySessionId(sessionId: string): Promise<Message[]>;
  abstract countByChatId(chatId: string): Promise<number>;
  abstract findConversationHistory(
    sessionId: string,
    limit: number,
  ): Promise<Message[]>;

  // User and type operations
  abstract findRecentByUserId(
    userId: string,
    limit: number,
  ): Promise<Message[]>;
  abstract findByType(
    type: 'USER' | 'ASSISTANT' | 'SYSTEM',
  ): Promise<Message[]>;

  // Content and context operations
  abstract findByEntityType(entityType: string): Promise<Message[]>;
  abstract findByIntent(intent: string): Promise<Message[]>;
  abstract findByContextSource(source: string): Promise<Message[]>;
  abstract searchByContent(searchTerm: string): Promise<Message[]>;

  // Date and analytics operations
  abstract findByDateRange(startDate: Date, endDate: Date): Promise<Message[]>;
  abstract aggregateByIntent(): Promise<any[]>;
}
