import { Types } from 'mongoose';
import { ChatSession } from '../../../../domain/chat-session';
import { ChatSessionDocument } from '../entities/chat-session.schema';
import { MessageMapper } from './message.mapper';
import { MessageDocument } from '../entities/message.schema';

export class ChatSessionMapper {
  static toDomain(document: ChatSessionDocument): ChatSession | null {
    if (!document) {
      return null;
    }

    return new ChatSession({
      id: document._id.toString(),
      title: document.title,
      userId: document.userId.toString(),
      context: document.context,
      isActive: document.isActive,
      messages:
        document.messages?.map((msg) => MessageMapper.toDomain(msg)) || [],
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      lastActivity: document.lastActivity,
    });
  }

  static toDocument(domain: ChatSession): Partial<ChatSessionDocument> {
    return {
      title: domain.title,
      userId: new Types.ObjectId(domain.userId),
      context: domain.context,
      isActive: domain.isActive,
      messages:
        (domain.messages
          ?.map((msg) => MessageMapper.toDocument(msg))
          .filter((msgDoc) => msgDoc && msgDoc._id) as MessageDocument[]) || [],
      lastActivity: domain.lastActivity,
    };
  }
}
