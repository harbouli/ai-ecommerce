import { NullableType } from '../../../utils/types/nullable.type';
import { Chat } from '../../domain/chat';

export abstract class ChatRepository {
  abstract create(data: Omit<Chat, 'id'>): Promise<Chat>;
  abstract findById(id: Chat['id']): Promise<NullableType<Chat>>;
  abstract findByUserId(userId: string): Promise<Chat[]>;
  abstract findBySessionId(sessionId: string): Promise<NullableType<Chat>>;
  abstract update(id: Chat['id'], payload: Partial<Chat>): Promise<Chat | null>;
  abstract remove(id: Chat['id']): Promise<void>;
  abstract findActiveByUserId(userId: string): Promise<Chat[]>;
  abstract markAsCompleted(id: Chat['id']): Promise<Chat | null>;
}
