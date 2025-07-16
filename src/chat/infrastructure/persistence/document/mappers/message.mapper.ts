import { Message } from '../../../../domain/message';
import { MessageSchemaClass } from '../entities/message.schema';

export class MessageMapper {
  static toDomain(raw: MessageSchemaClass): Message {
    const domainEntity = new Message();
    domainEntity.id = raw._id.toString();
    domainEntity.chatId = raw.chatId;
    domainEntity.sessionId = raw.sessionId;
    domainEntity.type = raw.type;
    domainEntity.content = raw.content;
    domainEntity.intent = raw.intent;
    domainEntity.confidence = raw.confidence;
    domainEntity.timestamp = raw.timestamp;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;

    // Map metadata
    if (raw.metadata) {
      domainEntity.metadata = {
        processingTime: raw.metadata.processingTime,
        tokensUsed: raw.metadata.tokensUsed,
        model: raw.metadata.model,
        temperature: raw.metadata.temperature,
        userId: raw.metadata.userId,
        userAgent: raw.metadata.userAgent,
        ipAddress: raw.metadata.ipAddress,
      };
    }

    // Map context
    if (raw.context) {
      domainEntity.context = raw.context.map((ctx) => ({
        source: ctx.source,
        content: ctx.content,
        score: ctx.score,
        metadata: ctx.metadata,
      }));
    }

    // Map entities
    if (raw.entities) {
      domainEntity.entities = raw.entities.map((entity) => ({
        text: entity.text,
        type: entity.type,
        confidence: entity.confidence,
        startIndex: entity.startIndex,
        endIndex: entity.endIndex,
        metadata: entity.metadata,
      }));
    }

    return domainEntity;
  }

  static toPersistence(domainEntity: Message): MessageSchemaClass {
    const persistenceSchema = new MessageSchemaClass();

    if (domainEntity.id && typeof domainEntity.id === 'string') {
      persistenceSchema._id = domainEntity.id;
    }

    persistenceSchema.chatId = domainEntity.chatId;
    persistenceSchema.sessionId = domainEntity.sessionId;
    persistenceSchema.type = domainEntity.type;
    persistenceSchema.content = domainEntity.content;
    persistenceSchema.intent = domainEntity.intent;
    persistenceSchema.confidence = domainEntity.confidence;
    persistenceSchema.timestamp = domainEntity.timestamp;
    persistenceSchema.createdAt = domainEntity.createdAt;
    persistenceSchema.updatedAt = domainEntity.updatedAt;
    persistenceSchema.deletedAt = domainEntity.deletedAt;

    // Map metadata
    if (domainEntity.metadata) {
      persistenceSchema.metadata = {
        processingTime: domainEntity.metadata.processingTime,
        tokensUsed: domainEntity.metadata.tokensUsed,
        model: domainEntity.metadata.model,
        temperature: domainEntity.metadata.temperature,
        userId: domainEntity.metadata.userId,
        userAgent: domainEntity.metadata.userAgent,
        ipAddress: domainEntity.metadata.ipAddress,
      };
    }

    // Map context
    if (domainEntity.context) {
      persistenceSchema.context = domainEntity.context.map((ctx) => ({
        source: ctx.source,
        content: ctx.content,
        score: ctx.score,
        metadata: ctx.metadata,
      }));
    }

    // Map entities
    if (domainEntity.entities) {
      persistenceSchema.entities = domainEntity.entities.map((entity) => ({
        text: entity.text,
        type: entity.type,
        confidence: entity.confidence,
        startIndex: entity.startIndex,
        endIndex: entity.endIndex,
        metadata: entity.metadata,
      }));
    }

    return persistenceSchema;
  }
}
