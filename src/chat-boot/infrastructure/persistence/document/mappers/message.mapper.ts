import { Types } from 'mongoose';
import { MessageDocument } from '../entities/message.schema';
import { Message } from '../../../../domain/chat-session';

export class MessageMapper {
  static toDomain(document: MessageDocument): Message {
    if (!document) {
      return [] as any;
    }

    return new Message({
      id: document._id.toString(),
      chatId: document.chatId.toString(),
      content: document.content,
      role: document.role,
      metadata: document.metadata,
      createdAt: document.createdAt,
    });
  }

  static toDocument(domain: Message): Partial<MessageDocument> {
    return {
      chatId: new Types.ObjectId(domain.chatId),
      content: domain.content,
      role: domain.role,
      metadata: domain.metadata,
    };
  }
}
