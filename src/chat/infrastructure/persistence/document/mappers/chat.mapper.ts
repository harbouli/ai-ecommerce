import { Chat } from '../../../../domain/chat';
import { ChatSchemaClass } from '../entities/chat.schema';

export class ChatMapper {
  static toDomain(raw: ChatSchemaClass): Chat {
    const domainEntity = new Chat();
    domainEntity.id = raw._id.toString();
    domainEntity.userId = raw.userId;
    domainEntity.sessionId = raw.sessionId;
    domainEntity.title = raw.title;
    domainEntity.status = raw.status;
    domainEntity.lastActivity = raw.lastActivity;
    domainEntity.metadata = raw.metadata;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Chat): ChatSchemaClass {
    const persistenceSchema = new ChatSchemaClass();

    if (domainEntity.id && typeof domainEntity.id === 'string') {
      persistenceSchema._id = domainEntity.id;
    }

    persistenceSchema.userId = domainEntity.userId;
    persistenceSchema.sessionId = domainEntity.sessionId;
    persistenceSchema.title = domainEntity.title;
    persistenceSchema.status = domainEntity.status;
    persistenceSchema.lastActivity = domainEntity.lastActivity;
    persistenceSchema.metadata = domainEntity.metadata;
    persistenceSchema.createdAt = domainEntity.createdAt;
    persistenceSchema.updatedAt = domainEntity.updatedAt;
    persistenceSchema.deletedAt = domainEntity.deletedAt;

    return persistenceSchema;
  }
}
