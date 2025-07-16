import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Chat } from '../../domain/chat';

export abstract class ChatRepository {
  // Core CRUD operations
  abstract create(data: Omit<Chat, 'id'>): Promise<Chat>;
  abstract findById(id: Chat['id']): Promise<NullableType<Chat>>;
  abstract findByUserId(userId: string): Promise<Chat[]>;
  abstract findBySessionId(sessionId: string): Promise<NullableType<Chat>>;
  abstract update(id: Chat['id'], payload: Partial<Chat>): Promise<Chat | null>;
  abstract remove(id: Chat['id']): Promise<void>;

  // Status-based operations
  abstract findActiveByUserId(userId: string): Promise<Chat[]>;
  abstract markAsCompleted(id: Chat['id']): Promise<Chat | null>;
  abstract findByStatus(
    status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED',
  ): Promise<Chat[]>;
  abstract findByUserIdAndStatus(
    userId: string,
    status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED',
  ): Promise<Chat[]>;

  // Pagination and filtering
  abstract findWithPagination(options: IPaginationOptions): Promise<Chat[]>;
  abstract findRecentByUserId(userId: string, limit: number): Promise<Chat[]>;
  abstract findInactiveChats(inactiveThreshold: Date): Promise<Chat[]>;

  // Utility operations
  abstract countByUserId(userId: string): Promise<number>;
  abstract updateLastActivity(id: Chat['id']): Promise<Chat | null>;
}
