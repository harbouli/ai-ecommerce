import { ChatSession } from '../../domain/chat-session';
import { Message } from '../../domain/chat-session';
import { PaginationOptions } from '../../chat-boot.service';

export abstract class ChatRepository {
  abstract create(chatSession: ChatSession): Promise<ChatSession>;

  abstract findById(id: string): Promise<ChatSession | null>;

  abstract findByUserId(
    userId: string,
    paginationOptions: PaginationOptions,
  ): Promise<ChatSession[]>;

  abstract update(
    id: string,
    updateData: Partial<ChatSession>,
  ): Promise<ChatSession>;

  abstract delete(id: string): Promise<void>;

  abstract addMessage(message: Message): Promise<Message>;

  abstract getMessages(
    chatId: string,
    paginationOptions: PaginationOptions,
  ): Promise<Message[]>;

  abstract updateLastActivity(chatId: string): Promise<void>;

  abstract getUserChatCount(userId: string): Promise<number>;

  abstract getActiveChatsForUser(userId: string): Promise<ChatSession[]>;
}
