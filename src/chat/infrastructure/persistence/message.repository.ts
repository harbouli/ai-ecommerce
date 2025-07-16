import { NullableType } from '../../../utils/types/nullable.type';
import { Message } from '../../domain/message';

export abstract class MessageRepository {
  abstract create(data: Omit<Message, 'id'>): Promise<Message>;
  abstract findById(id: Message['id']): Promise<NullableType<Message>>;
  abstract findByChatId(chatId: string): Promise<Message[]>;
  abstract findBySessionId(sessionId: string): Promise<Message[]>;
  abstract update(
    id: Message['id'],
    payload: Partial<Message>,
  ): Promise<Message | null>;
  abstract remove(id: Message['id']): Promise<void>;
  abstract findRecentByUserId(
    userId: string,
    limit: number,
  ): Promise<Message[]>;
  abstract findByEntityType(entityType: string): Promise<Message[]>;
  abstract findByIntent(intent: string): Promise<Message[]>;
}
